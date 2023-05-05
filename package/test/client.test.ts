import { make_client } from '@/client.js';

/**
 * Test the client without any server
 */

describe('client', () => {
  it('should return results: mock', async () => {
    // This url should not be hit, because it fetch has been hijacked by jest.spyOn
    // Regardless, use a port that's out of range to ensure no conflicts with running services
    const url = 'http://localhost:77777777/api/search';

    try {
      const mockResponse = {
        body: {
          results: [{ hits: [{ description: 'test', id: 1, name: 'test' }] }],
          query: 'test',
        },
      };

      jest.spyOn(global, 'fetch').mockImplementation(
        jest.fn((reqUrl) =>
          Promise.resolve({
            // Verify url
            ok: reqUrl === url,
            json: () => Promise.resolve(mockResponse),
          })
        ) as jest.Mock
      );

      const client = make_client(url);

      const results = await client.search([
        {
          indexName: 'test_table',
          params: { query: 'test' },
        },
      ]);
      expect(results).toEqual(mockResponse);
    } catch (e) {
      console.error(e);
      expect(e).toBeNull();
    }
  });
});
