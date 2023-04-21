import { z } from 'zod';
// Utils
import { implement, undefinedOrIn, undefinedOrLte } from './lib/utils.js';
// Constants
import { MAX_HITS_PER_PAGE, MAX_HITS_TOTAL, MAX_PAGES } from './constants.js';
// Types
import type { HandlerConfigWithDefaults } from './index.types.js';
import type { SearchOptions } from './client.types.js';
// Lib
import { destructureNumericFilter } from './lib/facets.js';

/**
 * This file is for validation of the payload from the client
 */

export const SearchOptionsSchema = implement<SearchOptions>().with({
  // * Query
  // * ✅ 1/3 🛑
  query: z.string().optional(),
  // * Attributes
  // * ✅ 1/2 🛑
  attributesToRetrieve: z.array(z.string()).optional(),
  // * Filtering
  // * ✅ 1/6 🛑
  facetFilters: z
    .union([z.array(z.string()), z.array(z.array(z.string()))])
    .optional(),
  numericFilters: z.array(z.string()).optional(),
  // tagFilters: z.union([z.array(z.string()), z.string()]).optional(),
  // * Faceting
  // * ✅ 1/3 🛑
  facets: z.union([z.string(), z.array(z.string())]).optional(),
  maxValuesPerFacet: z.number().optional(),
  sortFacetValuesBy: z
    .union([z.literal('count'), z.literal('alpha')])
    .optional(),
  // * Highlighting Snippeting
  // * ✅ 3/5 🛑
  attributesToHighlight: z.array(z.string()).optional(),
  highlightPostTag: z.string().optional(),
  highlightPreTag: z.string().optional(),
  // * Pagination
  // * ✅ 4/4 ✅
  // Optional pagination params
  page: z.number().gte(0).lte(MAX_PAGES).optional(),
  hitsPerPage: z.number().gte(0).lte(MAX_HITS_PER_PAGE).optional(),
  // We should either have (page & hitsPerPage) or (offset & length)
  offset: z.number().gte(0).lte(MAX_HITS_TOTAL).optional(),
  length: z.number().gte(1).lte(MAX_HITS_PER_PAGE).optional(),
  // * Advanced
  // * ✅ 1/14 🛑
  maxFacetHits: z.number().optional(),
});

/**
 * Input validation with zod
 * Successful validation returns a typed object
 */

export const IndexName = z
  .string()
  .max(200)
  .min(1)
  .regex(new RegExp(/^[a-z0-9_\?\,\=\+]+$/));

const RequestSchema = z.object({
  params: SearchOptionsSchema,
  indexName: IndexName,
});

const RequestSchemaInitial = z.object({
  params: z.any(),
  indexName: IndexName,
});

export const initialValidation = (payload: any) => {
  const Payload = z.object({
    requests: z.array(RequestSchemaInitial).max(15),
  });

  return Payload.safeParse(payload);
};

export const validatePayload = (
  request: z.infer<typeof RequestSchemaInitial>,
  clientValidation: HandlerConfigWithDefaults['clientValidation']
) => {
  const {
    validAttributesToRetrieve,
    validAttributesToHighlight,
    validHighlightPostTags,
    validHighlightPreTags,
    validFacetFilters,
    maxPage,
    maxHitsPerPage,
    maxOffset,
    maxLength,
  } = clientValidation;

  const RequestSchemaRefined = RequestSchema.refine(
    ({ params: { attributesToRetrieve } }) =>
      undefinedOrIn(attributesToRetrieve, validAttributesToRetrieve),
    'Invalid attributesToRetrieve'
  )
    .refine(
      ({ params: { attributesToHighlight } }) =>
        undefinedOrIn(attributesToHighlight, validAttributesToHighlight),
      'Invalid attributesToHighlight'
    )
    .refine(
      ({ params: { page } }) => undefinedOrLte(page, maxPage),
      'Invalid page'
    )
    .refine(
      ({ params: { hitsPerPage } }) =>
        undefinedOrLte(hitsPerPage, maxHitsPerPage),
      'Invalid hitsPerPage'
    )
    .refine(
      ({ params: { offset } }) => undefinedOrLte(offset, maxOffset),
      'Invalid offset'
    )
    .refine(
      ({ params: { length } }) => undefinedOrLte(length, maxLength),
      'Invalid length'
    )
    .refine(
      ({ params: { highlightPostTag } }) =>
        undefinedOrIn(highlightPostTag, validHighlightPostTags),
      'Invalid highlightPostTag'
    )
    .refine(
      ({ params: { highlightPreTag } }) =>
        undefinedOrIn(highlightPreTag, validHighlightPreTags),
      'Invalid highlightPreTag'
    )
    .refine(({ params: { facetFilters } }) => {
      if (!facetFilters || validFacetFilters.includes('*')) return true;
      const facets = facetFilters.flat().map((v) => v.split(':')[0]);
      return facets.every((v) => validFacetFilters.includes(v));
    }, 'Invalid facetFilters')
    .refine(({ params: { numericFilters } }) => {
      if (!numericFilters || validFacetFilters.includes('*')) return true;
      return numericFilters
        .flat()
        .map((v) => {
          const { attribute, operator, value } = destructureNumericFilter(v);
          return validFacetFilters.includes(attribute) && !!operator && !!value;
        })
        .every((v) => v);
    }, 'Invalid numericFilters');

  return RequestSchemaRefined.safeParse(request);
};

// export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

// const PgOptions = z.object({
//   // an array of columns
//   highlightColumns: z.array(z.string()).optional(),
//   returnColumns: z.array(z.string()).optional(),
//   language: z.string().optional(),
// });

// export type Request = z.infer<typeof Request>;
// export type PgOptions = z.infer<typeof PgOptions>;
export type RequestSchemaInitial = z.infer<typeof RequestSchemaInitial>;
