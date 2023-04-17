export function make_client(searchApiUrl) {
  return {
    search: async (queries) => {
      const resp = await fetch(searchApiUrl, {
        method: 'POST',
        body: JSON.stringify(queries[0]),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        throw new Error(resp.body);
      }
      return await resp.json();
    },
  };
}
