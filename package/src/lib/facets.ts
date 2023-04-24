import format from 'pg-format';
import type { Props, GetFacetsReturn } from './facets.types.js';

/**
 * Ambiguous params
 * maxValuesPerFacet: The maximum number of facet values to return for each facet in a regular search.
 * sortFacetValuesBy: Controls how facet values are fetched.
 * maxFacetHits: Maximum number of facet hits to return during a search for facet values.
 */

export const getFacets = async ({
  facets: facetsMaybeString,
  attributesForFaceting,
  maxValuesPerFacet,
  sortFacetValuesBy,
  maxFacetHits,
  renderingContent,
}: Props): Promise<GetFacetsReturn> => {
  // Build facets based on 2 conditionals
  const facets: readonly string[] =
    facetsMaybeString?.includes('*') || !facetsMaybeString
      ? attributesForFaceting // facetsMaybeString is * or undefined
      : Array.isArray(facetsMaybeString) // is it an array already?
      ? facetsMaybeString // yes
      : [facetsMaybeString]; // no, string cast to array

  if (!facets?.length) return null;

  const limit = Number.isInteger(maxValuesPerFacet) ? maxValuesPerFacet : 10;

  // For things like
  const cte = facets
    .map((facet) =>
      format(
        /* sql */ `
        %I AS (
          SELECT coalesce( 
            json_object_agg( %s, cnt ORDER BY cnt DESC ), 
            '{}'::json
          ) as details
            FROM (
              SELECT %s, count(*) AS cnt
              FROM all_selection
              WHERE %s IS NOT NULL
              GROUP by %s
              ORDER BY ${
                sortFacetValuesBy === 'count' ? `count(%L) DESC` : `%s ASC`
              } 
              LIMIT ${limit}
            ) t
        )
      `,
        `${facet}_selection`,
        facet,
        facet,
        facet,
        facet,
        facet,
        facet
      )
    )
    .join(',');

  const json = /* sql */ `
    'facets', json_build_object(
      ${facets
        .map((facet) =>
          format(`%L, (SELECT details FROM %I)`, facet, `${facet}_selection`)
        )
        .join(',')}
    )`;

  const order = renderingContent?.facetOrdering?.facets?.order;
  const values = renderingContent?.facetOrdering?.values;

  // Build up the object based on the facets
  let newOrder: string[] | undefined;
  if (order?.includes('*')) {
    newOrder = facets.map((f) => f);
  }

  return {
    db: { cte, json },
    renderingContent: {
      ...renderingContent,
      facetOrdering: {
        ...renderingContent?.facetOrdering,
        facets: {
          order: newOrder || order,
        },
        // TODO values
        values,
      },
    },
  };
};
