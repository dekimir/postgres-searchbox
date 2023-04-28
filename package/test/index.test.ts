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
    facets: expect.any(Object),
    facets_stats: expect.any(Object),
    processingTimeMS: expect.any(Number),
    query: expect.any(String),
    params: expect.any(String),
    exhaustiveFacetsCount: true,
    exhaustiveNbHits: true,
    renderingContent: expect.any(Object),
  };

  const client = new Client();
  client.connect();

  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };

  let consoleSpy: jest.SpyInstance | undefined;

  const dropTables = async () => {
    // Drop the tables so that the tests can be run independently
    await client.query(format(`DROP TABLE IF EXISTS %I`, tableName));
  };

  afterEach(async () => {
    res.json.mockClear();
    res.status.mockClear();
    consoleSpy?.mockRestore?.();
  });

  beforeEach(async () => {
    await dropTables();
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });
  });

  afterAll(async () => {
    await dropTables();
    await client.end();
  });

  /**
   * Test handler returns results
   */

  it('should return results', async () => {
    const query = 'bespoke keyboard';

    const req = {
      body: {
        requests: [{ params: { query }, indexName: tableName }],
      },
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
          params: new URLSearchParams(req.body.requests[0].params).toString(),
          query: req.body.requests[0].params.query,
        },
      ],
    });

    // Test hits contained expected object
    expect(res.json.mock.calls[0][0].results[0].hits[0]).toMatchSnapshot();
  });

  it('should return multiple pages', async () => {
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

  it('should paginate with offset param', async () => {
    const req_1 = {
      body: {
        requests: [
          {
            params: { query: 'good', offset: 10, length: 10 },
            indexName: tableName,
          },
          // Without length, uses a default value
          { params: { query: 'good', offset: 10 }, indexName: tableName },
        ],
      },
    };
    await searchHandler(req_1, res);

    const expected = {
      results: [
        {
          ...defaultExpectedResult,
          length: 10,
          offset: 10,
          nbPages: 2,
        },
        {
          ...defaultExpectedResult,
          length: 20,
          offset: 10,
          nbPages: 2,
        },
      ],
    };
    // Test status and json are called
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expected);
  }, 10_000);

  /**
   * Test page that's out of range
   */

  it('should return empty array', async () => {
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

  it('should return 400 on excessive pagination', async () => {
    // Spy on console.log so errors don't pollute the test output
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await searchHandler(req, res, [
      {
        indexName: tableName,
        clientValidation: {
          validAttributesToRetrieve: ['name'],
        },
      },
    ]);

    // It should have returned an error
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Request contained invalid payload',
    });
    expect(consoleSpy).toBeCalledTimes(1);
  });

  it('should handle highlighting', async () => {
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

    consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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
    expect(consoleSpy).toBeCalledTimes(1);
  });

  it('should return facets on request with empty query', async () => {
    // Facets must be in the request body
    const req = {
      body: {
        requests: [
          {
            params: {
              query: '',
              facets: ['brand', 'price'],
              numericFilters: [],
            },
            indexName: tableName,
          },
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

    const results = res.json.mock.calls[0][0].results;
    expect(results[0].facets).toMatchSnapshot();
    expect(results[0].facets_stats).toMatchSnapshot();
  });

  it('should handle filter', async () => {
    const req = {
      body: {
        requests: [
          {
            params: {
              query: '',
              facetFilters: ['brand:Jacobi LLC', 'brand:-test'],
            },
            indexName: tableName,
          },
          {
            params: {
              query: 'ball',
              numericFilters: ['price>=10', 'price<=20'],
            },
            indexName: `${tableName}?sort=price+asc`,
          },
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
          validFacetFilters: ['brand', 'price'],
        },
      },
    ]);

    // Request1
    const results = res.json.mock.calls[0][0].results;
    expect(results[0].hits[0].brand).toBe('Jacobi LLC');

    // Request2
    const hits = results[1].hits;
    expect(res.status).toHaveBeenCalledWith(200);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    // expect all hits to be between 10 and 20
    hits.forEach((hit: any) => {
      expect(hit.price).toBeGreaterThanOrEqual(10);
      expect(hit.price).toBeLessThanOrEqual(20);
    });
  });

  it('should handle a facet search', async () => {
    const req = {
      body: {
        requests: [
          {
            params: { query: '', facetQuery: 'jac' },
            indexName: tableName,
            type: 'facet',
            facet: 'brand',
          },
        ],
      },
    };

    await searchHandler(req, res);

    const results = res.json.mock.calls[0][0].results;

    expect(results[0].facetHits.length).toBe(4);
    results[0].facetHits.forEach((facetHit: any) => {
      expect(facetHit.brand).toMatch(/Jac/);
      expect(facetHit.count).toBeGreaterThanOrEqual(1);
      expect(facetHit.highlighted).toMatch(
        /__ais-highlight__Jac__\/ais-highlight__/
      );
    });
  });
});
