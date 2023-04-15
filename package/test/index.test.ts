import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Scripts
import { initTestDatabase } from '@scripts/mock-data.js';
import { createColumnAndIndex } from '@scripts/create-index.js';
// Main functions
import { searchHandler } from '@/index.js';

/**
 * This file is for testing the server side functions
 * Although /scripts are imported here thay are not being tested
 * they're used to set the database state for the tests
 */

describe('requestHandler', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100, fakerSeed: 123 };

  const client = new Client();
  client.connect();

  beforeEach(async () => {
    // Drop the table so that the tests can be run independently
    const dropSql = format(`DROP TABLE IF EXISTS %I`, tableName);
    await client.query(dropSql);
  });

  afterAll(async () => {
    const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    await client.query(dropSql);
    await client.end();
  });

  /**
   * Test handler returns results
   */

  it('should return results', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const query = 'affordable keyboard';

    const req = {
      body: JSON.stringify({ params: { query }, indexName: tableName }),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      query,
      results: [
        {
          hits: expect.any(Array),
          hitsPerPage: 20,
          page: 0,
          nbHits: 1,
          nbPages: 1,
        },
      ],
    });

    const expectedResult = {
      id: 4,
      name: 'Bespoke Cotton Keyboard',
      description:
        'The Apollotech B340 is an affordable wireless mouse with reliable connectivity, 12 months battery life and modern design',
      price: 8026,
    };
    // Test hits contained expected object
    expect(res.json.mock.calls[0][0].results[0].hits).toContainEqual(
      expectedResult
    );
  });

  it('should return multiple pages', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    /**
     * Page 1
     */

    const params_1 = { query: 'good', page: 0 };
    const req_1 = { body: { params: params_1, indexName: tableName } };
    await searchHandler(req_1, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      query: params_1.query,
      results: [
        {
          hits: expect.any(Array),
          hitsPerPage: 20,
          page: 0,
          nbHits: 23,
          nbPages: 2,
        },
      ],
    });

    /**
     * Page 2
     */

    const params_2 = { query: 'good', page: 1 };
    const req_2 = { body: { params: params_2, indexName: tableName } };
    await searchHandler(req_2, res);

    expect(res.json).toHaveBeenCalledWith({
      query: params_1.query,
      results: [
        {
          hits: expect.any(Array),
          hitsPerPage: 20,
          page: 1,
          nbHits: 23,
          nbPages: 2,
        },
      ],
    });
  }, 10_000);

  /**
   * Test page that's out of range
   */

  it('should return empty array', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: { params: { query: 'good', page: 3 }, indexName: tableName },
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      query: req.body.params.query,
      results: [
        {
          hits: [],
          hitsPerPage: 20,
          page: 3,
          nbHits: 23,
          nbPages: 2,
        },
      ],
    });
  });

  /**
   * Test sorting by column
   */

  it('should sort by column', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        params: { query: 'good', page: 0 },
        indexName: `${tableName}?sort=price+asc,name+asc`,
      },
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      query: req.body.params.query,
      results: [
        {
          hits: expect.any(Array),
          hitsPerPage: 20,
          page: 0,
          nbHits: 23,
          nbPages: 2,
        },
      ],
    });

    // Test hits are sorted by price
    const hits = res.json.mock.calls[0][0].results[0].hits;
    const prices: number[] = hits.map((hit: { price: number }) => hit.price);
    expect(prices).toEqual(prices.sort((a, b) => a - b));
  });

  it('should sort by column desc', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        params: { query: 'good', page: 0 },
        indexName: `${tableName}?sort=price+desc`,
      },
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      query: req.body.params.query,
      results: [
        {
          hits: expect.any(Array),
          hitsPerPage: 20,
          page: 0,
          nbHits: 23,
          nbPages: 2,
        },
      ],
    });

    // Test hits are sorted by price
    const hits = res.json.mock.calls[0][0].results[0].hits;
    const prices: number[] = hits.map((hit: { price: number }) => hit.price);
    expect([...prices]).toEqual(prices.sort((a, b) => b - a));
  });
});
