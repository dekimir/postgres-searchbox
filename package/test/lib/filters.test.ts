import { defaults } from '@/constants.js';
import { getFilters } from '@/lib/filters.js';

/**
 * Test filters
 */

describe('filters', () => {
  it.only('should return SQL from facetFilters & numericFilters', async () => {
    const returnValue = await getFilters({
      ...defaults.settings,
      facetFilters: [
        [
          'attribute1:value',
          'attribute1:value2',
          'attribute2:value',
          'attribute5:value',
        ],
        'attribute3:value',
        'attribute3:-value2',
        'attribute4:value2',
      ],
      numericFilters: [
        'year=2019',
        'price!=[8,16]',
        'price<=15',
        'price<15',
        'price>5',
        'price>11',
        'price>=11',
        'price=11',
        'price=[11,12]',
        'price>=12',
        'price<8',
        'price<=8',
        'price<9',
        'price<=9',
        'price>=13',
        'price>21',
        'price=[12,14]',
        'price>=20',
        'price<24',
        'price<25',
        'price>26',
        'year<2019',
      ],
    });

    expect(returnValue?.db?.formatted).toMatchSnapshot();
  });
});
