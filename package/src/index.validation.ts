import { z } from 'zod';
// Constants
import { MAX_HITS_PER_PAGE, MAX_HITS_TOTAL, MAX_PAGES } from './constants.js';

/**
 * Input validation with zod
 * Succesful validation returns a typed object
 */

export const PaginationParams = z
  .object({
    // Optional pagination params
    page: z.number().gte(0).lte(MAX_PAGES),
    hitsPerPage: z.number().gte(1).lte(MAX_HITS_PER_PAGE),
    // We should either have (page & hitsPerPage) or (offset & length)
    offset: z.number().gte(0).lte(MAX_HITS_TOTAL),
    length: z.number().gte(1).lte(MAX_HITS_PER_PAGE),
  })
  .partial()
  .refine((data) => {
    return typeof data.offset !== 'undefined' ? !data.length : true;
  }, 'If offset is defined, length must be defined as well.');

export const PostgresSearchbox = z.object({
  tableName: z.string(),
});

export const SearchParams = z.object({
  query: z.string(),
  // Unused params
  facets: z.array(z.string()).optional(),
  highlightPostTag: z.string().optional(),
  highlightPreTag: z.string().optional(),
  tagFilters: z.string().optional(),
});

export const IndexName = z
  .string()
  .max(200)
  .min(1)
  .regex(new RegExp(/^[a-z0-9_\?\,\=\+]+$/));

export const Json = z.object({
  params: SearchParams.and(PaginationParams),
  indexName: IndexName,
});
