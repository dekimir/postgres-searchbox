import format from 'pg-format';
// Constants
import { VECTOR_COLUMN } from '../constants.js';
// Types
import type { ClientOptions } from '../client.js';
import type { Hit } from '../index.types.js';

export const getColumns = (clientOptions?: ClientOptions) => {
  if (!clientOptions?.returnColumns) {
    return {
      db: { formatted: '*' },
      updateHit: (hit: Hit) => {
        // Remove the vector column here because there is
        // no easy way to do SELECT * and exclude a column.
        const { [VECTOR_COLUMN]: _, ...rest } = hit;
        return rest;
      },
    };
  }

  return {
    db: {
      formatted: clientOptions.returnColumns
        ?.map((col) => format('%I', col))
        .join(', '),
    },
    updateHit: null,
  };
};
