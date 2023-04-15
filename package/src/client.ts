interface Query {
  [key: string]: unknown;
}

export function make_client(
  searchApiUrl: string,
  pgOptions: { highlightColumns: string[] }
) {
  return {
    search: async (queries: Query[]) => {
      const resp = await fetch(searchApiUrl, {
        method: 'POST',
        body: JSON.stringify({ ...queries[0], pgOptions }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        throw new Error(resp.body?.toString());
      }
      return await resp.json();
    },
  };
}