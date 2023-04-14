// node
import https from 'node:https';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
// npm
import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';

/**
 * Helper functions specifically for the scripts directory
 */

export const canConnectToDatabase = async () => {
  const client = new Client();
  client.connect();
  const sql = format('SELECT 1');

  try {
    const results = await client.query(sql);
    if (!results.rows.length) return false;
    return true;
  } catch (error) {
    return false;
  } finally {
    client.end();
  }
};

export const doesTableExist = async ({ tableName }: { tableName: string }) => {
  const client = new Client();
  client.connect();
  const sql = format(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %L)`,
    tableName
  );
  try {
    const results = await client.query(sql);
    if (!results.rows.length) return false;
    return true;
  } catch (error) {
    return false;
  } finally {
    client.end();
  }
};

export const readyToCreateOrDrop = async ({
  tableName,
}: {
  tableName: string;
}) => {
  if (!tableName?.length) {
    throw Error(
      `Did you forget to set PG_SB_TABLE_NAME?. Try running:
        PG_SB_TABLE_NAME=table_name yarn script:create-index OR
        PG_SB_TABLE_NAME=table_name yarn script:drop-index
      `
    );
  }

  // Run both checks in parallel
  const [canConnect, tableExists] = await Promise.all([
    canConnectToDatabase(),
    doesTableExist({ tableName }),
  ]);

  if (!canConnect) {
    throw Error(
      'Cannot connect to database, ensure environment variables are set correctly.'
    );
  }

  if (!tableExists) {
    throw Error(`Table ${tableName} does not exist.`);
  }

  return canConnect && tableExists;
};

/**
 * Get text columns from a table
 */

export async function getTextColumnsFromTable({
  tableName,
}: {
  tableName: string;
}) {
  const client = new Client();
  client.connect();
  const sql = format(
    `SELECT column_name FROM information_schema.columns WHERE table_name = %L AND data_type = %L`,
    tableName,
    'text'
  );
  const data = await client.query(sql);
  client.end();
  return data.rows.map((row) => row.column_name);
}

/**
 * Check a file or directory exists
 */

export const fileOrDirExists = async (target: string) => {
  let exists = true;
  await fsPromises.access(target).catch((e) => {
    exists = !e;
  });
  return exists;
};

/**
 * Download a file with auto decompression
 */

export const downloadFile = async (
  source: string,
  target: string,
  { skipIfExists }: { skipIfExists?: boolean } = {}
) => {
  if (skipIfExists && (await fileOrDirExists(target))) {
    return console.log('file exists');
  }

  const incompleteTarget = `${target}-incomplete`;

  const output = fs.createWriteStream(incompleteTarget);

  const request = https.get(source, {
    headers: { 'Accept-Encoding': 'gzip,deflate' },
  });

  const promise = new Promise((resolve) => {
    request.on('response', async (response) => {
      let midStream = undefined;

      if (
        source.endsWith('.gz') ||
        response.headers['content-encoding'] === 'gzip' ||
        'application/gzip' === response.headers['content-type']
      ) {
        midStream = zlib.createGunzip();
      } else if (response.headers['content-encoding'] === 'br') {
        midStream = zlib.createBrotliDecompress();
      } else if (response.headers['content-encoding'] === 'deflate') {
        midStream = zlib.createInflate();
      }

      await pipeline([response, ...(midStream ? [midStream] : []), output]);

      await fsPromises.rename(incompleteTarget, target);

      return resolve('');
    });
  });

  return promise;
};
