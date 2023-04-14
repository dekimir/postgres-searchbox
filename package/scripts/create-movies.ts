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
import { canConnectToDatabase, doesTableExist, downloadFile } from './lib.js';

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
  // const target = '/tmp/title.basics.tsv';
  const target = '/home/default/src/title.basics.tsv';
  // const target = '/home/default/src/title.basics.sample.tsv';
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
 * Drop table
 */

export async function dropTable({ tableName }: { tableName: string }) {
  const client = new Client();
  client.connect();
  const sql = format('DROP TABLE IF EXISTS %I', tableName);
  await client.query(sql);
  client.end();
}

/**
 * Run the script when called from package.json
 */

if (process.env.PG_SB_CREATE_MOVIES === 'true') {
  const tableName = 'postgres_searchbox_movies';
  if (!(await canConnectToDatabase()))
    throw Error('Could not connect to database');
  if (!(await doesTableExist({ tableName })))
    throw Error('Table does not exist');
  // Can connect to db and table exists, so create index
  await createTable({ tableName });
  // Populate with data
  await importData({ tableName });
  // Create vector column and index
  await createColumnAndIndex({ tableName });
  console.log(`Created table ${tableName} successfully`);
}

if (process.env.PG_SB_DROP_MOVIES === 'true') {
  const tableName = 'postgres_searchbox_movies';
  if (!(await canConnectToDatabase()))
    throw Error('Could not connect to database');
  if (!(await doesTableExist({ tableName })))
    throw Error('Table does not exist');
  // Can connect to db and table exists, so create index
  await dropTable({ tableName });
  console.log(`Dropped table successfully: ${tableName}`);
}
