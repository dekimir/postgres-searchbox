import { z } from 'zod';
// Constants
import { MAX_HITS_PER_PAGE, MAX_HITS_TOTAL, MAX_PAGES } from './constants.js';
import type { HandlerConfigs } from './index.types.js';

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
  .partial();

export const PostgresSearchbox = z.object({
  tableName: z.string(),
});

export const SearchParams = z.object({
  query: z.string(),
  // Filters
  facets: z.array(z.string()).optional(),
  facetFilters: z.array(z.array(z.string())).optional(),
  numericFilters: z.array(z.string()).optional(),
  tagFilters: z.array(z.string()).optional(),
  // Highlight
  highlightPostTag: z.string().optional(),
  highlightPreTag: z.string().optional(),
});

export const IndexName = z
  .string()
  .max(200)
  .min(1)
  .regex(new RegExp(/^[a-z0-9_\?\,\=\+]+$/));

export const validatePayload = (payload: any, configs?: HandlerConfigs) => {
  // If options are provided, get the relevant options
  // if (payload?.indexName &&  options?) {

  const thisTableOptions =
    configs && configs.find((config) => config.tableName === payload.indexName);

  // make a zod validator based on the options
  const PgOptions = z
    .object({
      // an array of columns
      highlightColumns: z.array(z.string()).optional(),
      returnColumns: z.array(z.string()).optional(),
      language: z.string().optional(),
    })
    .refine(({ highlightColumns }) => {
      if (!highlightColumns?.length) return true;
      return highlightColumns?.every((column) =>
        thisTableOptions?.validHighlightColumns?.includes(column)
      );
    }, 'Invalid highlight columns')
    .refine(({ returnColumns }) => {
      if (!returnColumns?.length) return true;
      return returnColumns?.every((column) =>
        thisTableOptions?.validReturnColumns?.includes(column)
      );
    }, 'Invalid return columns')
    .refine(({ language }) => {
      if (!language) return true;
      return thisTableOptions?.validLanguages?.includes(language);
    }, 'Invalid language');

  const Payload = z.object({
    params: SearchParams.and(PaginationParams),
    indexName: IndexName,
    pgOptions: PgOptions.optional(),
  });

  return Payload.safeParse(payload);
};
