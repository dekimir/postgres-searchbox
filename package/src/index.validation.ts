import { z } from 'zod';
// Constants
import { MAX_REQ_PER_HTTP_REQ } from './constants.js';
// Lib
import { destructureNumericFilter } from './lib/filters.js';
// Utils
import { implement, isIn } from './utils/index.js';
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
  page: z.number().gte(0).optional(),
  hitsPerPage: z.number().gte(0).optional(),
  // We should either have (page & hitsPerPage) or (offset & length)
  offset: z.number().gte(0).optional(),
  length: z.number().gte(1).optional(),
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
    requests: z.array(RequestSchemaInitial).min(1).max(MAX_REQ_PER_HTTP_REQ),
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

  const RequestSchemaRefined = RequestSchema.and(
    z.object({
      params: z.object({
        page: z.number().lte(maxPage).optional(),
        hitsPerPage: z.number().lte(maxHitsPerPage).optional(),
        offset: z.number().lte(maxOffset).optional(),
        length: z.number().lte(maxLength).optional(),
      }),
    })
  )
    .refine(
      ({ params: { attributesToRetrieve } }) =>
        validAttributesToRetrieve.includes('*') ||
        isIn(
          attributesToRetrieve || mergedSettings.attributesToRetrieve,
          validAttributesToRetrieve
        ),
      {
        message:
          'Invalid attributesToRetrieve, expected array to be contained by validAttributesToRetrieve',
        path: ['params', 'attributesToRetrieve'],
        params: { validAttributesToRetrieve },
      }
    )
    .refine(
      ({ params: { attributesToHighlight } }) =>
        validAttributesToHighlight.includes('*') ||
        isIn(
          attributesToHighlight || mergedSettings.attributesToHighlight,
          validAttributesToHighlight
        ),
      {
        message:
          'Invalid attributesToHighlight, expected array to be contained by validAttributesToHighlight',
        path: ['params', 'attributesToHighlight'],
        params: { validAttributesToHighlight },
      }
    )
    .refine(
      ({ params: { highlightPostTag } }) =>
        isIn(
          highlightPostTag || mergedSettings.highlightPostTag,
          validHighlightPostTags
        ),
      {
        message:
          'Invalid highlightPostTag, expected string to be in validHighlightPostTags',
        path: ['params', 'highlightPostTag'],
        params: { validHighlightPostTags },
      }
    )
    .refine(
      ({ params: { highlightPreTag } }) =>
        isIn(
          highlightPreTag || mergedSettings.highlightPreTag,
          validHighlightPreTags
        ),
      {
        message:
          'Invalid highlightPreTag, expected string to be in validHighlightPostTags',
        path: ['params', 'highlightPreTag'],
        params: { validHighlightPreTags },
      }
    )
    .refine(
      ({ params: { facetFilters } }) => {
        if (!facetFilters || validFacetFilters.includes('*')) return true;
        const facets = facetFilters.flat().map((v) => v.split(':')[0]);
        return isIn(facets, validFacetFilters);
      },
      {
        message:
          'Invalid facetFilters, expected array to be contained by validFacetFilters',
        path: ['params', 'facetFilters'],
        params: { validFacetFilters },
      }
    )
    .refine(
      ({ params: { numericFilters } }) => {
        if (!numericFilters || validFacetFilters.includes('*')) return true;
        return numericFilters
          .flat()
          .map((v) => {
            const { attribute, operator, value } = destructureNumericFilter(v);
            return (
              validFacetFilters.includes(attribute) && !!operator && !!value
            );
          })
          .every((v) => v);
      },
      {
        message:
          'Invalid numericFilters, expected array to be contained by validFacetFilters',
        path: ['params', 'numericFilters'],
        params: { validFacetFilters },
      }
    )
    .refine(
      ({ type, facet }) => {
        if (type !== 'facet') return true;
        return facet?.length;
      },
      {
        message: 'Invalid facet expected string when `type: facet`',
        path: ['facet'],
      }
    )
    .refine(
      ({ type, params: { facetQuery } }) => {
        if (type !== 'facet') return true;
        return facetQuery;
      },
      {
        message: 'Invalid facetQuery expected string when `type: facet`',
        path: ['params', 'facetQuery'],
      }
    );
  return RequestSchemaRefined.safeParse(request);
};

export default {
  initial: initialValidation,
  payload: validatePayload,
};
