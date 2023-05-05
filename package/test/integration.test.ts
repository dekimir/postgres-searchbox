import express from 'express';
import type { Server } from 'http';
import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Scripts
import { initTestDatabase } from '@scripts/mock-data.js';
import { createColumnAndIndex } from '@scripts/create-index.js';
// Main functions
import { make_client } from '@/client.js';
import { getSearchHandler } from '@/index.js';

/**
 * This file is for testing the integration of server with client.
 * Although /scripts are imported here they are not being tested
 * they're used to set the database state for the tests.
 */

describe('integration', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100, fakerSeed: 123 };

  const client = new Client();
  client.connect();

  let serverListener: Server;

  beforeAll(async () => {
    /**
     * Start an express server with searchHandler on the route /api/search
     */

    const app = express();
    const port = 3002;
    app.use(express.json());

    app.post('/api/search', getSearchHandler());
    app.post(
      '/api/search-with-options',
      getSearchHandler([
        {
          indexName: tableName,
          settings: {
            attributesToRetrieve: ['id', 'name', 'description', 'price'],
          },
          clientValidation: {
            validAttributesToRetrieve: ['id', 'name', 'description', 'price'],
            validAttributesToHighlight: ['name', 'description'],
          },
        },
      ])
    );

    serverListener = app.listen(port);
  });

  beforeEach(async () => {
    // Drop the table so that the tests can be run independently
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
  });

  afterAll(async () => {
    // Teardown express
    await serverListener.close();
    // Drop and close the database connection
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
    await client.end();
  });

  it('should return results from real server: no options', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const client = make_client('http://localhost:3002/api/search');

    const response = await client.search([
      {
        indexName: tableName,
        params: { query: 'designed keyboard' },
      },
    ]);

    expect(response.results[0].hits[0]).toMatchSnapshot();
  });

  it('should return results from real server: with options', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const client = make_client('http://localhost:3002/api/search-with-options');

    const response = await client.search([
      {
        indexName: tableName,
        params: {
          query: 'designed keyboard',
          highlightPreTag: '__ais-highlight__',
          highlightPostTag: '__/ais-highlight__',
          attributesToHighlight: ['name', 'description'],
        },
      },
    ]);

    expect(response.results[0].hits[0]).toMatchSnapshot();
  });
});
