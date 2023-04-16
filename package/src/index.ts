import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Constants
import { VECTOR_COLUMN } from './constants.js';
// Types and validation
import {
  GenericReq,
  GenericRes,
  HandlerOptions,
  DatabaseResult,
  SearchRes,
} from './index.types.js';
import { validatePayload } from './index.validation.js';
// Lib
import { getColumns } from './lib/columns.js';
import { getHighlight } from './lib/highlight.js';
import { getPagination } from './lib/pagination.js';
import { getTableAndSort } from './lib/sort.js';

const client = new Client();
client.connect();

export const getSearchHandler =
  (options?: HandlerOptions) => (req: GenericReq, res: GenericRes) => {
    searchHandler(req, res, options);
  };

/**
 * Search handler
 */

export async function searchHandler(
  req: GenericReq,
  res: GenericRes,
  options?: HandlerOptions
) {
  /**
   * Validate payload
   */

  const json = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const parsed = validatePayload(json, options);

  if (!parsed.success) {
    console.error(parsed.error); // TODO maybe put error logs behind a flag
    return res.status(400).json({ error: 'Request contained invalid payload' });
  }

  const { indexName, params, pgOptions: clientOptions } = parsed.data;
  const { query } = params;

  /**
   * Lib functions
   */

  const { table, formatedSort } = getTableAndSort(indexName);
  const columns = getColumns(clientOptions);
  const pagination = getPagination(params);
  const highlight = getHighlight({ params, clientOptions });

  /**
   * Database query
   */

  const sql = format(
    /* sql */ `
    WITH aggregate AS (
      SELECT count(*)::int4 AS total_hits
      FROM %I
      WHERE %I @@ websearch_to_tsquery(%L)
    ), query AS (
      SELECT 
        ${columns.db.formatted}
        ${highlight?.db.formatted ? `, ${highlight?.db.formatted}` : ``}
      FROM %I 
      WHERE %I @@ websearch_to_tsquery(%L) 
      %s
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
    // For sort & pagination
    formatedSort,
    pagination.db.offset,
    pagination.db.limit
  );

  const result: DatabaseResult = await client.query(sql);
  const { hits, total_hits: totalHits } = result.rows[0];

  /**
   * Update results
   */

  const searchRes: SearchRes = {
    results: [
      {
        hits:
          hits?.map((hit) => {
            hit = highlight?.updateHit(hit) || hit;
            return columns.updateHit?.(hit) || hit;
          }) || [],
        ...pagination.updateRes({
          totalHits,
          res: pagination.res,
        }),
      },
    ],
    query,
  };

  res.status(200).json(searchRes);
}

export * from './client.js';
