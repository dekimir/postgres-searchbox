import format from 'pg-format';
import type {
  Props,
  GetFiltersReturn,
  Operator,
  NumericFilter,
  Refinements,
  AllRefinements,
} from './filters.types.js';
import { parseWithDefault } from '../utils/index.js';

/**
 * This is how the facetFilters string is formatted
 * https://www.algolia.com/doc/api-reference/api-parameters/facetFilters/
 * Both the <DynamicWidgets> and <RefinementList> components make request with this format
 */

export const getFilters = ({
  facetFilters,
  numericFilters: numericFiltersMaybeString,
  numericAttributesForFiltering,
}: Props): GetFiltersReturn => {
  // Build numericFilters based on 2 conditionals
  const numericFilters: readonly string[] = Array.isArray(
    numericFiltersMaybeString
  ) // is it an array already?
    ? numericFiltersMaybeString // yes
    : typeof numericFiltersMaybeString === 'string' // no. is it a string?
    ? [numericFiltersMaybeString] // yes, string cast to array
    : []; // no, return empty array

  if (!facetFilters?.length && !numericFilters?.length) return null;

  /**
   * Here we have:
   * 1. A nested array of 2 levels deep on facetFilters
   *    that's been validated against validFacetFilters
   *    like: [["attribute1:value", "attribute1:value2"], "attribute2:value"]
   * 2. numericFilters is an array of strings like: ["price>=10", "price<=20", "price=[1,2]"]
   * 3. numericAttributesForFiltering contains information about the numeric facets
   */

  const refinements: AllRefinements = {};

  // build - non-numeric
  const buildRecursive = (facetFilters: any, depth = 0) => {
    if (!facetFilters) return;
    // Call recursively if facetFilters is an array
    if (Array.isArray(facetFilters)) {
      facetFilters.forEach((filter) => buildRecursive(filter, depth + 1));
      return;
    }
    // If it's not an array, it's a string
    const [attribute, value] = facetFilters.split(':');
    // Create an object for this attribute if it doesn't exist
    if (!refinements[attribute]) {
      refinements[attribute] = { OR: [], AND: [], ['AND NOT']: [], RANGES: [] };
    }
    if (depth < 2) {
      // It's AND
      if (!value.startsWith('-')) {
        refinements[attribute]['AND'].push(value);
      } else {
        const valueWithoutMinus = value.slice(1);
        refinements[attribute]['AND NOT'].push(valueWithoutMinus);
      }
      return;
    }
    // It's OR
    refinements[attribute]['OR'].push(value);
    return;
  };

  buildRecursive(facetFilters);

  /**
   * Numeric filters
   */

  const numericFiltersParsed = numericFilters.map((filter: string) =>
    destructureNumericFilter(filter)
  );

  numericFiltersParsed
    .sort(sortNumericFilters)
    .forEach(({ attribute, operator, value }) => {
      if (!refinements[attribute]) {
        // Create an object for this attribute if it doesn't exist
        refinements[attribute] = {
          OR: [],
          AND: [],
          ['AND NOT']: [],
          RANGES: [{}],
        };
      }

      if (['=', '!='].includes(operator)) {
        /**
         * Numeric non-ranges
         */
        const key = operator === '=' ? 'OR' : 'AND NOT';
        const nevValue = Array.isArray(value) ? value : [value];
        // Add the value(s) to the array
        refinements[attribute][key].push(...nevValue);
        return;
      }

      if (['>', '<', '>=', '<='].includes(operator) && !Array.isArray(value)) {
        /**
         * Numeric ranges
         * This is a bit more complex because we need to group ranges like:
         * (price >= 10 AND price <= 20) OR (price >= 30 AND price <= 40)
         */

        const currentIndex = refinements[attribute].RANGES.length - 1;
        const current = refinements[attribute].RANGES[currentIndex];

        if (['>=', '>'].includes(operator) && (current['<'] || current['<='])) {
          // We need a new range
          refinements[attribute].RANGES.push({
            ['>=']: operator === '>=' ? value : undefined,
            ['>']: operator === '>' ? value : undefined,
          });
        } else if (
          '>' === operator &&
          Object.values(current).every((v) => !v)
        ) {
          // It's empty, we can just update the current range
          current['>'] = value;
        } else if (
          '>=' === operator &&
          Object.values(current).every((v) => !v)
        ) {
          //  It's empty, we can just update the current range
          current['>='] = value;
        } else if ('<' === operator) {
          // We can just update the current range
          current['<='] = undefined;
          current['<'] = value;
        } else if ('<=' === operator) {
          // We can just update the current range
          current['<'] = undefined;
          current['<='] = value;
        }

        refinements[attribute].RANGES[currentIndex] = current;
      }
    });

  const sqlArray: string[] = [];

  const typesToString = ({
    attribute,
    type,
  }: {
    attribute: string;
    type: Refinements;
  }) => {
    // Ranges
    const rangeArray = type.RANGES.map((range) => {
      const parts = [
        range['>='] ? format(`%s >= %L`, attribute, range['>=']) : '',
        range['>'] ? format(`%s > %L`, attribute, range['>']) : '',
        range['<'] ? format(`%s < %L`, attribute, range['<']) : '',
        range['<='] ? format(`%s <= %L`, attribute, range['<=']) : '',
      ].filter((s) => s.length);
      return parts.length === 1 ? parts[0] : `( ${parts.join(' AND ')} )`;
    });

    let rangeString = '';
    if (rangeArray.length === 1) rangeString = rangeArray[0];
    if (rangeArray.length > 1) rangeString = `( ${rangeArray.join(' OR ')} )`;

    // Everything else
    return [
      type.OR.length ? format('%s IN( %L )', attribute, type.OR) : '',
      type.AND.length
        ? type.AND.map((v) => format('%s = %L', attribute, v)).join(' AND ')
        : '',
      type['AND NOT'].length
        ? format('%s NOT IN ( %L )', attribute, type['AND NOT'])
        : '',
      rangeString,
    ]
      .filter((p) => p.length)
      .join(' AND ');
  };

  Object.entries(refinements).forEach(([attribute, type]) => {
    sqlArray.push(typesToString({ attribute, type }));
  });

  return {
    db: {
      formatted: sqlArray.join(' AND '),
    },
  };
};

/**
 * Helper functions
 */

/**
 * destructureNumericFilter
 * - used in this file
 * - used in payload validation
 * - exported for testing
 */

const NUMERIC_OPERATORS: Operator[] = ['<', '>', '<=', '>=', '=', '!='];

export const destructureNumericFilter = (
  numericFilter: string
): NumericFilter => {
  //Filter is a string of format: attribute operator value
  const findString = `^(\\w+)(${NUMERIC_OPERATORS.join(
    '|'
  )})([\\[\\]\\d\\s,]+)$`;
  // Use regex to get 3 match groups
  const regex = new RegExp(findString, 'g');
  const [, attribute, operator, valueMaybeArray] = [
    ...numericFilter.matchAll(regex),
  ][0] as [string, string, Operator, string];
  // ValueMaybeArray could be a number or an array of numbers
  const trimmedValue = valueMaybeArray.trim();
  let valueArray: number[] | undefined;
  if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
    valueArray = parseWithDefault(trimmedValue, []).map((v: string) =>
      parseInt(v)
    );
  }
  const value = valueArray || parseInt(valueMaybeArray);
  return { attribute, operator, value };
};

/**
 * sortRanges
 * It can take an array od destructured numeric filters and sort them
 * Sorting is important so that we can then group them into ranges.
 */

export const sortNumericFilters = (a: NumericFilter, b: NumericFilter) => {
  if (a.attribute < b.attribute) return -1;
  if (a.attribute > b.attribute) return 1;
  // here... attributes are same
  if (a.value < b.value) return -1;
  if (a.value > b.value) return 1;
  // here... values are the same sort by operator
  // order operators like this:
  const operatorOrder = ['>=', '>', '<', '<='];
  if (operatorOrder.indexOf(a.operator) < operatorOrder.indexOf(b.operator))
    return -1;
  if (operatorOrder.indexOf(a.operator) > operatorOrder.indexOf(b.operator))
    return 1;
  // here values, attributes and operators are the same
  return 0;
};
