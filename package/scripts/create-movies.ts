// node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
// npm
import pkg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
const { Client } = pkg;
import format from 'pg-format';
// Relative
import { createColumnAndIndex } from './create-index.js';
import { readyToCreateOrDrop, dropTable, downloadFile } from './lib.js';

/**
 * Create a table with tableName
 */

export async function createTable({ tableName }: { tableName: string }) {
  const client = new Client();
  client.connect();

  const sql = format(
    `CREATE TABLE IF NOT EXISTS %I (
        tconst text PRIMARY KEY, 
        titletype text,
        primaryTitle text,
        originalTitle text,
        isAdult boolean,
        startYear int4,
        endYear int4,
        runtimeMinutes int4,
        genres text
    )`,
    tableName
  );
  await client.query(sql);
  client.end();
}

/**
 * Import data from remote tsv
 */

export async function importData({ tableName }: { tableName: string }) {
  const client = new Client();
  client.connect();

  // download the file with fetch
  const source = 'https://datasets.imdbws.com/title.basics.tsv.gz';
  // decleare a path for the file
  const target = '/tmp/title.basics.tsv';
  // Check if file exists at target
  if (!fs.existsSync(target)) {
    await downloadFile(source, target);
  }

  // Stream local file to database with STDIN

  // Create a temp table with the same schema as the target table
  const sql = format(`CREATE TEMP TABLE temp_table AS TABLE %I`, tableName);
  // Run the query
  await client.query(sql);

  const columnSql = format(`
        ALTER TABLE temp_table 
            ALTER isAdult TYPE text, 
            ALTER startYear TYPE text,
            ALTER endYear TYPE text,
            ALTER runtimeMinutes TYPE text
    `);
  await client.query(columnSql);

  // Stream remote file to database with STDIN
  // See: https://gist.github.com/1mehal/13c85e108cbc906f5ec34d28d75b1968
  const dbStream = client.query(
    copyFrom(
      `COPY temp_table FROM STDIN delimiter E'\t' NULL AS '\N' QUOTE E'\b' CSV header`
    )
  );

  const readStream = fs.createReadStream(target);

  await pipeline([readStream, dbStream]);

  // copy data from temp table to target table
  const copySql = format(
    /* sql */ `
        INSERT INTO %I 
        SELECT 
            tconst,
            titletype,
            primaryTitle,
            originalTitle,
            isAdult::boolean,
            NULLIF(startYear, '\\N')::int4,
            NULLIF(endYear, '\\N')::int4,
            NULLIF(runtimeMinutes, '\\N')::int4,
            genres
        FROM temp_table
    `,
    tableName
  );

  await client.query(copySql);

  // Drop temp table
  const dropSql = format(`DROP TABLE temp_table`);
  await client.query(dropSql);

  client.end();

  // delete the file
  await fsPromises.unlink(target);
}

/**
 * Run the script when called from package.json
 * Self init async functions functions because of issues
 * with top-level await and with swc (dev and test scripts)
 */

(async () => {
  const tableName = 'postgres_searchbox_movies';

  if (process.env.PG_SB_CREATE_MOVIES === 'true') {
    // Check db and table exist - throws if not
    await readyToCreateOrDrop({ tableName });
    // Can connect to db and table exists, so create index
    console.log(`Creating table ${tableName}...`);
    await createTable({ tableName });
    console.log(`Done`);
    // Populate with data
    console.log(`Importing data...`);
    await importData({ tableName });
    console.log(`Done`);
    // Create vector column and index
    console.log(`Creating vector column and index...`);
    await createColumnAndIndex({ tableName });
    console.log(`Done`);
  }

  if (process.env.PG_SB_DROP_MOVIES === 'true') {
    // Check db and table exist - throws if not
    await readyToCreateOrDrop({ tableName });
    // Can connect to db and table exists, so create index
    await dropTable({ tableName });
    console.log(`Dropped table successfully: ${tableName}`);
  }
})();
