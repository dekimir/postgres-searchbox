import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Scripts
import { initTestDatabase } from '@scripts/mock-data.js';
import { createColumnAndIndex } from '@scripts/create-index.js';
// Lib
import { getAttributes } from '@/lib/attributes.js';

/**
 * Test attributes
 */

describe('attributes', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100, fakerSeed: 123 };

  const client = new Client();
  client.connect();

  beforeEach(async () => {
    // Not all tests use the database so don't drop the table here
    // like in other test files
  });

  afterAll(async () => {
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
    await client.end();
  });

  it('should return workingSQL fragments', async () => {
    // Drop the table so that the tests can be run independently
    const dropSql = format(`DROP TABLE IF EXISTS %I`, tableName);
    await client.query(dropSql);
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const attributes = await getAttributes({
      table: tableName,
      client,
      attributesForFaceting: ['*'],
      numericAttributesForFiltering: ['*'],
    });

    attributes?.new.forEach(([key, value]) => {
      expect(typeof key).toBe('string');
      // value should be an array of strings
      expect(Array.isArray(value)).toBe(true);
      value.forEach((v) => {
        expect(typeof v).toBe('string');
      });
    });
  });
});
