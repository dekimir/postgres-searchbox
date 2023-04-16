import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
import { faker } from '@faker-js/faker';

function createRandomProduct(i: number) {
  const name = faker.commerce.productName();
  const description = faker.commerce.productDescription();
  // To test the full-text search we need some products to have
  // common words in the name and description
  if (i % 10 !== 0) {
    return [name, description, faker.commerce.price(10, 20000, 0)];
  }

  // Split the name and description into words
  const nameParts = name.split(' ');
  const descriptionParts = description.split(' ');
  // Pick a word from the name
  const namePosition = Math.floor(((i % 3) / 3) * nameParts.length);
  const nameWord = nameParts[namePosition].toLowerCase();
  // Pick a position in the description to insert the name word
  const descriptionPosition = Math.floor(
    ((i % 7) / 7) * descriptionParts.length
  );
  // Add the name word to the description
  descriptionParts.splice(descriptionPosition, 0, nameWord);

  return [name, descriptionParts.join(' '), faker.commerce.price(10, 20000, 0)];
}

export async function initTestDatabase({
  tableName,
  rowCount,
  fakerSeed,
}: {
  tableName: string;
  rowCount: number;
  fakerSeed?: number;
}) {
  const client = new Client();
  client.connect();
  // Create test able if it doesn't exist.
  const sql = format(
    'CREATE TABLE IF NOT EXISTS %I (id SERIAL PRIMARY KEY, name text, description text, price int4)',
    tableName
  );
  // run the sql
  await client.query(sql);
  // Set deed so that values are always the same
  if (fakerSeed) {
    faker.seed(123);
  }
  // Generate commerce test data using faker and createRandomProduct
  // const values = Array.from({ length: rowCount }, createRandomProduct);

  const values = [];
  for (let i = 0; i < rowCount; i++) {
    values.push(createRandomProduct(i));
  }

  // Insert test data into test table
  const insertSql = format(
    'INSERT INTO %I (name, description, price) VALUES %L',
    tableName,
    values
  );
  // Run the insert sql
  await client.query(insertSql);
  // Disconnect client
  await client.end();
}
