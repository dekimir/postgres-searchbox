import format from 'pg-format';
import type {
  Props,
  GetFacetsReturn,
  // Refinement,
  Operator,
  GetFacetSelectSqlParams,
} from './facets.types.js';
import { parseWithDefault } from './utils.js';

/**
 * This is how the facetFilters string is formatted
 * https://www.algolia.com/doc/api-reference/api-parameters/facetFilters/
 * Both the <DynamicWidgets> and <RefinementList> components make request with this format
 */

const NUMERIC_OPERATORS: Operator[] = ['<', '>', '<=', '>=', '=', '!='];

type NumericFilter = {
  attribute: string;
  operator: string;
  value: number | number[];
};

export const destructureNumericFilter = (
  numericFilter: string
): NumericFilter => {
  //Filter is a string of format: attribute operator value
  const findString = `^(\\w+)(${NUMERIC_OPERATORS.join(
    '|'
  )})([\\[\\]\\d\\s,]+)$`;
  // Use regex to get 3 match groups
  const regex = new RegExp(findString, 'g');
  const [, attribute, operator, value] = [...numericFilter.matchAll(regex)][0];
  // Value could be a number or an array of numbers
  const trimmedValue = value.trim();
  let valueArray: number[] | undefined;
  if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
    valueArray = parseWithDefault(trimmedValue, []).map((v: string) =>
      parseInt(v)
    );
  }
  return { attribute, operator, value: valueArray || parseInt(value) };
};

export const getFacetSelectSql = ({
  facets,
  maxValuesPerFacet,
  sortFacetValuesBy,
}: GetFacetSelectSqlParams) => {
  if (!facets?.length) return;

  const limit = Number.isInteger(maxValuesPerFacet) ? maxValuesPerFacet : 10;

  // For things like
  const cte = facets
    .map((facet) =>
      format(
        /* sql */ `
        %I AS (
          SELECT json_object_agg( %I, cnt ORDER BY cnt DESC ) as details
            FROM (
              SELECT %I, count(*) AS cnt
              FROM all_selection
              WHERE %I IS NOT NULL
              GROUP by %I
              ORDER BY ${
                sortFacetValuesBy === 'count' ? `count(%I) DESC` : `%I ASC`
              } 
              LIMIT ${limit}
            ) t
        )
      `,
        `${facet}_selection`,
        facet,
        facet,
        facet,
        facet,
        facet,
        facet
      )
    )
    .join(',');

  const json = /* sql */ `
    'facets', json_build_object(
      ${facets
        .map((facet) =>
          format(`%L, (SELECT details FROM %I)`, facet, `${facet}_selection`)
        )
        .join(',')}
    )`;

  return { cte, json };
};

/**
 * Ambiguous params
 * maxValuesPerFacet: The maximum number of facet values to return for each facet in a regular search.
 * sortFacetValuesBy: Controls how facet values are fetched.
 * maxFacetHits: Maximum number of facet hits to return during a search for facet values.
 */

export const getFacets = async ({
  facetFilters,
  numericFilters: numericFiltersMaybeString,
  facets: facetsMaybeString,
  attributesForFaceting,
  maxValuesPerFacet,
  sortFacetValuesBy,
  numericAttributesForFiltering,
  maxFacetHits,
}: Props): Promise<GetFacetsReturn> => {
  const returnValue: GetFacetsReturn = {
    db: {
      selectFormatted: undefined, // 2 fragments of the main SQL query related to facet counts
      whereFormatted: '', // A fragment of the main SQL query WHERE
    },
  };

  // Build facets based on 2 conditionals
  const facets: readonly string[] =
    facetsMaybeString?.includes('*') || !facetsMaybeString
      ? attributesForFaceting // facetsMaybeString is * or undefined
      : Array.isArray(facetsMaybeString) // is it an array already?
      ? facetsMaybeString // yes
      : [facetsMaybeString]; // no, string cast to array

  // Build numericFilters based on 2 conditionals
  const numericFilters: readonly string[] = Array.isArray(
    numericFiltersMaybeString
  ) // is it an array already?
    ? numericFiltersMaybeString // yes
    : typeof numericFiltersMaybeString === 'string' // no, is it a string?
    ? [numericFiltersMaybeString] // yes, string cast to array
    : []; // no, return empty array

  returnValue.db.selectFormatted = getFacetSelectSql({
    facets,
    maxValuesPerFacet,
    sortFacetValuesBy,
  });

  // Optional params
  // facetFilters
  // facets

  console.log(facets, '>>> facets');
  console.log(
    numericAttributesForFiltering,
    '>>> numericAttributesForFiltering'
  );
  console.log({ facetFilters, numericFilters }, '>>> in getFacets');

  if (!facetFilters?.length && !numericFilters?.length) return returnValue;

  /**
   * Here we have:
   * 1. A nested array of 2 levels deep on facetFilters
   *    that's been validated against validFacetFilters
   *    like: [["attribute1:value", "attribute1:value2"], "attribute2:value"]
   * 2. numericAttributesForFiltering contains information about the numeric facets
   */

  const refinements: {
    [key: string]: {
      OR: string[];
      AND: string[];
      ['AND NOT']: string[];
    };
  } = {};

  // build - non-numeric
  const buildRecursive = (facetFilters: any, depth = 0) => {
    const type = depth < 2 ? 'AND' : 'OR';

    /**
     * Handle the case where the facetFilters is a string
     */

    if (typeof facetFilters === 'string') {
      const [attribute, value] = facetFilters.split(':');

      if (!refinements[attribute])
        refinements[attribute] = {
          OR: [],
          AND: [],
          ['AND NOT']: [],
        };

      if (type === 'AND') {
        if (value.startsWith('-')) {
          const valueWithoutMinus = value.slice(1);
          refinements[attribute]['AND NOT'].push(valueWithoutMinus);
        } else {
          refinements[attribute]['AND'].push(value);
        }
      }

      if (type === 'OR') {
        refinements[attribute]['OR'].push(value);
      }
    }

    /**
     * Handle the case where the facetFilters is an array
     */

    if (Array.isArray(facetFilters)) {
      facetFilters.forEach((filter) => buildRecursive(filter, depth + 1));
    }
  };

  buildRecursive(facetFilters);

  // build - numeric

  const numericFacetsSet: Set<string> = new Set();

  const numericRefinements: {
    [key: string]: string[];
  } = {};

  const numericFiltersParsed = numericFilters.map((filter: string) =>
    destructureNumericFilter(filter)
  );

  function compareFn(a: NumericFilter, b: NumericFilter) {
    if (a.attribute < b.attribute) return -1;
    if (a.attribute > b.attribute) return 1;
    // attributes are same
    // Test values
    if (Array.isArray(a.value) && !Array.isArray(b.value)) return 1;
    if (!Array.isArray(a.value) && Array.isArray(b.value)) return -1;
    if (Array.isArray(a.value) && Array.isArray(b.value)) return 0;
    // values are not arrays
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    // values are the same sort by operator
    if (a.operator === '<=' && b.operator === '<') return 1;
    if (a.operator === '<' && b.operator === '<=') return -1;
    if (a.operator === '>' && b.operator === '>=') return 1;
    if (a.operator === '>=' && b.operator === '>') return -1;
    // a must be equal to b
    return 0;
  }

  const numericRanges = numericFiltersParsed
    .filter(({ operator }) => ['>', '<', '>=', '<='].includes(operator))
    .sort(compareFn);
  const numericSimple = numericFiltersParsed.filter(
    ({ operator }) => !['>', '<', '>=', '<='].includes(operator)
  );

  console.log(numericRanges);

  // Walk through the sorted numeric filters and build an SQL string

  const sql = numericRanges.reduce((acc, filter) => {
    const { attribute, operator, value } = filter;

    if (!numericRefinements[attribute]) numericRefinements[attribute] = [];

    const previous = numericRefinements[attribute].slice(-1)[0];

    if (operator.includes('>') && previous?.includes('>')) {
      // Do nothing. Because > 10 AND > 20 is the same as > 10
    } else if (operator.includes('<') && previous?.includes('>')) {
      // We have a range
      const inBrackets = `( ${previous} AND ${format(
        ` %I ${operator} %I`,
        attribute,
        value
      )} )`;
      numericRefinements[attribute].pop();
      numericRefinements[attribute].push(inBrackets);
    } else if (operator.includes('<') && previous?.includes('<')) {
      // We have a range
      const sql = format(` %I ${operator} %I`, attribute, value);
      const position = previous.length;
      numericRefinements[attribute].pop();
      const newSql = `${previous.slice(0, position - 1)} AND ${sql} )`;
      numericRefinements[attribute].push(newSql);
    } else if (operator === '!=') {
      // we have a single value
      numericRefinements[attribute].push(format(` %I <> %I`, attribute, value));
    } else {
      // we have a single value
      numericRefinements[attribute].push(
        format(` %I ${operator} %I`, attribute, value)
      );
    }

    //   ) {
    // }
  });

  console.log(numericRefinements);

  // numericFilters?.forEach((filter: string) => {
  //   const { attribute, operator, value } = destructureNumericFilter(filter);

  //   console.log({
  //     attribute,
  //     operator,
  //     value,
  //   });

  //   // let valueArray: number[] | undefined;

  //   // helper.addNumericRefinement(
  //   //   attribute,
  //   //   operator as Operator,
  //   //   valueArray ?? parseInt(value)
  //   // );

  //   // numericFacetsSet.add(attribute);
  // });

  const sqlArray = Object.entries(refinements).map(([attribute, type]) => {
    const parts = {
      or: type.OR.length ? ` ${attribute} IN( ${format(`%L`, type.OR)} ) ` : '',

      and: type.AND.length
        ? ` ${attribute} = ALL( ${format(`%L`, type.AND)} ) `
        : '',

      andNot: type['AND NOT'].length
        ? ` ${attribute} =  NOT IN ( ${format(`%L`, type['AND NOT'])} ) `
        : '',
    };

    return Object.values(parts)
      .filter((p) => p.length)
      .join(' AND ');
  });

  returnValue.db.whereFormatted = sqlArray
    .filter((s) => s?.length)
    .join(' AND ');

  return returnValue;

  // TODO Numeric filters
};
