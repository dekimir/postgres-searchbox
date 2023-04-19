import { getTableAndSort } from '@/lib/sort.js';
import { IndexName } from '@/index.validation.js';

/**
 * Test pagination
 */

describe('sort', () => {
  /**
   * Validation
   */

  it('should validate index name', async () => {
    const indexName = 'table?sort=column1';

    const parsed = IndexName.safeParse(indexName);

    expect(parsed.success).toBe(true);
  });

  it('should catch invalid index name', async () => {
    const indexName = 'table?sort=column1;DROP TABLE table';

    const parsed = IndexName.safeParse(indexName);

    expect(parsed.success).toBe(false);
  });

  /**
   * getTableAndSort
   */

  it('should handle get sort and table', async () => {
    const sort = getTableAndSort('table?sort=column1');

    expect(sort).toEqual({
      table: 'table',
      formatedSort: 'ORDER BY column1',
    });
  });

  it('should handle get sort and table with DESC', async () => {
    const sort = getTableAndSort('table?sort=column1 DESC');

    expect(sort).toEqual({
      table: 'table',
      formatedSort: 'ORDER BY column1 DESC',
    });
  });

  it('should handle get sort and table with multiple columns', async () => {
    const sort = getTableAndSort('table?sort=column1 DESC,column2 ASC');

    expect(sort).toEqual({
      table: 'table',
      formatedSort: 'ORDER BY column1 DESC, column2 ASC',
    });
  });

  it('should handle NULLS LAST', async () => {
    const sort = getTableAndSort('table?sort=column1 DESC NULLS  LAST');

    expect(sort).toEqual({
      table: 'table',
      formatedSort: 'ORDER BY column1 DESC NULLS LAST',
    });
  });

  it('should return empty string if no sort', async () => {
    const sort = getTableAndSort('table');

    expect(sort).toEqual({
      table: 'table',
      formatedSort: '',
    });
  });

  it('should throw n empty table name', async () => {
    expect(() => getTableAndSort('?sort=column1')).toThrow();
  });
});
