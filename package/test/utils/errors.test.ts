import validate from '@/index.validation.js';
import { getClient, getPublicError } from '@/utils/index.js';

describe('utils test suite', () => {
  it('should return readable zod errors', () => {
    // Trigger a fail of a zod validation
    const parsed = validate.initial({ requests: [] });

    if (parsed.success) {
      return expect(parsed.success).toBeFalsy();
    }

    const publicError = getPublicError(parsed.error);

    expect(publicError).toEqual([
      {
        code: 'too_small',
        path: ['requests'],
        message: 'Array must contain at least 1 element(s)',
      },
    ]);
  });

  it('should obfuscate database errors', async () => {
    const client = getClient();

    // Make a database call
    try {
      await client.query('SELECT * FROM non_existent_table');
    } catch (error) {
      const publicError = getPublicError(error);
      expect(publicError).toEqual({
        message:
          'There was a database error when running the query. ' +
          'Check server logs for more information',
      });
    } finally {
      client.end();
    }
  });

  it('should obfuscate server errors', () => {
    const publicError = getPublicError(new Error('test error'));

    expect(publicError).toEqual({
      message:
        'A server-side error was thrown. It was not directly thrown by ' +
        'validation or the database query. Check server logs for more information',
    });
  });
});
