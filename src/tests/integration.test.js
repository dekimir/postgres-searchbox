import express from 'express';
import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Scripts
import { initTestDatabase } from '../scripts/mock-data.js';
import { createColumnAndIndex } from '../scripts/create-index.js';
// Main functions
import { make_client } from '../client.js';
import { searchHandler } from '../index.js';

/**
 * This file is for testing the integration of server with client.
 * Although /scripts are imported here thay are not being tested
 * they're used to set the database state for the tests
 */

describe('integration', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100, fakerSeed: 123 };

  const client = new Client();
  client.connect();

  let serverListener;

  beforeAll(async () => {
    /**
     * Start an express server with searchHandler on the route /api/search
     */

    const app = express();
    const port = 3002;
    app.use(express.json());

    app.post('/api/search', searchHandler);

    serverListener = app.listen(port);
  });

  beforeEach(async () => {
    // Drop the table so that the tests can be run independently
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
  });

  afterAll(async () => {
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
    await client.end();

    // tairdown express
    await serverListener.close();
  });

  it('should return results: real server', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const client = make_client('http://localhost:3002/api/search');

    const response = await client.search([
      {
        indexName: tableName,
        params: { query: 'affordable keyboard' },
      },
    ]);

    const expectedResult = {
      id: 4,
      name: 'Bespoke Cotton Keyboard',
      description:
        'The Apollotech B340 is an affordable wireless mouse with reliable connectivity, 12 months battery life and modern design',
      price: 8026,
    };

    expect(response.results[0].hits[0]).toEqual(expectedResult);
  });
}, 20_000);
