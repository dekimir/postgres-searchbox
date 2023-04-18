import { PaginationRes } from './lib/pagination.types.js';

export interface GenericReq {
  body: string | object;
}

export interface GenericRes {
  status: (code: number) => GenericRes;
  json: (data: object) => void;
}

type PossibleSortBy = 'count' | 'isRefined' | 'name' | 'path';
type PossibleSortOrder = 'asc' | 'desc';

export type HandlerConfig = {
  tableName: string;
  validHighlightColumns?: string[];
  validReturnColumns?: string[];
  validLanguages?: string[];
  // https://community.algolia.com/algoliasearch-helper-js/reference.html
  facets?: string[]; // AND
  disjunctiveFacets?: string[]; // OR
  hierarchicalFacets?: {
    name: string;
    attributes: string[];
    separator?: string;
    rootPath?: string;
    showParentLevel?: boolean;
    sortBy?: `${PossibleSortBy}':'${PossibleSortOrder}`[];
  }[];
};

export type HandlerConfigs = HandlerConfig[];

/**
 * Return types
 */

export interface DatabaseResult {
  rows: {
    total_hits: number;
    hits: {
      // object with many possible types
      [key: string]: string | number | boolean | null;
    }[];
  }[];
}

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

export interface SearchRes {
  results: [
    {
      hits: Hit[];
    } & PaginationRes
  ];
  query: string;
}
