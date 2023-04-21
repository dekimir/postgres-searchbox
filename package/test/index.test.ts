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
 * Although /scripts are imported here they are not being tested
 * they're used to set the database state for the tests
 */

describe('requestHandler', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 150, fakerSeed: 123 };

  const defaultExpectedResult = {
    index: tableName,
    hitsPerPage: 20,
    page: 0,
    nbHits: expect.any(Number),
    nbPages: expect.any(Number),
    hits: expect.any(Array),
    serverTimeMS: expect.any(Number),
    processingTimeMS: expect.any(Number),
    query: expect.any(String),
    params: expect.any(Object),
    exhaustive: {
      facetsCount: true,
      nbHits: true,
      typo: true,
    },
    exhaustiveFacetsCount: true,
    exhaustiveNbHits: true,
    exhaustiveTypo: true,
  };

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

    const query = 'bespoke keyboard';

    const req = {
      body: {
        requests: [{ params: { query }, indexName: tableName }],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      results: [
        {
          ...defaultExpectedResult,
          nbHits: 4,
          nbPages: 1,
          params: req.body.requests[0].params,
          query: req.body.requests[0].params.query,
        },
      ],
    });

    // Test hits contained expected object
    expect(res.json.mock.calls[0][0].results[0].hits[0]).toMatchSnapshot();
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
    const req_1 = {
      body: { requests: [{ params: params_1, indexName: tableName }] },
    };
    await searchHandler(req_1, res);

    const expected = {
      results: [
        {
          ...defaultExpectedResult,
          nbHits: 25,
          nbPages: 2,
        },
      ],
    };
    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expected);

    /**
     * Page 2
     */

    const params_2 = { query: 'good', page: 1 };
    const req_2 = {
      body: { requests: [{ params: params_2, indexName: tableName }] },
    };
    await searchHandler(req_2, res);

    expected.results[0].page = 1;
    expect(res.json).toHaveBeenCalledWith(expected);
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
      body: {
        requests: [
          { params: { query: 'good', page: 3 }, indexName: tableName },
        ],
      },
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      results: [
        {
          ...defaultExpectedResult,
          hits: [],
          page: 3,
          nbHits: 25,
          nbPages: 2,
        },
      ],
    });
  });

  /**
   * Test excessive pagination returns 400
   */

  it('should return 400', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    // Spy on console.log so errors don't pollute the test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        requests: [
          { params: { query: 'good', page: 200 }, indexName: tableName },
        ],
      },
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(consoleSpy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Request contained invalid payload',
    });

    const req2 = {
      body: {
        requests: [
          {
            params: { query: '', offset: 2500, length: 2500 },
            indexName: tableName,
          },
        ],
      },
    };
    await searchHandler(req2, res);

    expect(consoleSpy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
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

    const indexName = `${tableName}?sort=price+asc,name+asc`;
    const indexName2 = `${tableName}?sort=price+desc`;

    const req = {
      body: {
        requests: [
          {
            params: { query: 'good', page: 0 },
            indexName,
          },
          {
            params: { query: 'good', page: 0 },
            indexName: indexName2,
          },
        ],
      },
    };
    await searchHandler(req, res);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      results: [
        {
          ...defaultExpectedResult,
          index: indexName,
          nbHits: 25,
        },
        {
          ...defaultExpectedResult,
          index: indexName2,
          nbHits: 25,
        },
      ],
    });

    // Test hits are sorted by price asc
    const hits = res.json.mock.calls[0][0].results[0].hits;
    const prices: number[] = hits.map((hit: { price: number }) => hit.price);
    expect(prices).toEqual(prices.sort((a, b) => a - b));

    // Test hits are sorted by price desc
    const hits2 = res.json.mock.calls[0][0].results[1].hits;
    const prices2: number[] = hits2.map((hit: { price: number }) => hit.price);
    expect([...prices2]).toEqual(prices2.sort((a, b) => b - a));
  });

  it('should handle returning columns', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        requests: [
          {
            params: {
              query: 'football',
              attributesToRetrieve: ['name', 'description'],
            },
            indexName: tableName,
          },
        ],
      },
    };
    await searchHandler(req, res, [
      {
        indexName: tableName,
        clientValidation: {
          validAttributesToRetrieve: ['name', 'description'],
        },
      },
    ]);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();

    const hits = res.json.mock.calls[0][0].results[0].hits;

    // All hist should only have properties name and description
    hits.forEach((hit: any) => {
      expect(Object.keys(hit)).toEqual(['name', 'description']);
    });

    /**
     * Invalid columns
     */

    // Spy on console.log so errors don't pollute the test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await searchHandler(req, res, [
      { indexName: tableName, settings: { attributesToRetrieve: ['name'] } },
    ]);

    // It should have returned an error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Request caused an error',
    });
    expect(consoleSpy).toBeCalledTimes(1);
  });

  it('should handle highlighting', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        requests: [
          {
            params: {
              query: 'bespoke keyboard',
              page: 0,
              highlightPreTag: '__ais-highlight__',
              highlightPostTag: '__/ais-highlight__',
              attributesToHighlight: ['name', 'description'],
            },
            indexName: tableName,
          },
        ],
      },
    };
    await searchHandler(req, res, [
      {
        indexName: tableName,
        clientValidation: {
          validAttributesToHighlight: ['name', 'description'],
        },
      },
    ]);

    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();

    const hits = res.json.mock.calls[0][0].results[0].hits;

    // It should have highlighted both of the query terms
    // in the name and description
    expect(hits[0]).toMatchSnapshot();

    /**
     * Invalid columns
     */

    await searchHandler(req, res, [
      {
        indexName: tableName,
        clientValidation: {
          validAttributesToHighlight: ['name'],
        },
      },
    ]);

    // It should have returned an error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Request contained invalid payload',
    });
  });

  it.only('should return facets on request with empty query and handle filter', async () => {
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Facets must be in the request body
    const req = {
      body: {
        requests: [
          {
            params: {
              query: '',
              facets: ['brand', 'price'],
              // numericFilters: [],
              numericFilters: ['price<5', 'price>=10', 'price<=20'],
            },
            indexName: tableName,
          },
          // {
          //   params: {
          //     query: 'ball',
          //     page: 0,
          //     facets: [],
          //     numericFilters: ['price>=7500', 'price<=10000'],
          //   },
          //   indexName: `${tableName}?sort=price+asc`,
          // },
        ],
      },
    };

    await searchHandler(req, res, [
      {
        indexName: tableName,
        settings: {
          numericAttributesForFiltering: ['price'],
        },
        clientValidation: {
          validAttributesToHighlight: ['name', 'description'],
          validFacetFilters: ['brand', 'price'],
        },
      },
    ]);

    return;

    // // Request1
    // const results = res.json.mock.calls[0][0].results;
    // expect(results[0].facets).toMatchSnapshot();

    // // Request2
    // const hits = results[1].hits;
    // expect(res.status).toHaveBeenCalledWith(200);
    // expect(hits.length).toBeGreaterThanOrEqual(2);
    // expect(hits[0].price).toBe(7636);
    // expect(hits[1].price).toBe(9140);
  });
});
