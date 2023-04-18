import { getFacets } from '@/lib/facets.js';

/**
 * Test attributes
 */

describe('attributes', () => {
  it.only('should return SQL from facetFilters', async () => {
    const returnValue = await getFacets(
      {
        facetFilters: `[
          ["attribute1:value", "attribute1:value2", "attribute2:value", "attribute5:value" ],
          "attribute3:value" , "attribute3:-value2", "attribute4:value2"
        ]`,
        facets: 'attribute1',
        numericFilters: `["price>=11","price>=12","price<=15","price=[12,14]"]`,
      },
      {
        facets: ['attribute3', 'price'],
        disjunctiveFacets: ['attribute1', 'attribute2'],
        hierarchicalFacets: [],
      }
    );

    expect(returnValue?.db?.formatted).toMatchSnapshot();
  });
});
