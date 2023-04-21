import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Constants
import {
  VECTOR_COLUMN,
  defaultSettings,
  defaultClientValidation,
} from './constants.js';
// Types and validation
import type {
  GenericReq,
  GenericRes,
  Settings,
  HandlerConfig,
  HandlerConfigs,
  DatabaseResult,
  SearchResponse,
} from './index.types.js';
import {
  initialValidation,
  RequestSchemaInitial,
  validatePayload,
} from './index.validation.js';
// Lib
import { getColumns } from './lib/columns.js';
import { getFacets } from './lib/facets.js';
import { getHighlight } from './lib/highlight.js';
import { getPagination } from './lib/pagination.js';
import { getTableAndSort } from './lib/sort.js';
import { pick } from './lib/utils.js';

const client = new Client();
client.connect();

export const getSearchHandler = (configs?: HandlerConfigs) => (
  req: GenericReq,
  res: GenericRes
) => {
  searchHandler(req, res, configs);
};

/**
 * Search handler
 */

export async function searchHandler(
  req: GenericReq,
  res: GenericRes,
  configs: HandlerConfigs = []
) {
  /**
   * Validate payload
   */

  const json = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const parsed = initialValidation(json);

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
    // Get the user config for the indexName
    const config = configs?.find((config) => config.indexName === indexName);
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

const handleRequest = async (
  request: RequestSchemaInitial,
  config?: HandlerConfig
): Promise<SearchResponse> => {
  const start = performance.now();

  console.log({ request });

  /**
   * Validate
   */

  // Merge the user's config.clientValidation & default clientValidation
  const clientValidation = {
    ...defaultClientValidation,
    ...config?.clientValidation,
  };
  // Validate the request against clientValidation parameters
  const parsed = validatePayload(request, clientValidation);
  // If invalid, return error
  if (!parsed.success) {
    // console.error(parsed.error.issues);
    throw parsed.error;
  }
  // Merge the user's config.settings & default settings
  const settings = { ...defaultSettings, ...config?.settings };

  /**
   * Define constants and merge settings with params
   */

  const { indexName, params } = request;
  const { query } = params;
  const settingsWithParams = { ...settings, ...params };

  console.log({ params });

  /**
   * Lib functions
   */

  const { table, formattedSort } = getTableAndSort(indexName);

  const columns = getColumns(
    params.attributesToRetrieve || settings.attributesToRetrieve
  );

  const pagination = getPagination(
    pick(settingsWithParams, ['page', 'hitsPerPage', 'length', 'offset'])
  );

  const facets = await getFacets(
    pick(settingsWithParams, [
      'facetFilters',
      'numericFilters',
      'facets',
      'attributesForFaceting',
      'maxValuesPerFacet',
      'sortFacetValuesBy',
      'numericAttributesForFiltering',
      'maxFacetHits',
    ])
  );

  const highlight = getHighlight(
    pick(settingsWithParams, [
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
        ${facets?.db.whereFormatted ? ` AND ${facets?.db.whereFormatted}` : ``}
        -- LIMIT 10000
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
    -- Step 3: Get the counts for each facet
    --
    ${
      facets.db.selectFormatted?.cte ? `, ${facets.db.selectFormatted.cte}` : ''
    }
    --
    -- Step 4: Return it all as a JSON object
    -- 4a. totalHits and hits are always returned
    -- 4b. facets are only returned if there are facets in the query
    --     and are nested in a JSON object
    --
    SELECT json_build_object(
      'totalHits', ( SELECT count(*) FROM all_selection ),
      'hits', jsonb_agg(hits_selection.*)::jsonb
      ${
        facets.db.selectFormatted?.json
          ? `, ${facets.db.selectFormatted.json}`
          : ''
      }
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
  const { hits, totalHits, facets: dbFacets } = result.rows[0].json;

  /**
   * Update results
   */

  const timeTaken = Math.ceil(performance.now() - start);

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
    processingTimeMS: timeTaken,
    ...(settings.renderingContent && {
      renderingContent: settings.renderingContent,
    }),
    index: indexName,
    query: query || '',
    params: Array.isArray(params)
      ? new URLSearchParams(params).toString()
      : params.toString(),
    exhaustiveFacetsCount: true,
    exhaustiveNbHits: true,
  };
};

export * from './client.js';
