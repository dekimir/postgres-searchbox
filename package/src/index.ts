import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Constants
import { MAX_HITS_TOTAL, VECTOR_COLUMN } from './constants.js';
// Types and validation
import {
  GenericReq,
  GenericRes,
  DatabaseResult,
  SearchRes,
} from './index.types.js';
import { Json } from './index.validation.js';
// Lib
import { getPagination } from './lib/pagination.js';
import { getTableAndSort } from './lib/sort.js';
import { getHighlight } from './lib/highlight.js';

const client = new Client();
client.connect();

/**
 * Search handler
 */

export async function searchHandler(req: GenericReq, res: GenericRes) {
  const json = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const parsed = Json.safeParse(json);

  if (!parsed.success) {
    console.error(parsed.error);
    res.status(400).json({ error: 'Request contained an invalid payload' });
    return;
  }

  const { indexName, params, pgOptions } = parsed.data;
  const { query } = params;

  // Parse index name to get table and sort
  const { table, formatedSort } = getTableAndSort(indexName);
  // Pagination
  const pagination = getPagination(params);
  // Higlight
  const highlight = getHighlight({
    params,
    highlightColumns: pgOptions?.highlightColumns,
  });

  if (pagination.db.offset + pagination.db.limit > MAX_HITS_TOTAL) {
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
      SELECT 
        *
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
    // For highlighted
    // For hits
    table,
    VECTOR_COLUMN,
    query,
    // For sort
    formatedSort,
    // For pagination
    pagination.db.offset,
    pagination.db.limit
  );

  const result: DatabaseResult = await client.query(sql);

  const searchRes: SearchRes = {
    results: [
      {
        // Remove the vector column here because there is no easy way to do
        // SELECT * and exclude a column.
        // The alternatives to this is  have the req contian the column names
        // to return and pass them to the database query.
        hits:
          result.rows[0].hits?.map((hit) =>
            Object.fromEntries(
              // if higlight is enabled then update the hit
              Object.entries(highlight?.updateHit(hit) || hit).filter(
                // return all properties except the vector column
                ([key]) => key !== VECTOR_COLUMN
              )
            )
          ) || [],
        ...pagination.updateRes({
          res: pagination.res,
          totalHits: result.rows[0]?.total_hits,
        }),
      },
    ],
    query,
  };

  res.status(200).json(searchRes);
}

export * from './client.js';
