import { defaults } from '@/constants.js';
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
      ...defaults.settings,
      query: 'test',
      attributesToHighlight: ['primarytitle', 'genres', 'titletype'],
      highlightPreTag: '__ais-highlight__',
      highlightPostTag: '__/ais-highlight__',
    };

    const highlight = getHighlight(props);

    if (!highlight?.db.formatted[0]) {
      return expect(highlight?.db.formatted[0]).toBeTruthy();
    }

    // for all formatted sql statements
    highlight?.db.formatted.forEach((sql, index) => {
      const column = props.attributesToHighlight[index];

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
