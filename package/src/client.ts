import { Request } from './client.types';

export function make_client(searchApiUrl: string) {
  return {
    search: async (requests: Request[]) => {
      const resp = await fetch(searchApiUrl, {
        method: 'POST',
        body: JSON.stringify({
          requests,
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
