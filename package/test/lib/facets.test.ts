import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
// Scripts
import { initTestDatabase } from '@scripts/mock-data.js';
import { createColumnAndIndex } from '@scripts/create-index.js';
// Lib
import { getFacets } from '@/lib/facets.js';
// Constants
import { defaults } from '@/constants.js';

/**
 * Test facets
 */

describe('facets', () => {
  const tableName = 'test_table';
  const initTestDatabaseParams = { tableName, rowCount: 100, fakerSeed: 123 };

  const client = new Client();
  client.connect();

  beforeEach(async () => {
    // Not all tests use the database so don't drop the table here
    // like in other test files
  });

  afterAll(async () => {
    // const dropSql = format('DROP TABLE IF EXISTS %I', tableName);
    // await client.query(dropSql);
    await client.end();
  });

  it('should return workingSQL fragments', async () => {
    // Drop the table so that the tests can be run independently
    const dropSql = format(`DROP TABLE IF EXISTS %I`, tableName);
    await client.query(dropSql);
    // Prerequisites
    await initTestDatabase(initTestDatabaseParams);
    await createColumnAndIndex({ tableName });

    const facets = await getFacets({
      ...defaults.settings,
      facets: ['brand', 'price'],
      numericAttributesForFiltering: ['price'],
    });

    const { cte, statsCte, json, statsJson } = facets?.db || {};

    expect(typeof cte).toBe('string');
    expect(typeof statsCte).toBe('string');
    expect(typeof json).toBe('string');
    expect(typeof statsJson).toBe('string');

    /**
     * Minimal example of the main SQL query in index.ts
     */

    const formattedSql = format(
      /* sql */ `(
      -- Step 1: Get all results
      WITH all_selection AS (
        SELECT * FROM %I
      ),
      hits_selection AS (
        SELECT * FROM all_selection LIMIT 10
      ),
      -- Step 2: Get the counts for each facet
      ${cte},
      -- Step 3: Get facets_stats on numeric attributes
      ${statsCte}
      -- Step 4: Return it all as a JSON object
      SELECT json_build_object(
        'totalHits', ( SELECT count(*) FROM all_selection ),
        'hits', jsonb_agg(hits_selection.*)::json,
        ${json},
        ${statsJson}
      ) AS "json"
      FROM hits_selection
    )`,
      tableName
    );

    // console.log(formattedSql);

    const result = await client.query(formattedSql);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].json.totalHits).toBe(100);
    expect(result.rows[0].json.hits).toHaveLength(10);
    expect(result.rows[0].json.facets.brand).toMatchSnapshot();
    expect(result.rows[0].json.facets.price).toMatchSnapshot();
    expect(result.rows[0].json.facets_stats.price).toMatchSnapshot();
  });
});
