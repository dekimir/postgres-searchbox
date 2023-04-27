import format from 'pg-format';
import type { Hit } from '../index.types.js';
import type { ClientOptions } from '../client.js';

// const _expected = {
//   _highlightResult: {
//     name: {
//       value:
//         'Samsung - 2.1-Channel Soundbar __ais-highlight__Sy__/ais-highlight__stem with Wireless Subwoofer - Black',
//       matchLevel: 'full',
//       fullyHighlighted: false,
//       matchedWords: ['siy'],
//     },
//     description: {
//       value:
//         'This Samsung soundbar has a 37-inch soundboard with a wireless 6.5-inch subwoofer. The 300W power output provides a rich, surround sound feel. Bluetooth connectivity, HDMI and USB ports let you connect this soundbar to any device. Control this Samsung soundbar using your phone or mobile device with the Samsung Audio Remote app.',
//       matchLevel: 'none',
//       matchedWords: [],
//     },
//   },
// };

interface Props {
  clientOptions?: ClientOptions;
  params: {
    highlightPreTag?: string;
    highlightPostTag?: string;
    query: string;
  };
}

type Return = {
  db: {
    formatted: string[];
  };
  updateHit: (row: Hit) => Hit;
} | null;

export const getHighlight = ({
  clientOptions: { highlightColumns, language } = {},
  params: { highlightPreTag, highlightPostTag, query },
}: Props): Return => {
  if (!highlightColumns || !highlightPreTag || !highlightPostTag) {
    return null;
  }

  const formatted = highlightColumns.map((c) =>
    format(
      /* sql */ `
        ts_headline(
          %L,
          %I,
          websearch_to_tsquery(%L),
          'StartSel=%I,StopSel=%I,MaxFragments=2,HighlightAll=true'
        ) AS %I
        `,
      language || 'english',
      c,
      query,
      highlightPreTag,
      highlightPostTag,
      `_highlight_${c}`
    )
  );

  const updateHit = (hit: Hit): Hit => {
    hit._highlightResult = {};

    for (const column of highlightColumns) {
      const highlight = hit[`_highlight_${column}`]?.toString();

      // Delete the _highlight_* columns - theyre just used internally by this function
      delete hit[`_highlight_${column}`];

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
