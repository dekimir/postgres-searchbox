import type { SearchOptions as AlgoliaSearchOptions } from '@algolia/client-search';

// These are in the same order as the Algolia docs
// https://www.algolia.com/doc/api-reference/search-api-parameters/

export type SearchOptions = Pick<
  AlgoliaSearchOptions,
  // * Search
  // * ✅ 1/3 🛑
  | 'query'
  // | 'queryType'
  // * Attributes
  // * ✅ 1/2 🛑
  | 'attributesToRetrieve'
  // * Filtering
  // * ✅ 1/6 🛑
  // | 'filters'
  | 'facetFilters'
  | 'numericFilters'
  // | 'tagFilters'
  // * Faceting
  // * ✅ 1/3 🛑
  // | 'facets' // See below
  | 'maxValuesPerFacet'
  | 'sortFacetValuesBy'
  // | 'optionalFacetFilters'
  // * Highlighting Snippeting
  // * ✅ 1/3 🛑
  | 'attributesToHighlight'
  // | 'attributesToSnippet'
  | 'highlightPreTag'
  | 'highlightPostTag'
  // * Pagination
  // * ✅ 4/4 ✅
  | 'page'
  | 'hitsPerPage'
  | 'offset'
  | 'length'
  // * Advanced
  // * ✅ 1/14 🛑
  | 'maxFacetHits'
> & {
  // * Faceting
  // Custom because it can be a string or an array
  facets: AlgoliaSearchOptions['facets'] | string;
};

export type ClientValidation = {
  // * Attributes
  validAttributesToRetrieve?: string[];
  // * Filtering
  validFacetFilters?: string[];
  // * Highlighting Snippeting
  validAttributesToHighlight?: string[];
  validHighlightPostTags?: string[];
  validHighlightPreTags?: string[];
  // * Pagination
  maxPage?: number;
  maxHitsPerPage?: number;
  maxOffset?: number;
  maxLength?: number;
  maxHitsTotal?: number;
};

export type Request = {
  params: SearchOptions;
  indexName: string;
};
