import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Constants
import { MAX_HITS_TOTAL, VECTOR_COLUMN } from './constants.js';
// Types and validation
import {
  GenericReq,
  GenericRes,
  Json,
  DatabaseResult,
  PaginationRes,
  SearchRes,
} from './index.types.js';

const client = new Client();
client.connect();

/**
 * Search handler
 */

export async function searchHandler(req: GenericReq, res: GenericRes) {
  const json = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const parsed = Json.safeParse(json);

  if (!parsed.success) {
    res.status(400).json({ error: 'Request contained an invalid payload' });
    return;
  }

  const { indexName: table, params } = parsed.data;
  const { query } = params;

  /**
   * Pagination
   */

  // TODO Retrieving a subset of records (with offset and length)
  // https://www.algolia.com/doc/guides/building-search-ui/ui-and-ux-patterns/pagination/react-hooks/#retrieving-a-subset-of-records-with-offset-and-length
  const initPaginationRes: Pick<PaginationRes, 'page' | 'hitsPerPage'> = {
    page: params.page || 0,
    hitsPerPage: params.hitsPerPage || 20,
  };

  const paginationParams = {
    offset: initPaginationRes.page * initPaginationRes.hitsPerPage,
    limit: initPaginationRes.hitsPerPage,
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

  const result: DatabaseResult = await client.query(sql);

  const paginationRes: PaginationRes = {
    ...initPaginationRes,
    nbHits: result.rows[0]?.total_hits,
    nbPages: Math.ceil(
      result.rows[0].total_hits / initPaginationRes.hitsPerPage
    ),
  };

  const searchRes: SearchRes = {
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
        ...paginationRes,
      },
    ],
    query,
  };

  res.status(200).json(searchRes);
}

export * from './client.js';
