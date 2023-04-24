// node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
// npm
import pkg from 'pg';
const { Client } = pkg;
// Relative
import { createColumnAndIndex } from './create-index.js';
import { readyToCreateOrDrop, dropTable, downloadFile } from './lib.js';

/**
 * Import data from remote .sql dump
 */

export async function importData({ tableName }: { tableName: string }) {
  const client = new Client();
  client.connect();

  // download the file with fetch
  const source =
    'https://raw.githubusercontent.com/data-envoy/datasets/main/bestbuy.sql';
  // decleare a path for the file
  const target = '/tmp/bestbuy.sql';
  // Check if file exists at target
  if (!fs.existsSync(target)) {
    await downloadFile(source, target);
  }

  const sql = fs.readFileSync(target, 'utf8');

  await client.query(sql);

  client.end();

  // delete the file
  await fsPromises.unlink(target);
}

/**
 * Run the script when called from package.json
 * Self init functions because top-level await is
 * un-supported in node < v14.8.0.
 */

(async () => {
  const tableName = 'bestbuy_product';

  if (process.env.PG_SB_CREATE_STORE === 'true') {
    // Check db and table exist - throws if not
    await readyToCreateOrDrop({ tableName });
    // Can connect to db and table exists, so import the sql dump
    console.log(`Creating table and Importing data...`);
    await importData({ tableName });
    console.log(`Done`);
    // Create vector column and index
    console.log(`Creating vector column and index...`);
    await createColumnAndIndex({ tableName });
    console.log(`Done`);
  }

  if (process.env.PG_SB_DROP_STORE === 'true') {
    // Check db and table exist - throws if not
    await readyToCreateOrDrop({ tableName });
    // Can connect to db and table exists, so create index
    await dropTable({ tableName });
    console.log(`Dropped table successfully: ${tableName}`);
  }
})();
