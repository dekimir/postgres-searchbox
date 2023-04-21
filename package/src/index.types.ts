import type {
  Settings as AlgoliaSettings,
  SearchResponse as AlgoliaSearchResponse,
} from '@algolia/client-search';
// import { PaginationRes } from './lib/pagination.types.js';
import { ClientValidation } from './client.types.js';

// These are in the same order as the Algolia docs
// https://www.algolia.com/doc/api-reference/settings-api-parameters/
export type Settings = Pick<
  AlgoliaSettings,
  // * Attributes
  // * ✅ 3/4 🛑
  | 'searchableAttributes'
  | 'attributesForFaceting'
  // | 'unretrievableAttributes'
  | 'attributesToRetrieve'
  // * Ranking
  // * 🛑 0/3 🛑
  // | 'ranking'
  // | 'customRanking'
  // | 'relevancyStrictness'
  // * Faceting
  // * 🛑 0/2 🛑
  | 'maxValuesPerFacet'
  | 'sortFacetValuesBy'
  // * Highlighting Snippeting
  // * ✅ 1/6 🛑
  | 'attributesToHighlight'
  // | 'attributesToSnippet'
  | 'highlightPreTag'
  | 'highlightPostTag'
  // | 'snippetEllipsisText'
  // | 'restrictHighlightAndSnippetArrays'
  // * Pagination
  // * 🛑 0/2  🛑
  | 'hitsPerPage'
  | 'paginationLimitedTo'
  // ** Typos
  // * 🛑 0/7 🛑
  // ...
  // * Performance
  // * ✅ 1/2 🛑
  | 'numericAttributesForFiltering'
  // * Advanced
  // * ✅ 1/9 🛑
  | 'maxFacetHits'
  | 'renderingContent'
  // * A lot more unsupported settings can be added later ...
>;

// type PossibleSortBy = 'count' | 'isRefined' | 'name' | 'path';
// type PossibleSortOrder = 'asc' | 'desc';

export type HandlerConfig = {
  indexName?: string;
  settings?: Settings;
  clientValidation?: ClientValidation;
};

// When there is an array with more than one
// require indexName property
export type HandlerConfigs =
  | [HandlerConfig]
  | (HandlerConfig & { indexName: string })[];

export type HandlerConfigWithDefaults = Omit<
  HandlerConfig,
  'clientValidation' | 'settings'
> & {
  clientValidation: Required<ClientValidation>;
  settings: Required<Settings>;
};

/**
 * Request and response types
 */

export interface GenericReq {
  body: string | object;
}

export interface GenericRes {
  status: (code: number) => GenericRes;
  json: (data: object) => void;
}

/**
 * Return types
 */

export interface DatabaseHit {
  // object with many possible types
  [key: string]: string | number | boolean | null;
}

export interface DatabaseResult {
  rows: {
    json: {
      totalHits: number;
      hits: DatabaseHit[];
      facets: {
        [key: string]: {
          [key: string]: number;
        };
      };
    };
  }[];
}

/**
 * The type of Hit here should be improved
 */

export type Hit = {
  _highlightResult?: {
    [key: string]: {
      value: string;
      matchLevel: 'none' | 'partial' | 'full';
      matchedWords: string[];
      fullyHighlighted?: boolean;
    };
  };
} & {
  [key: string]: string | number | boolean | null;
};

export type SearchResponse = Pick<
  AlgoliaSearchResponse<{}>,
  // | 'hits'
  | 'nbHits'
  | 'page'
  | 'length'
  | 'offset'
  | 'nbPages'
  | 'hitsPerPage'
  | 'exhaustiveNbHits'
  | 'exhaustiveFacetsCount'
  | 'processingTimeMS'
  | 'query'
  | 'params'
  | 'index'
  | 'indexUsed'
  | 'facets_stats'
  | 'renderingContent'
  // | 'serverTimeMS'
  // | 'exhaustiveTypo'
  // | 'exhaustive'
> & {
  hits: Hit[];
};
