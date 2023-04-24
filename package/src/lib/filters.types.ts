import type { SearchOptions } from '../client.types.js';
import type { Settings } from '../index.types.js';

/**
 * Main function props
 */

export interface Props {
  facetFilters?: SearchOptions['facetFilters'];
  numericFilters?: SearchOptions['numericFilters'];
  numericAttributesForFiltering: Required<Settings>['numericAttributesForFiltering'];
  maxFacetHits: Required<Settings>['maxFacetHits'];
}

export type GetFiltersReturn = {
  db: {
    formatted: string;
  };
} | null;

/**
 * Numeric types
 */

export type Operator = '<' | '>' | '<=' | '>=' | '=' | '!=';

export type NumericFilterNoArrays = {
  attribute: string;
  operator: Operator;
  value: number;
};

export type NumericFilter = Omit<NumericFilterNoArrays, 'value'> & {
  value: number | number[];
};

export type NumericRefinements = {
  [attribute: string]: {
    ['>=']?: number;
    ['>']?: number;
    ['<']?: number;
    ['<=']?: number;
  }[];
};

/**
 * Not numeric types
 */

export type Refinements = {
  [attribute: string]: {
    OR: string[] & number[];
    AND: string[] & number[];
    ['AND NOT']: string[] & number[];
  };
};

// export type Refinement = { value: string; type: string } & {
//   value: string;
//   type: string | string[];
//   operator?: Operator;
// };
