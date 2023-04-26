import { getSearchHandler } from 'postgres-searchbox';
// During postgres-searchbox development this can be:
// import { getSearchHandler } from '../../../../package/build/index.js';

// https://github.com/algolia/algoliasearch-client-javascript/blob/eacfca290813eac98211b0da3c78c41393977c37/packages/client-search/src/types/Settings.ts

export default getSearchHandler([
  {
    indexName: 'postgres_searchbox_movies',
  },
  {
    indexName: 'bestbuy_product',
    // Settings https://www.algolia.com/doc/api-reference/settings-api-parameters/
    settings: {
      attributesToRetrieve: [
        'name',
        'image',
        'description',
        'price',
        'objectid',
      ],
      attributesForFaceting: [
        'brand',
        'hierarchicalCategorieslvl0',
        'hierarchicalCategorieslvl1',
        'hierarchicalCategorieslvl2',
        'hierarchicalCategorieslvl3',
        'hierarchicalCategorieslvl4',
        'free_shipping',
        'price',
        'rating',
        'type',
      ],
      attributesToHighlight: ['name', 'description'],
      renderingContent: {
        facetOrdering: {
          facets: {
            order: [
              'brand',
              'hierarchicalCategorieslvl0',
              'price',
              'free_shipping',
              'rating',
              'type',
            ],
          },
          values: {
            hierarchicalCategorieslvl0: {
              sortRemainingBy: 'alpha',
            },
            brand: {
              sortRemainingBy: 'count',
            },
            rating: {
              sortRemainingBy: 'count',
            },
            price: {
              sortRemainingBy: 'count',
            },
            type: {
              sortRemainingBy: 'count',
            },
            free_shipping: {
              sortRemainingBy: 'count',
            },
          },
        },
      },
    },
  },
]);
