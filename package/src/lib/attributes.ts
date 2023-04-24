import format from 'pg-format';

export const getAttributes = (table: string) => {
  return {
    db: {
      /**
       * A database query to get all the text or number columns
       */
      formatted: format(
        /* sql */ `
          SELECT array_to_json(array_agg(column_name)) AS columns
          FROM information_schema.columns
          WHERE table_name = %L
            AND data_type IN ('text', 'integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint', 'decimal', 'money')
        `,
        table
      ),
    },
  };
};
