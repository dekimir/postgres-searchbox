import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Relative
import { readyToCreateOrDrop, getTextColumnsFromTable } from './lib.js';
// Constants
import { VECTOR_COLUMN, INDEX_PREFIX } from '../constants.js';

/**
 * Create the vector column and index
 */

export async function createColumnAndIndex({ tableName }) {
  const indexName = `${INDEX_PREFIX}${tableName}`;

  // Constants, these could be passed in as params in future
  const tsVectorLanguage = 'english';

  const client = new Client();
  client.connect();
  // Get column names
  const columnNames = await getTextColumnsFromTable({ tableName });
  // Previously this had an extra || ' ' on the end? Was it needed or a typo?
  const valExpr = columnNames
    .map((c) => format(`COALESCE(%I, '')`, c))
    .join(` || ' ' || `);
  // Add vector column
  const columnSql = format(
    `ALTER TABLE %I ADD COLUMN %I tsvector GENERATED ALWAYS AS (to_tsvector(%L, %s)) STORED;`,
    tableName,
    VECTOR_COLUMN,
    tsVectorLanguage,
    valExpr
  );
  await client.query(columnSql);
  // Create index
  const indexSql = format(
    `CREATE INDEX %I ON %I USING GIN(%I);`,
    indexName,
    tableName,
    VECTOR_COLUMN
  );
  await client.query(indexSql);

  client.end();
}

/**
 * For completeness, drop the vector column and index
 */

export async function dropColumnAndIndex({ tableName }) {
  const indexName = `${INDEX_PREFIX}${tableName}`;

  const client = new Client();
  client.connect();
  // Drop index
  const indexSql = format(`DROP INDEX %I;`, indexName);
  await client.query(indexSql);
  // Drop column
  const columnSql = format(
    `ALTER TABLE %I DROP COLUMN %I;`,
    tableName,
    VECTOR_COLUMN
  );
  await client.query(columnSql);

  client.end();
}

/**
 * Run the script when called from package.json
 */

if (process.env.PG_SB_CREATE_COL_AND_INDEX === 'true') {
  // Check db and table exist - throws if not
  await readyToCreateOrDrop({ tableName: process.env.PG_SB_TABLE_NAME });
  // Can connect to db and table exists, so create index
  await createColumnAndIndex({ tableName: process.env.PG_SB_TABLE_NAME });
  console.log('Created column and index successfully');
}

if (process.env.PG_SB_DROP_COL_AND_INDEX === 'true') {
  // Check db and table exist - throws if not
  await readyToCreateOrDrop({ tableName: process.env.PG_SB_TABLE_NAME });
  // Can connect to db and table exists, so create index
  await dropColumnAndIndex({ tableName: process.env.PG_SB_TABLE_NAME });
  console.log('Dropped column and index successfully');
}
