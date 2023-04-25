import format from 'pg-format';
import { defaults, VECTOR_COLUMN } from './constants.js';
import validate from './index.validation.js';
import * as lib from './lib/index.js';
import { pick, getClient } from './utils/index.js';
import type {
  Handler,
  Inferred,
  DatabaseResult,
  SearchResponse,
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
    console.error(parsed.error.issues); // TODO maybe put error logs behind a flag
    return res.status(400).json({ error: 'Request contained invalid payload' });
  }

  /**
   * Loop the requests and handle them individually
   */

  const resultsPromises: Promise<SearchResponse>[] = [];

  for (const request of parsed.data.requests) {
    // Indexname without the sort order query param
    const [indexName] = request.indexName.split('?');
    // If array, get the user config by indexName, else configs is config object
    const config = Array.isArray(configs)
      ? configs?.find((config) => config.indexName === indexName)
      : configs;
    // Handle the request & push it to the promises array
    resultsPromises.push(handleRequest(request, config));
  }

  // Catch any errors and return them
  const results = await Promise.all(
    resultsPromises.map((p) => p.catch((e) => e))
  );

  // If any of the results is an error, return 400
  const errors = results.filter((result) => result instanceof Error);
  if (errors.length) {
    console.error(errors[0].stack);
    // Don't return the error stack to the browser
    const browserError =
      errors[0].name === 'ZodError'
        ? 'Request contained invalid payload'
        : 'Request caused an error';
    return res.status(400).json({ error: browserError });
  }

  // If all results are valid, return 200
  res.status(200).json({ results });
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

  const facets = await lib.getFacets(
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

  const filters = await lib.getFilters(
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
        ( ( %I @@ websearch_to_tsquery(%L) AND %L <> '' )  OR %L = '' )
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
    query,
    pagination.db.offset,
    pagination.db.limit
  );

  // console.log(formattedSql);

  const result: DatabaseResult = await client.query(formattedSql);
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
        hit = highlight?.updateHit(hit) || hit;
        return columns.updateHit?.(hit) || hit;
      }) || [],
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

export * from './client.js';
