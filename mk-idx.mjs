import pkg from 'pg';
const { Client } = pkg;
import * as readline from 'node:readline'

const rl = readline.createInterface(process.stdin)

var table = 'your_table_name_here'
var textColumns = []

for await (const line of rl) {
  const m = line.match(/\\d\s+"?(\w+)"?/)
  if (m !== null) { table = m[1] }
  else {
    const parts = line.split('|')
    if (parts.length > 2 && parts[2].trim() === 'text') {
      textColumns.push(parts[1].trim())
    }
  }
}

const valExpr = textColumns.map(c => `COALESCE(${c}, '') || ''`).join(' || ')

console.log(
  `ALTER TABLE ${table} ADD COLUMN postgres_searchbox_v1_doc tsvector GENERATED ALWAYS AS (to_tsvector('english', ${valExpr})) STORED;`)
console.log(`CREATE INDEX postgres_searchbox_v1_idx_${table} ON ${table} USING GIN(postgres_searchbox_v1_doc);`)
