export function make_client(searchApiUrl) {
  return {
    search: async (queries) => {
      const resp = await fetch(searchApiUrl, { method: 'POST', body: JSON.stringify(queries[0]) })
      if (!resp.ok) { throw new Error(resp.body) }
      return await resp.json()
    },
  }
}
