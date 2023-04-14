import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Constants
import { VECTOR_COLUMN, INDEX_PREFIX } from '@/constants.js';
// Scripts
import { getTextColumnsFromTable } from '@scripts/lib.js';
import { initTestDatabase } from '@scripts/mock-data.js';
import {
  createColumnAndIndex,
  dropColumnAndIndex,
} from '@scripts/create-index.js';

/**
 * This file is just for testing the functions in the scripts folder
 */

describe('scripts', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100, fakerSeed: 123 };

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
   * TODO:
   * Test all of the scripts/lib functions
   * Test the create-movies script
   */

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
    expect(data.rows[0][VECTOR_COLUMN]).toBeDefined();
    // Test that the column has a tsvector value
    // expect(data.rows[0][VECTOR_COLUMN]).toBe("'coalesc':1,3 'descript':4 'name':2");

    // Test the index exists
    const indexSql = format(
      'SELECT * FROM pg_indexes WHERE tablename = %L AND indexname = %L',
      tableName,
      `${INDEX_PREFIX}${tableName}`
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
    expect(data.rows[0][VECTOR_COLUMN]).toBeUndefined();

    // Test the index does not exist
    const indexSql = format(
      'SELECT * FROM pg_indexes WHERE tablename = %L AND indexname = %L',
      tableName,
      `${INDEX_PREFIX}${tableName}`
    );
    const indexData = await client.query(indexSql);
    expect(indexData.rows.length).toBe(0);
  });
});
