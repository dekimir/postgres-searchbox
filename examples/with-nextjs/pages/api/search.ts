// import { searchHandler } from 'postgres-searchbox';
// During postgres-searchbox development this can be:
import { getSearchHandler } from '../../../../package/build';

// https://github.com/algolia/algoliasearch-client-javascript/blob/eacfca290813eac98211b0da3c78c41393977c37/packages/client-search/src/types/Settings.ts

export default getSearchHandler([
  {
    indexName: 'postgres_searchbox_movies',
    facets: [],
    disjunctiveFacets: ['startyear', 'titletype'],
    // https://www.algolia.com/doc/api-reference/api-methods/set-settings/

    clientValidation: {
      // * Attributes
      // validAttributesToRetrieve
      validAttributesToHighlight: ['primarytitle'],
    },
    // Settings https://www.algolia.com/doc/api-reference/settings-api-parameters/
    settings: {
      // * Attributes
      searchableAttributes: ['primarytitle', 'genres', 'titletype'],
      attributesForFaceting: ['startyear', 'titletype'],
      attributesToRetrieve: ['primarytitle', 'genres', 'titletype'],
      // * Faceting
      maxValuesPerFacet: 20,
      sortFacetValuesBy: 'count',
      // * Highlighting Snippeting
      attributesToHighlight: ['primarytitle'],
      highlightPreTag: '',
      highlightPostTag: '',
      // * Pagination
      hitsPerPage: 20,
      paginationLimitedTo: 3000,
      // * Advanced
      maxFacetHits: 100,
      renderingContent: {
        facetOrdering: {
          facets: {
            order: ['startyear', 'titletype'],
          },
          values: {
            startyear: {
              sortRemainingBy: 'count',
            },
            titletype: {
              sortRemainingBy: 'count',
            },
          },
        },
      },
    },
  },
]);
