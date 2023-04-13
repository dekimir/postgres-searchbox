import jest from 'jest-mock';

import { make_client } from '../client.js';

/**
 * Test the client
 */

describe('client', () => {

  it('should return results: mock', async () => {

    // keep a copy of fetch
    const nodeFetch = fetch;

    const mockResponse = {
      body: {
        results: [{
          hits: [{
            description: 'test',
            id: 1,
            name: 'test',
            postgres_searchbox_v1_doc: "'coalesc':1,3 'descript':4 'name':2",
          },],
        },], query: 'test',
      }
    }

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })
    );


    const client = make_client('http://localhost:3000/api/search');

    const results = await client.search([
      {
        indexName: 'test_table',
        params: { query: 'test', },
      },
    ]);
    expect(results).toEqual(mockResponse);

    // Restore the original fetch
    global.fetch = nodeFetch;
  });




}, 20_000);