import { getHighlight } from '@/lib/highlight.js';

/**
 * Test pagination
 */

describe('highlight', () => {
  it('should handle offset and length', async () => {
    const highlight = getHighlight({
      params: {
        query: 'test',
        highlightPreTag: '__ais-highlight__',
        highlightPostTag: '__/ais-highlight__',
      },
      highlightColumns: ['primarytitle', 'genres', 'titletype'],
    });

    expect(highlight?.db.formatted[0]).toBe(`ts_headline(
        primarytitle, 
        websearch_to_tsquery('test'), 
        'StartSel=__ais-highlight__, StopSel=__/ais-highlight__'
        ) AS _highlight_primarytitle`);

    //  `ts_headline('english', genres, websearch_to_tsquery('test'), 'StartSel=__ais-highlight__, StopSel=__/ais-highlight__') AS _highlight_genres,`,
    //     `ts_headline('english', titletype, websearch_to_tsquery('test'), 'StartSel=__ais-highlight__, StopSel=__/ais-highlight__') AS _highlight_titletype`,
    //   ]

    // const result = doHighlight({
    //   columns: ['primarytitle', 'genres', 'titletype'],
    //   highlightPostTag: '__/ais-highlight__',
    //   highlightPreTag: '__ais-highlight__',
    //   hit: {
    //     genres: 'Drama,Short',
    //     tconst: 'tt0000772',
    //     endyear: null,
    //     isadult: false,
    //     startyear: 1908,
    //     titletype: 'short',
    //     primarytitle: 'The Test of Friendship',
    //     originaltitle: 'The Test of Friendship',
    //     runtimeminutes: 13,
    //     _highlight_genres: 'Drama',
    //     _highlight_titletype: 'short',
    //     _highlight_primarytitle:
    //       '__ais-highlight__Test__/ais-highlight__ of Friendship',
    //     postgres_searchbox_v1_doc:
    //       "'drama':11 'friendship':6,10 'short':2,12 'test':4,8 'tt0000772':1",
    //   },
    // });

    return;
  });
});
