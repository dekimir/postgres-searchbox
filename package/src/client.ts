import { Request } from './client.types';

// export interface ClientOptions {
//   highlightColumns?: string[];
//   returnColumns?: string[];
//   language?: string;
// }

export function make_client(
  searchApiUrl: string
  // , pgOptions?: ClientOptions
) {
  return {
    search: async (requests: Request[]) => {
      const resp = await fetch(searchApiUrl, {
        method: 'POST',
        body: JSON.stringify({
          requests,
          // pgOptions
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        throw new Error(resp.body?.toString());
      }
      return await resp.json();
    },
  };
}
