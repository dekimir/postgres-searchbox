import express from 'express';
import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format'

import { make_client } from '../client.js';
import { handlerNextJS } from '../index.js';

// Scripts
import { initTestDatabase } from './_init-test-database.js';
import { createColumnAndIndex } from '../scripts/create-index.js';

/**
 * Test the server with client
 */

describe('client', () => {


  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100 };

  const client = new Client()
  client.connect()

  let serverListener;

  beforeAll(async () => {
    // Start the server

    /**
    * Start an express server with handlerNextJS on the route /api/search
    */

    const app = express();
    const port = 3000;
    app.use(express.json());

    app.post('/api/search', handlerNextJS);

    serverListener = app.listen(port);

  })

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

    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const client = make_client('http://localhost:3000/api/search');

    const response = await client.search([
      {
        indexName: tableName,
        params: { query: 'goalkeeper shirt', },
      },
    ]);

    const expectedResult = {
      id: 15,
      name: 'Shirt',
      description: 'Carbonite web goalkeeper gloves are ergonomically designed to give easy fit',
      postgres_searchbox_v1_doc: "'carbonit':2 'design':8 'easi':11 'ergonom':7 'fit':12 'give':10 'glove':5 'goalkeep':4 'shirt':1 'web':3"
    };

    expect(response.results[0].hits[0]).toEqual(expectedResult);


  });

}, 20_000);