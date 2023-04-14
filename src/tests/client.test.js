import jest from 'jest-mock';
import { make_client } from '../client.js';

/**
 * Test the client without any server
 */

describe('client', () => {
  it('should return results: mock', async () => {
    // Keep a copy of fetch
    const nodeFetch = fetch;

    try {
      const mockResponse = {
        body: {
          results: [{ hits: [{ description: 'test', id: 1, name: 'test' }] }],
          query: 'test',
        },
      };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const client = make_client('http://localhost:3002/api/search');

      const results = await client.search([
        {
          indexName: 'test_table',
          params: { query: 'test' },
        },
      ]);
      expect(results).toEqual(mockResponse);
    } catch (e) {
      expect(e).toBeNull();
    } finally {
      // Restore the original fetch
      global.fetch = nodeFetch;
    }
  });
});
