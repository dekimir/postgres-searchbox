import { z } from 'zod';
// Constants
import { MAX_HITS_PER_PAGE, MAX_PAGES } from './constants.js';

/**
 * Input validation with zod
 * Succesful validation returns a typed object
 */

const SearchParams = z.object({
  query: z.string(),
  // Optional pagination params
  page: z.number().gte(0).lte(MAX_PAGES).optional(),
  hitsPerPage: z.number().gte(1).lte(MAX_HITS_PER_PAGE).optional(),
  // Unused params
  facets: z.array(z.string()).optional(),
  highlightPostTag: z.string().optional(),
  highlightPreTag: z.string().optional(),
  tagFilters: z.string().optional(),
});

export const Json = z.object({
  params: SearchParams,
  indexName: z.string(),
});

/**
 * Types
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

export interface DatabaseResult {
  rows: {
    total_hits: number;
    hits: {
      // object with many possible types
      [key: string]: string | number | boolean | null;
    }[];
  }[];
}

// https://www.algolia.com/doc/guides/building-search-ui/ui-and-ux-patterns/pagination/react-hooks/#response-details
export interface PaginationRes {
  page: number;
  hitsPerPage: number;
  nbHits: number;
  nbPages: number;
  exhaustiveNbHits?: boolean;
}

export interface SearchRes {
  results: [
    {
      hits: {
        [key: string]: string | number | boolean | null;
      }[];
    } & PaginationRes
  ];
  query: string;
}
