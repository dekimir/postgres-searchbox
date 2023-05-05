import { DatabaseError } from 'pg';
import type { ZodError } from 'zod';

/**
 * Errors
 */

const isZodError = (error: any): error is ZodError => {
  return error?.name === 'ZodError';
};

export const getPublicError = (error: any) => {
  // If it's a zod error, return a more readable error
  if (isZodError(error)) {
    return error.issues.map((issue: any) => {
      const publicError = {
        code: issue.code,
        path: issue.path,
        message: issue.message,
        ...(issue.expected && { expected: issue.expected }),
        ...(issue.received && { received: issue.received }),
        ...(issue.params && { params: issue.params }),
      };
      return publicError;
    });
  }
  // Obfuscate database and server errors
  if (error instanceof DatabaseError) {
    return {
      message:
        'There was a database error when running the query. ' +
        'Check server logs for more information',
    };
  }
  return {
    message:
      'A server-side error was thrown. It was not directly thrown by ' +
      'validation or the database query. Check server logs for more information',
  };
};
