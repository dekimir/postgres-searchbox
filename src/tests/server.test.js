import jest from 'jest-mock';
import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Scripts
import { initTestDatabase } from './_init-test-database.js';
import {
  getTextColumnsFromTable,
  createColumnAndIndex,
  dropColumnAndIndex,
} from '../scripts/create-index.js';
// Main functions
import { handlerNextJS } from '../index.js';

describe('initTestDatabase', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100 };

  const client = new Client();
  client.connect();

  beforeEach(async () => {
    // Drop the table so that the tests can be run independently
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
  });

  afterAll(async () => {
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
    await client.end();
  });

  /**
   * Test that the test table is created and populated with 100 rows
   */

  it('should create a test table', async () => {
    await initTestDatabase(initTestDatabaseParams);

    // Test the table exists and has 100 rows
    const columnSql = format('SELECT * FROM %I', tableName);
    const data = await client.query(columnSql);
    expect(data.rows.length).toBe(100);
    // Test each row has a name and description of type string and length > 0
    data.rows.forEach((row) => {
      expect(typeof row.name).toBe('string');
      expect(row.name.length).toBeGreaterThan(0);
      expect(typeof row.description).toBe('string');
      expect(row.description.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test that column names are returned
   */

  it('should return column names', async () => {
    await initTestDatabase(initTestDatabaseParams);
    const columnNames = await getTextColumnsFromTable({ tableName });

    expect(columnNames).toEqual(['name', 'description']);
  });

  /**
   * Test that the vector column and index are created
   */

  it('should create the vector column and index', async () => {
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    // Test the vector column exists
    const columnSql = format('SELECT * FROM %I', tableName);
    const data = await client.query(columnSql);
    expect(data.rows[0].postgres_searchbox_v1_doc).toBeDefined();
    // Test that the column has a tsvector value
    // expect(data.rows[0].postgres_searchbox_v1_doc).toBe("'coalesc':1,3 'descript':4 'name':2");

    // Test the index exists
    const indexSql = format(
      'SELECT * FROM pg_indexes WHERE tablename = %L AND indexname = %L',
      tableName,
      'postgres_searchbox_v1_idx_test_table'
    );
    const indexData = await client.query(indexSql);
    expect(indexData.rows.length).toBe(1);
    // Test the index is a gin index
    expect(indexData.rows[0].indexdef).toContain('USING gin');
  });

  /**
   * Test that the vector column and index are deleted
   */

  it('should delete the vector column and index', async () => {
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });
    await dropColumnAndIndex({ tableName });

    // Test the vector column does not exist
    const columnSql = format('SELECT * FROM %I', tableName);
    const data = await client.query(columnSql);
    expect(data.rows[0].postgres_searchbox_v1_doc).toBeUndefined();

    // Test the index does not exist
    const indexSql = format(
      'SELECT * FROM pg_indexes WHERE tablename = %L AND indexname = %L',
      tableName,
      'postgres_searchbox_v1_idx_test_table'
    );
    const indexData = await client.query(indexSql);
    expect(indexData.rows.length).toBe(0);
  });

  /**
   * Test handler returns results
   */

  it('should return results', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const query = 'goalkeeper shirt';

    const req = {
      body: JSON.stringify({ params: { query }, indexName: tableName }),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    await handlerNextJS(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      query,
      results: [{ hits: expect.any(Array) }],
    });

    const expected = {
      id: 15,
      name: 'Shirt',
      description:
        'Carbonite web goalkeeper gloves are ergonomically designed to give easy fit',
      postgres_searchbox_v1_doc:
        "'carbonit':2 'design':8 'easi':11 'ergonom':7 'fit':12 'give':10 'glove':5 'goalkeep':4 'shirt':1 'web':3",
    };
    // Test hits contained expected object
    expect(res.json.mock.calls[0][0].results[0].hits).toContainEqual(expected);
  });
});
