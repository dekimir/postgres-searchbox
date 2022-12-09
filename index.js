import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format'

const client = new Client()
client.connect()

export async function handlerNextJS(req, res) {
  const json = JSON.parse(req.body)
  const query = json.params.query
  const table = json.indexName
  const sql = format('SELECT * FROM %I WHERE postgres_searchbox_v1_doc @@ websearch_to_tsquery(%L) LIMIT 10', table, query)
  const matches = await client.query(sql)
  res.status(200).json({
    results: [ { hits: matches.rows } ],
    query
  })
}

export * from './client.js'
