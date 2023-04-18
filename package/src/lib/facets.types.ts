import type { SearchParameters } from 'algoliasearch-helper';

import type { HandlerConfig } from '../index.types.js';

export type Operator = SearchParameters.Operator;

export type FacerParams = {
  facetFilters?: string;
  facets?: string;
  tagFilters?: string;
  numericFilters?: string;
};

export type FacetConfig = Pick<
  HandlerConfig,
  'facets' | 'disjunctiveFacets' | 'hierarchicalFacets'
>;

type Facets = string | string[]; // I think this is right

export type NestedStrings = string | NestedStrings[];

export type Parsed = {
  facets: Facets;
  facetFilters: NestedStrings[];
  numericFilters: string[];
};

export type Refinement = { value: string; type: string } & {
  value: string;
  type: string | string[];
  operator?: Operator;
};
