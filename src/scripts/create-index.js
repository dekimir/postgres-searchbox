import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format'

/**
 * Helper functions so we can return meaningful error messages
 */

export const canConnectToDatabase = async () => {
    const client = new Client()
    client.connect()
    const sql = format('SELECT 1');

    try {
        const results = await client.query(sql);
        if (!results.rows.length) return false
        return true;
    } catch (error) {
        return false;
    } finally {
        client.end();
    }
}

export const tableExists = async ({ tableName }) => {
    const client = new Client()
    client.connect()
    const sql = format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %L)', tableName);
    try {
        const results = await client.query(sql);
        if (!results.rows.length) return false
        return true;
    } catch (error) {
        return false;
    } finally {
        client.end();
    }
}

/**
 * Get text columns from a table
 */

export async function getTextColumnsFromTable({ tableName }) {
    const client = new Client()
    client.connect()
    const sql = format('SELECT column_name FROM information_schema.columns WHERE table_name = %L AND data_type = %L', tableName, 'text');
    const data = await client.query(sql);
    client.end();
    return data.rows.map(row => row.column_name);
}

/**
 * Create the vector column and index
 */

export async function createColumnAndIndex({ tableName }) {
    // Constants, these could be passed in as params in future
    const vectorColumnName = 'postgres_searchbox_v1_doc';
    const tsVectorLanguage = 'english';
    const indexName = `postgres_searchbox_v1_idx_${tableName}`;

    const client = new Client()
    client.connect()
    // Get column names
    const columnNames = await getTextColumnsFromTable({ tableName });
    // Previously this had an extra || ' ' on the end? Was it needed or a typo?
    const valExpr = columnNames.map(c => format(`COALESCE(%I, '')`, c)).join(` || ' ' || `)
    // Add vector column
    const columnSql = format(`ALTER TABLE %I ADD COLUMN %I tsvector GENERATED ALWAYS AS (to_tsvector(%L, %s)) STORED;`, tableName, vectorColumnName, tsVectorLanguage, valExpr);
    await client.query(columnSql);
    // Create index
    const indexSql = format(`CREATE INDEX %I ON %I USING GIN(%I);`, indexName, tableName, vectorColumnName);
    await client.query(indexSql);

    client.end();
}

/**
 * For completeness, drop the vector column and index
 */

export async function dropColumnAndIndex({ tableName }) {
    // Constants, these could be passed in as params in future

    const vectorColumnName = 'postgres_searchbox_v1_doc';
    const indexName = `postgres_searchbox_v1_idx_${tableName}`;

    const client = new Client()
    client.connect()
    // Drop index
    const indexSql = format(`DROP INDEX %I;`, indexName);
    await client.query(indexSql);
    // Drop column
    const columnSql = format(`ALTER TABLE %I DROP COLUMN %I;`, tableName, vectorColumnName);
    await client.query(columnSql);

    client.end();
}

/**
 * Run the script when called from package.json
 */

if (process.env.PG_SB_CREATE_INDEX === 'true') {

    if (!process.env.PG_SB_TABLE_NAME?.length) {
        throw Error('Did you dorget to set PG_SB_TABLE_NAME?. Try running `PG_SB_TABLE_NAME=table_name yarn run script:make-index`');
    }
    if (!(await canConnectToDatabase())) throw Error('Could not connect to database');
    if (!(await tableExists({ tableName: process.env.PG_SB_TABLE_NAME }))) throw Error('Table does not exist');
    // Can connect to db and table exists, so create index
    await createColumnAndIndex({ tableName: process.env.PG_SB_TABLE_NAME });
    console.log('Created column and index successfully');

}

if (process.env.PG_SB_DROP_INDEX === 'true') {

    if (!process.env.PG_SB_TABLE_NAME?.length) {
        throw Error('Did you dorget to set PG_SB_TABLE_NAME?. Try running `PG_SB_TABLE_NAME=table_name yarn run script:drop-index`');
    }
    if (!await canConnectToDatabase()) throw Error('Could not connect to database');
    if (!await tableExists({ tableName: process.env.PG_SB_TABLE_NAME })) throw Error('Table does not exist');
    // Can connect to db and table exists, so create index
    await dropColumnAndIndex({ tableName: process.env.PG_SB_TABLE_NAME });
    console.log('Dropped column and index successfully');

}