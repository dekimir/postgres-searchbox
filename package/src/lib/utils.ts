import { z } from 'zod';

/**
 * @description
 * Takes an Array<V>, and a grouping function,
 * and returns a Map of the array grouped by the grouping function.
 *
 * @param list An array of type V.
 * @param keyGetter A Function that takes the the Array type V as an input, and returns a value of type K.
 *                  K is generally intended to be a property key of V.
 *
 * @returns Map of the array grouped by the grouping function.
 */
export function groupBy<K, V>(
  list: Array<V>,
  keyGetter: (input: V) => K
): Map<K, Array<V>> {
  const map = new Map<K, Array<V>>();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

export const interleave = (arr: any[], x: any) =>
  arr.flatMap((e) => [e, x]).slice(0, -1);

/**
 * https://stackoverflow.com/a/56592365/21643056
 */

export function pick<T extends object, U extends keyof T>(
  obj: T,
  paths: Array<U>
): Pick<T, U> {
  const ret = Object.create(null);
  for (const k of paths) {
    ret[k] = obj[k];
  }
  return ret;
}

export const parseWithDefault = (
  value: string | undefined,
  defaultValue: any
) => {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Validation helpers

 */

/**
 * Implements
 * This helps us when we already have TS types and want to make a zod schema.
 * It ensures our schema is compatible with our types.
 * https://github.com/colinhacks/zod/issues/372#issuecomment-1280054492
 * e.g. The package @algolia/client-search has a type called SearchOptions.
 * We pick which properties we want to use - we don't have all the features of Algolia.
 * Then that type is used to create a zod schema.
 * With Implements,
 * - if we miss a property from our schema, we get a type error.
 * - if we add an incorrect property to our schema, we get a type error.
 */

type Implements<Model> = {
  [key in keyof Model]-?: undefined extends Model[key]
    ? null extends Model[key]
      ? z.ZodNullableType<z.ZodOptionalType<z.ZodType<Model[key]>>>
      : z.ZodOptionalType<z.ZodType<Model[key]>>
    : null extends Model[key]
    ? z.ZodNullableType<z.ZodType<Model[key]>>
    : z.ZodType<Model[key]>;
};

export function implement<Model = never>() {
  return {
    with: <
      Schema extends Implements<Model> & {
        [unknownKey in Exclude<keyof Schema, keyof Model>]: never;
      }
    >(
      schema: Schema
    ) => z.object(schema),
  };
}

/**
 * undefinedOrIn
 * Used in e.g. schema refinement to check if a client value is in a list of valid values.
 */

export const undefinedOrIn = (
  val: string | readonly string[] | undefined,
  array: string[]
) => {
  if (!val) return true;
  if (typeof val === 'string') return array.includes(val);
  return val.every((v) => array.includes(v));
};

/**
 * undefinedOrLte
 * Used in e.g. schema refinement to check if a client value is less than or equal to a max value.
 */

export const undefinedOrLte = (
  val: number | undefined,
  max: number
): boolean => {
  if (!val) return true;
  return val <= max;
};
