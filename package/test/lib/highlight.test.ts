import { getHighlight } from '@/lib/highlight.js';

// remove line breaks and any extra spaces
const normalizeSql = (sql: string) => {
  return sql
    .replace(/\r?\n|\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Test pagination
 */

describe('highlight', () => {
  it('should handle offset and length', async () => {
    const props = {
      params: {
        query: 'test',
        highlightPreTag: '__ais-highlight__',
        highlightPostTag: '__/ais-highlight__',
      },
      clientOptions: {
        highlightColumns: ['primarytitle', 'genres', 'titletype'],
        language: 'english',
      },
    };

    const highlight = getHighlight(props);

    if (!highlight?.db.formatted[0]) {
      return expect(highlight?.db.formatted[0]).toBeTruthy();
    }

    // for all formatted sql statements
    highlight?.db.formatted.forEach((sql, index) => {
      const column = props.clientOptions.highlightColumns[index];

      const expected = normalizeSql(/* sql */ `
        ts_headline(
          'english',
          ${column}, 
          websearch_to_tsquery('test'), 
          'StartSel=\"__ais-highlight__\",StopSel=\"__/ais-highlight__\",MaxFragments=2,HighlightAll=true'
        ) AS _highlight_${column}
      `);

      expect(normalizeSql(sql)).toBe(expected);
    });
  });
});
