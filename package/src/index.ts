import format from 'pg-format';
import { defaults, VECTOR_COLUMN } from './constants.js';
import validate from './index.validation.js';
import * as lib from './lib/index.js';
import { pick, getClient, getPublicError } from './utils/index.js';
import type {
  Handler,
  Inferred,
  DatabaseResult,
  SearchResponse,
  FacetHit,
  FacetsSearchResponse,
} from './index.types.js';

const client = getClient();

export const getSearchHandler =
  (configs?: Handler.Config | Handler.Configs) =>
  (req: Handler.Req, res: Handler.Res) => {
    searchHandler(req, res, configs);
  };

/**
 * Search handler
 */

export async function searchHandler(
  req: Handler.Req,
  res: Handler.Res,
  configs: Handler.Config | Handler.Configs = []
) {
  /**
   * Validate payload
   */

  const json = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const parsed = validate.initial(json);

  if (!parsed.success) {
    console.error(parsed.error); // TODO maybe put error logs behind a flag
    return res.status(400).json(getPublicError(parsed.error));
  }

  /**
   * Loop the requests and handle them individually
   */

  const resultsPromises: Promise<SearchResponse | FacetsSearchResponse>[] = [];

  for (const request of parsed.data.requests) {
    // Indexname without the sort order query param
    const [indexName] = request.indexName.split('?');
    // If array, get the user config by indexName, else configs is config object
    const config = Array.isArray(configs)
      ? configs?.find((config) => config.indexName === indexName)
      : configs;
    if (request.type === 'facet' && typeof request.facet === 'string') {
      resultsPromises.push(handleFacetSearch(request, config));
    } else {
      // Handle the request & push it to the promises array
      resultsPromises.push(handleRequest(request, config));
    }
  }

  // Catch any errors and return them
  const results = await Promise.all(
    resultsPromises.map((p) => p.catch((e) => e))
  );

  const errors = results.filter((result) => result instanceof Error);

  // If all results are valid, return 200
  if (!errors?.length) {
    return res.status(200).json({ results });
  }

  // If an error was found in the results, return 400
  const body = results.map((result) => {
    if (result instanceof Error) {
      // Log the error
      console.error(result);
      return getPublicError(result);
    }
    return result;
  });

  res.status(400).json({ results: body });
}

/**
 * Handle single request (called inside loop)
 */

const handleRequest = async (
  request: Inferred.RequestInitial,
  config?: Handler.Config
): Promise<SearchResponse> => {
  const start = performance.now();

  /**
   * Validate
   */

  // Merge the user's config.clientValidation & default clientValidation
  const clientValidation = {
    ...defaults.clientValidation,
    ...config?.clientValidation,
  };

  // Merge the user's config.settings & default settings
  const settings = { ...defaults.settings, ...config?.settings };

  // Validate the request against clientValidation parameters
  const parsed = validate.payload(request, clientValidation, settings);

  // If invalid, return error
  if (!parsed.success) {
    // console.error(parsed.error.issues);
    throw parsed.error;
  }

  /**
   * Define constants and merge settings with params
   */

  const { indexName, params } = parsed.data;
  const { query } = params;
  const paramsWithSettings = { ...settings, ...params };

  /**
   * Lib functions
   */

  const { table, formattedSort } = lib.getTableAndSort(indexName);

  const columns = lib.getColumns(
    params.attributesToRetrieve || settings.attributesToRetrieve
  );

  const pagination = lib.getPagination(
    pick(paramsWithSettings, ['page', 'hitsPerPage', 'length', 'offset'])
  );

  const attributes = await lib.getAttributes({
    client,
    table,
    ...pick(paramsWithSettings, [
      'attributesForFaceting',
      'numericAttributesForFiltering',
    ]),
  });

  attributes?.new.forEach(([key, value]) => {
    paramsWithSettings[key] = value;
  });

  const facets = lib.getFacets(
    pick(paramsWithSettings, [
      'facets',
      'attributesForFaceting',
      'maxValuesPerFacet',
      'sortFacetValuesBy',
      'maxFacetHits',
      'renderingContent',
      'numericAttributesForFiltering',
    ])
  );

  const filters = lib.getFilters(
    pick(paramsWithSettings, [
      'facetFilters',
      'numericFilters',
      'attributesForFaceting',
      'numericAttributesForFiltering',
      'maxFacetHits',
    ])
  );

  const highlight = lib.getHighlight(
    pick(paramsWithSettings, [
      'query',
      'attributesToHighlight',
      'highlightPreTag',
      'highlightPostTag',
    ])
  );

  /**
   * Database query
   */

  const formattedSql = format(
    /* sql */ `(
    --
    -- Step 1: Get all the results
    --
    WITH all_selection AS (
      SELECT *
      FROM %I
      WHERE
        -- Search OR get *all* results on an empty query
        ( %I @@ websearch_to_tsquery(%L) OR %L = '' )
        ${filters?.db.formatted ? ` AND ${filters?.db.formatted}` : ``}
    ),
    --
    -- Step 2: Get the search results (hits)
    --
    hits_selection AS (
      SELECT
        ${columns.db.formatted}
        ${highlight?.db.formatted ? `, ${highlight?.db.formatted}` : ``}
      FROM all_selection
      ${formattedSort}
      OFFSET %s
      LIMIT %s
    )
    --
    -- Step 3: Additional CTEs for facets
    -- 3a: Get the counts for each facet
    -- 3b: Get facets_stats on numeric attributes
    --
    ${facets?.db?.cte ? `, ${facets.db.cte}` : ''}
    ${facets?.db?.statsCte ? `, ${facets.db.statsCte}` : ''}
    --
    -- Step 4: Return it all as a JSON object
    -- 4a. totalHits and hits are always returned
    -- 4b. facets are only returned if there are facets in the query
    --     and are nested in a JSON object
    --
    SELECT json_build_object(
      'totalHits', ( SELECT count(*) FROM all_selection ),
      'hits', jsonb_agg(hits_selection.*)::jsonb
      ${facets?.db?.json ? `, ${facets.db.json}` : ''}
      ${facets?.db?.statsJson ? `, ${facets.db.statsJson}` : ''}
    ) AS "json"
    FROM hits_selection
  )`,
    table,
    VECTOR_COLUMN,
    query,
    query,
    pagination.db.offset,
    pagination.db.limit
  );

  const result: DatabaseResult = await client.query(formattedSql).catch((e) => {
    // Create and log an error here to get the file and line number
    console.error(new Error('Database error in handleRequest'));
    throw e; // rethrow the error
  });

  const {
    hits,
    totalHits,
    facets: dbFacets,
    facets_stats,
  } = result.rows[0].json;

  /**
   * Update results
   */

  const timeTaken = Math.ceil(performance.now() - start);

  // params is an object with nested arrays, need to urlEncode each value
  // then cast it to a string with URLSearchParams
  const paramsFlat = Object.entries(params).reduce(
    (acc, [key, value]) => {
      if (typeof value !== 'string') {
        acc[key] = JSON.stringify(value);
      } else {
        acc[key] = value;
      }
      return acc;
    },
    {} as {
      [key: string]: string;
    }
  );
  const paramsString = new URLSearchParams(paramsFlat).toString();

  return {
    hits:
      hits?.map((hit) => {
        hit = highlight?.updateHit(hit) ?? hit;
        return columns.updateHit?.(hit) ?? hit;
      }) ?? [],
    ...pagination.updateRes({
      totalHits,
      res: pagination.res,
    }),
    ...(dbFacets && { facets: dbFacets }),
    ...(facets_stats && { facets_stats }),
    processingTimeMS: timeTaken,
    ...(facets?.renderingContent && {
      renderingContent: facets.renderingContent,
    }),
    index: indexName,
    query: query || '',
    params: paramsString,
    exhaustiveFacetsCount: true,
    exhaustiveNbHits: true,
  };
};

const handleFacetSearch = async (
  request: Inferred.RequestInitial,
  config?: Handler.Config
): Promise<FacetsSearchResponse> => {
  /**
   * Validate
   */

  // Merge the user's config.clientValidation & default clientValidation
  const clientValidation = {
    ...defaults.clientValidation,
    ...config?.clientValidation,
  };

  // Merge the user's config.settings & default settings
  const settings = { ...defaults.settings, ...config?.settings };

  // Validate the request against clientValidation parameters
  const parsed = validate.payload(request, clientValidation, settings);

  // If invalid, return error
  if (!parsed.success) {
    // console.error(parsed.error.issues);
    throw parsed.error;
  }

  /**
   * Define constants and merge settings with params
   */

  const { indexName, params, facet } = parsed.data;
  const { query, facetQuery } = params;
  const paramsWithSettings = { ...settings, ...params };

  /**
   * Lib functions
   */

  const { table } = lib.getTableAndSort(indexName);

  const attributes = await lib.getAttributes({
    client,
    table,
    ...pick(paramsWithSettings, [
      'attributesForFaceting',
      'numericAttributesForFiltering',
    ]),
  });

  attributes?.new.forEach(([key, value]) => {
    paramsWithSettings[key] = value;
  });

  const filters = await lib.getFilters(
    pick(paramsWithSettings, [
      'facetFilters',
      'numericFilters',
      'attributesForFaceting',
      'numericAttributesForFiltering',
      'maxFacetHits',
    ])
  );

  /**
   * Database query
   */

  const formattedSql = format(
    /* sql */ `(
    --
    -- Step 1: Get all the results
    --
    WITH all_selection AS (
      SELECT *
      FROM %I
      WHERE
        -- Search OR get *all* results on an empty query
        ( %I @@ websearch_to_tsquery(%L) OR %L = '' )
        ${filters?.db.formatted ? ` AND ${filters?.db.formatted}` : ``}
    )
    --
    -- Step 2: Do a basic ILIKE search on the facet
    --
    SELECT 
      %I, count(*)::int4 AS count, regexp_replace(%I, %L,  %L, 'gi') AS highlighted
    FROM all_selection
    WHERE %I ILIKE %L
    GROUP by %I 
    ORDER BY count(*) DESC
    LIMIT 20
  )`,
    table,
    VECTOR_COLUMN,
    query,
    query,
    // facet part
    facet,
    facet,
    `(${facetQuery})`,
    `${paramsWithSettings.highlightPreTag}\\1${paramsWithSettings.highlightPostTag}`,
    facet,
    `%${facetQuery}%`,
    facet
  );

  const result = await client.query(formattedSql).catch((e) => {
    // Create and log an error here to get the file and line number
    console.error(new Error('Database error in handleFacetSearch'));
    throw e; // rethrow the error
  });

  return {
    facetHits: result.rows as FacetHit[],
  };
};

export * from './client.js';
