import AlgoliasearchHelper from 'algoliasearch-helper';

import format from 'pg-format';
import type {
  FacetParams,
  FacetConfig,
  Refinement,
  Operator,
} from './facets.types.js';
import { parseWithDefault } from './utils.js';

/**
 * This is how the facetFilters string is formatted
 * https://www.algolia.com/doc/api-reference/api-parameters/facetFilters/
 * Bothe the <DynamicWidgets> and <RefinementList> components make request with this format
 */

export const getFacets = async (params: FacetParams, config?: FacetConfig) => {
  /**
   * Initial checks
   */

  if (!config) {
    // console.error('No config passed to getFacets');
    return null;
  }

  // facets & disjunctiveFacets are arrays of strings
  // hierarchicalFacets is an array of objects
  // get an array of the names here for use later
  const hierarchicalFacetNames = config.hierarchicalFacets?.map(
    (facet) => facet.name
  );

  const configFacetNames = [
    ...(config.disjunctiveFacets || []),
    ...(config.facets || []),
    ...(hierarchicalFacetNames || []),
  ];

  // No available facets have been declared for this index so return null.
  if (!configFacetNames.length) {
    // console.error('No facets declared in config');
    return null;
  }

  const configFacetSet = new Set(configFacetNames);

  if (configFacetSet.size !== configFacetNames.length) {
    throw new Error(
      `Duplicate facets in config - don't share values 
       across disjunctiveFacets, facets and hierarchicalFacets`
    );
  }

  /**
   * Passed the initial checks
   */

  if (!params.facetFilters?.length && !params.numericFilters?.length) {
    console.error('No facetFilters or numericFilters aftre parsing');
    return null;
  }

  /**
   * Here we have:
   * 1. A nested array of requested facetFilters on params.facetFilter
   *    like: [["attribute1:value", "attribute2:value2"], "attribute3:value"]
   * 2. config contains information about the available facets
   */

  /**
   * Use AlgoliasearchHelper to validate the facetFilters
   * - initialize a helper instance
   * - add the facetFilters to the helper (any not set in config will be ignored)
   */

  const client = {
    search: () => {},
  };

  // Init a helper instance with the available facets
  var helper = AlgoliasearchHelper(client, 'test_table', {
    facets: config.facets,
    disjunctiveFacets: config.disjunctiveFacets,
    hierarchicalFacets: config.hierarchicalFacets,
  });

  // Validate
  const validateRecursive = (facetFilters: any, depth = 0) => {
    const type = depth < 2 ? 'conjunctive' : 'disjunctive';

    /**
     * Handle the case where the facetFilters is a string
     */

    if (typeof facetFilters === 'string') {
      const [attribute, value] = facetFilters.split(':');

      if (type === 'conjunctive' && config.facets?.includes(attribute)) {
        if (value.startsWith('-')) {
          helper.addFacetExclusion(attribute, value);
        } else {
          helper.addFacetRefinement(attribute, value);
        }
      }

      if (
        type === 'disjunctive' &&
        config.disjunctiveFacets?.includes(attribute)
      ) {
        helper.addDisjunctiveFacetRefinement(attribute, value);
      }

      if (hierarchicalFacetNames?.includes(attribute)) {
        helper.addHierarchicalFacetRefinement(attribute, value);
      }
    }

    /**
     * Handle the case where the facetFilters is an array
     */

    if (Array.isArray(facetFilters)) {
      facetFilters.forEach((filter) => validateRecursive(filter, depth + 1));
    }
  };

  validateRecursive(params.facetFilters);

  // Numeric filters

  const numericFacetsSet: Set<string> = new Set();

  const operators: Operator[] = ['<', '>', '<=', '>=', '=', '!='];
  params.numericFilters?.forEach((filter) => {
    let valueArray: number[] | undefined;
    //Filter is a string of format: attribute operator value
    // Use regex to get 3 match groups
    const findString = `^(\\w+)(${operators.join('|')})([\\[\\]\\d\\s,]+)$`;
    const regex = new RegExp(findString, 'g');

    const [, attribute, operator, value] = [...filter.matchAll(regex)][0];

    // Value could be a number or an array of numbers
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
      valueArray = parseWithDefault(trimmedValue, []).map((v: string) =>
        parseInt(v)
      );
    }

    helper.addNumericRefinement(
      attribute,
      operator as Operator,
      valueArray ?? parseInt(value)
    );

    numericFacetsSet.add(attribute);
  });

  /**
   * Get the refinements from the helper
   * and group them by facet into a flat array
   */

  const compositeRefinements = configFacetNames
    .map((facet) => {
      let refinements = helper.getRefinements(facet) as Refinement[];

      return { facet, refinements };
    })
    .filter((r) => r.refinements.length > 0);

  /**
   * Generate some SQL from the compositeRefinements flat array
   * - loop over each refinement group
   * - finally join each group with AND
   * Outer loop, here we have a info like:
   * [
   *   { facet: 'brand', refinements: [ ... ] }
   *   { facet: 'category', refinements: [ ... ] },
   *   { facet: 'price', refinements: [ ... ] }
   * ]
   */

  const sqlArray = compositeRefinements.map((refinement) => {
    const { facet, refinements } = refinement;

    /**
     * Inner loop, here we have a info like:
     * {
     *   facet: 'category',
     *   refinements: [
     *    { type: 'conjunctive', value: 'sports' },
     *    { type: 'conjunctive', value: 'outdoors' }
     *   ]
     * }
     */

    const sqlParts = refinements
      .map((r) => {
        if (r.type === 'numeric') {
          /**
           * Hande numeric refinements
           */

          // This should always be an array
          if (!Array.isArray(r.value)) return '';

          const sqlParts: string[] = [];

          r.value.forEach((v) => {
            if (typeof v === 'number') {
              sqlParts.push(format('%I %s %L', facet, r.operator, v));
            }
            if (Array.isArray(v)) {
              v.forEach((v2) => {
                // console.log(v2, 'v2');
                sqlParts.push(format('%I %s %L', facet, r.operator, v2));
              });
            }
          });

          if (r.operator === '=' && sqlParts.length > 1) {
            return `( ${sqlParts.join(' OR ')} )`;
          }
          return sqlParts.join(` AND `);
        } else if (r.type === 'exclude') {
          /**
           * Handle exclude refinements
           */
          return format('NOT %I = %I', facet, r.value.substring(1));
        } else {
          /**
           * Handle everything else
           */
          return format('%I = %I', facet, r.value);
        }
      })
      .filter((s) => s?.length);

    /**
     * Join the parts together
     */

    // If refinements[0].type is disjunctive then they all wil be disjunctive
    // Only OR groups with length > 1 need to be wrapped in brackets
    if (refinements[0].type === 'disjunctive' && sqlParts.length > 1) {
      return `( ${sqlParts.join(' OR ')} )`;
    }
    return sqlParts.join(` AND `);
  });

  const formattedSql = sqlArray.filter((s) => s?.length).join(' AND ');

  return { db: { formatted: formattedSql } };
};
