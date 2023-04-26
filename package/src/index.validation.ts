import { z } from 'zod';
// Constants
import {
  MAX_REQ_PER_HTTP_REQ,
  MAX_HITS_PER_PAGE,
  MAX_HITS_TOTAL,
  MAX_PAGES,
} from './constants.js';
// Lib
import { destructureNumericFilter } from './lib/filters.js';
// Utils
import { implement, isIn, undefinedOrLte } from './utils/index.js';
// Types
import type { SearchOptions } from './client.types.js';
import type { Handler } from './index.types.js';

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
  // * ✅ 2/6 🛑
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
  // * FacetQuery
  facetQuery: z.string().optional(),
});

/**
 * Input validation with zod
 * Successful validation returns a typed object
 */

/**
 * Initial validation of the payload
 * This is to ensure that the payload is an array of objects
 * with indexName and params
 */

export const IndexName = z
  .string()
  .max(200)
  .min(1)
  .regex(new RegExp(/^[a-z0-9_\?\,\=\+]+$/));

const RequestSchemaInitial = z.object({
  indexName: IndexName,
  params: z.any(),
  // For facet searches
  facet: z.string().optional(),
  type: z.literal('facet').optional(),
});

export const initialValidation = (payload: any) => {
  const Payload = z.object({
    requests: z.array(RequestSchemaInitial).max(MAX_REQ_PER_HTTP_REQ),
  });

  return Payload.safeParse(payload);
};

export type RequestInitial = z.infer<typeof RequestSchemaInitial>;

/**
 * 2nd validation - for each object of the payload
 */

const RequestSchema = z.object({
  indexName: IndexName,
  params: SearchOptionsSchema,
  // For facet searches
  facet: z.string().optional(),
  type: z.literal('facet').optional(),
});

export const validatePayload = (
  request: z.infer<typeof RequestSchemaInitial>,
  clientValidation: Handler.ConfigWithDefaults['clientValidation'],
  mergedSettings: Handler.ConfigWithDefaults['settings']
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

  /**
   * Depending on the type use a different schema for params
   * facet type also has 2 additional properties.
   */

  const RequestSchemaRefined = RequestSchema.refine(
    ({ params: { attributesToRetrieve } }) =>
      validAttributesToRetrieve.includes('*') ||
      isIn(
        attributesToRetrieve || mergedSettings.attributesToRetrieve,
        validAttributesToRetrieve
      ),
    'Invalid attributesToRetrieve, not contained by validAttributesToRetrieve'
  )
    .refine(
      ({ params: { attributesToHighlight } }) =>
        validAttributesToHighlight.includes('*') ||
        isIn(
          attributesToHighlight || mergedSettings.attributesToHighlight,
          validAttributesToHighlight
        ),
      'Invalid attributesToHighlight, not contained by validAttributesToHighlight'
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
        isIn(
          highlightPostTag || mergedSettings.highlightPostTag,
          validHighlightPostTags
        ),
      'Invalid highlightPostTag, not in validHighlightPostTags'
    )
    .refine(
      ({ params: { highlightPreTag } }) =>
        isIn(
          highlightPreTag || mergedSettings.highlightPreTag,
          validHighlightPreTags
        ),
      'Invalid highlightPreTag, not in validHighlightPostTags'
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
    }, 'Invalid numericFilters')
    .refine(({ type, facet, params: { facetQuery } }) => {
      if (type !== 'facet') return true;
      return facet?.length && facetQuery;
    }, 'Invalid facet search');

  return RequestSchemaRefined.safeParse(request);
};

export default {
  initial: initialValidation,
  payload: validatePayload,
};
