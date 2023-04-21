import type { SearchOptions } from '../client.types.js';
import type { Settings } from '../index.types.js';

// export type Operator = SearchParameters.Operator;

// type Facets = string | string[]; // I think this is right ... actually wrong

export type Operator = '<' | '>' | '<=' | '>=' | '=' | '!=';

export interface Props {
  facets?: SearchOptions['facets'];
  facetFilters?: SearchOptions['facetFilters'];
  numericFilters?: SearchOptions['numericFilters'];
  attributesForFaceting: Required<Settings>['attributesForFaceting'];
  maxValuesPerFacet: Required<Settings>['maxValuesPerFacet'];
  sortFacetValuesBy: Required<Settings>['sortFacetValuesBy'];
  numericAttributesForFiltering: Required<Settings>['numericAttributesForFiltering'];
  maxFacetHits: Required<Settings>['maxFacetHits'];
}

export type GetFacetSelectSqlParams = Required<
  Pick<Props, 'maxValuesPerFacet' | 'sortFacetValuesBy'>
> & {
  facets: readonly string[];
};

export type FacetSettings = Required<
  Pick<
    Settings,
    // 'facets' | 'disjunctiveFacets' | 'hierarchicalFacets'
    | 'attributesForFaceting'
    | 'maxValuesPerFacet'
    | 'sortFacetValuesBy'
    | 'numericAttributesForFiltering'
    | 'maxFacetHits'
  >
>;

export type GetFacetsReturn = {
  db: {
    selectFormatted?: {
      cte: string;
      json: string;
    };
    whereFormatted: string;
  };
};

export type NestedStrings = string | NestedStrings[];

export type FacetParams = Pick<
  SearchOptions,
  | 'facetFilters'
  | 'facets'
  | 'maxValuesPerFacet'
  | 'sortFacetValuesBy'
  | 'maxFacetHits'
>;

// export type Refinement = { value: string; type: string } & {
//   value: string;
//   type: string | string[];
//   operator?: Operator;
// };
