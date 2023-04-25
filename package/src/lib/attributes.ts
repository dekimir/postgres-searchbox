import type { Client } from 'pg';
import format from 'pg-format';
// Types
import type { Settings } from '../index.types.js';

interface Props {
  client: Client;
  table: string;
  attributesForFaceting: Required<Settings>['attributesForFaceting'];
  numericAttributesForFiltering: Required<Settings>['numericAttributesForFiltering'];
}

type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

type NewEntries = Entries<
  Pick<
    Required<Settings>,
    'attributesForFaceting' | 'numericAttributesForFiltering'
  >
>;

type Return = {
  new: NewEntries;
} | null;

/**
 * A database query to get all the text or number columns
 */

export const getAttributes = async ({
  table,
  client,
  attributesForFaceting,
  numericAttributesForFiltering,
}: Props): Promise<Return> => {
  const toDo: string[] = [];

  if (attributesForFaceting.includes('*')) {
    toDo.push('attributesForFaceting');
  }
  if (numericAttributesForFiltering.includes('*')) {
    toDo.push('numericAttributesForFiltering');
  }

  if (!toDo.length) return null;

  const sql = format(
    /* sql */ `
    WITH all_columns AS (
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = %L
    ),
    attributesForFaceting AS (
      SELECT * FROM all_columns
      WHERE data_type IN ('text', 'integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint', 'decimal', 'money')
    ),
    numericAttributesForFiltering AS (
      SELECT * FROM all_columns
      WHERE data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint', 'decimal', 'money')
    )
    
    SELECT json_build_array(
      ${toDo.map((t) =>
        format(
          /* sql */ ` json_build_array( %L, ( SELECT array_agg(column_name) FROM %s ) ) `,
          t,
          t
        )
      )}
    ) AS "json"
  `,
    table
  );

  const result = await client.query(sql);

  return {
    new: result.rows[0].json as NewEntries,
  };
};
