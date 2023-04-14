import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
import { z } from 'zod';
// Constants
import {
  MAX_HITS_PER_PAGE,
  MAX_PAGES,
  MAX_HITS_TOTAL,
  VECTOR_COLUMN,
} from './constants.js';

const client = new Client();
client.connect();

/**
 * Input validation with zod
 */

const SearchParams = z.object({
  query: z.string(),
  // Optional pagination params
  page: z.number().gte(0).lte(MAX_PAGES).optional(),
  hitsPerPage: z.number().gte(1).lte(MAX_HITS_PER_PAGE).optional(),
  // Unused params
  facets: z.array(z.string()).optional(),
  highlightPostTag: z.string().optional(),
  highlightPreTag: z.string().optional(),
  tagFilters: z.string().optional(),
});

const Json = z.object({
  params: SearchParams,
  indexName: z.string(),
});

/**
 * Search handler
 */

export async function searchHandler(req, res) {
  const json = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const { success, data } = Json.safeParse(json);

  if (!success) {
    res.status(400).json({ error: 'Request contained an invalid payload' });
    return;
  }

  const { indexName: table, params } = data;
  const { query } = params;

  /**
   * Pafination
   */

  const paginationResponse = {
    page: params.page || 0,
    hitsPerPage: params.hitsPerPage || 20,
    // This will be mutated later
  };

  const paginationParams = {
    offset: paginationResponse.page * paginationResponse.hitsPerPage,
    limit: paginationResponse.hitsPerPage,
  };

  if (paginationParams.offset + paginationParams.limit > MAX_HITS_TOTAL) {
    res.status(400).json({ error: 'Pagination parameters exceed maximum' });
    return;
  }

  const sql = format(
    /* sql */ `
    WITH aggregate AS (
      SELECT count(*)::int4 AS total_hits
      FROM %I
      WHERE %I @@ websearch_to_tsquery(%L)
    ), query AS (
      SELECT *
      FROM %I 
      WHERE %I @@ websearch_to_tsquery(%L) 
      OFFSET %s 
      LIMIT %s
    )
    SELECT 
      (SELECT * FROM aggregate) AS total_hits,
      jsonb_agg(query.*)::jsonb AS hits
    FROM query
    `,
    // For total_hits
    table,
    VECTOR_COLUMN,
    query,
    // For hits
    table,
    VECTOR_COLUMN,
    query,
    paginationParams.offset,
    paginationParams.limit
  );

  const result = await client.query(sql);

  paginationResponse.nbHits = result.rows[0]?.total_hits;
  paginationResponse.nbPages = Math.ceil(
    result.rows[0].total_hits / paginationResponse.hitsPerPage
  );

  res.status(200).json({
    results: [
      {
        // Remove the vector column here because there is no easy way to do
        // SELECT * and exclude a column.
        // The alternatives to this is  have the req contian the column names
        // to return and pass them to the database query.
        hits:
          result.rows[0].hits?.map((row) =>
            // return all properties except the vector column
            Object.fromEntries(
              Object.entries(row).filter(([key]) => key !== VECTOR_COLUMN)
            )
          ) || [],
        ...paginationResponse,
      },
    ],
    query,
  });
}

export * from './client.js';
