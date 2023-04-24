import type { AlgoliaSearchOptions } from './bundle.types.js';

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
  // * ✅ 2/6 🛑
  // | 'filters'
  | 'facetFilters'
  | 'numericFilters'
  // | 'tagFilters'
  // * Faceting
  // * ✅ 2/4 🛑
  // | 'facets' // See below
  | 'maxValuesPerFacet'
  | 'sortFacetValuesBy'
  // | 'optionalFacetFilters'
  // * Highlighting Snippeting
  // * ✅ 3/6 🛑
  | 'attributesToHighlight'
  // | 'attributesToSnippet'
  | 'highlightPreTag'
  | 'highlightPostTag'
  // | 'snippetEllipsisText'
  // | 'restrictHighlightAndSnippetArrays'
  // * Pagination
  // * ✅ 4/4 ✅
  | 'page'
  | 'hitsPerPage'
  | 'offset'
  | 'length'
  // * Advanced
  // * ✅ 1/14 🛑
  // | 'responseFields'
  | 'maxFacetHits'
> & {
  // * Faceting
  // Custom because it can be a string or an array
  facets?: AlgoliaSearchOptions['facets'] | string;
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
