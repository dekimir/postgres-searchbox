import format from 'pg-format';
// Constants
import { VECTOR_COLUMN } from '../constants.js';
// Types
import type { Hit } from '../index.types.js';

export const getColumns = (attributesToRetrieve: readonly string[]) => {
  // const attributesToRetrieve = params.attributesToRetrieve?.filter(
  //   (a: string) => config?.attributesToRetrieve?.includes(a)
  // );

  /**
   * Using algolia terminology here, attribute is any field.
   * If no attributes are specified, we return all fields.
   * Now we only support attributes that are columns on the main table.
   */

  if (!attributesToRetrieve?.length || attributesToRetrieve.includes('*')) {
    return {
      db: { formatted: ['*'] },
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
      formatted: attributesToRetrieve.map((att) => format('%I', att)),
    },
    updateHit: null,
  };
};
