import format from 'pg-format';
// Types
import type { SearchOptions } from '../client.types.js';
import type { Hit, Settings } from '../index.types.js';

interface Props {
  query?: SearchOptions['query'];
  attributesToHighlight: Required<Settings>['attributesToHighlight'];
  highlightPreTag: Required<Settings>['highlightPreTag'];
  highlightPostTag: Required<Settings>['highlightPostTag'];
}

type Return = {
  db: {
    formatted: string[];
  };
  updateHit: (row: Hit) => Hit;
} | null;

export const getHighlight = ({
  query,
  attributesToHighlight,
  highlightPreTag,
  highlightPostTag,
}: Props): Return => {
  const language = 'english';

  if (!attributesToHighlight?.length) {
    return null;
  }

  const formatted = attributesToHighlight.map((c) =>
    format(
      /* sql */ `
        ts_headline(
          %L,
          %I,
          websearch_to_tsquery(%L),
          'StartSel=%I,StopSel=%I,MaxFragments=2,HighlightAll=true'
        ) AS %I
        `,
      language,
      c,
      query,
      highlightPreTag,
      highlightPostTag,
      `postgres_searchbox_v1_highlight_${c}`
    )
  );

  const updateHit = (hit: Hit): Hit => {
    hit._highlightResult = {};

    for (const column of attributesToHighlight) {
      const highlight =
        hit[`postgres_searchbox_v1_highlight_${column}`]?.toString();

      // Delete the postgres_searchbox_v1_highlight_* columns - they're just used internally by this function
      delete hit[`postgres_searchbox_v1_highlight_${column}`];

      if (!highlight?.includes(highlightPreTag)) {
        hit._highlightResult[column] = {
          value: typeof hit[column] === 'string' ? (hit[column] as string) : '',
          matchLevel: 'none',
          matchedWords: [],
        };
      } else {
        // console.log({ highlight, query });
        hit._highlightResult[column] = {
          value: highlight,
          // Need to look at more example data to figure out how to build this
          matchLevel: 'full', // todo
          fullyHighlighted: false, // todo
          matchedWords: [], // todo
        };
      }
    }

    return hit;
  };

  return { db: { formatted }, updateHit };
};
