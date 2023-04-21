import type { Settings } from './index.types.js';
import type { ClientValidation } from './client.types.js';

export const VECTOR_COLUMN = 'postgres_searchbox_v1_doc';
export const INDEX_PREFIX = 'postgres_searchbox_v1_idx_';
export const MAX_REQ_PER_HTTP_REQ = 15;
export const MAX_HITS_PER_PAGE = 100;
export const MAX_PAGES = 100;
export const MAX_HITS_TOTAL = 3000;

export const defaultSettings: Required<Settings> = {
  // * Attributes
  searchableAttributes: ['*'],
  attributesToRetrieve: ['*'],
  attributesForFaceting: [],
  // * Faceting
  maxValuesPerFacet: 10,
  sortFacetValuesBy: 'count',
  // * Highlighting Snippeting
  attributesToHighlight: [],
  highlightPreTag: '__ais-highlight__',
  highlightPostTag: '__/ais-highlight__',
  // * Pagination
  hitsPerPage: 15,
  paginationLimitedTo: MAX_HITS_TOTAL,
  // * Performance
  numericAttributesForFiltering: [],
  // * Advanced
  maxFacetHits: 100,
  renderingContent: {},
};

export const defaultClientValidation: Required<ClientValidation> = {
  // * Attributes
  validAttributesToRetrieve: ['*'],
  // * Filtering
  validFacetFilters: ['*'],
  // * Highlighting Snippeting
  validAttributesToHighlight: ['*'],
  validHighlightPreTags: ['__ais-highlight__'],
  validHighlightPostTags: ['__/ais-highlight__'],
  // * Pagination
  maxHitsPerPage: MAX_HITS_PER_PAGE,
  maxPage: MAX_PAGES,
  maxOffset: MAX_HITS_TOTAL,
  maxLength: MAX_HITS_PER_PAGE,
  maxHitsTotal: MAX_HITS_TOTAL,
};
