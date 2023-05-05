import { faker } from '@faker-js/faker';
import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';

let previousBrand: string = '';

function createRandomProduct(i: number, fakerSeed: number) {
  // Set seed so that values are consistent even when additional
  // faker.x() calls are added here.
  // Any new faker calls should be added to the end of this function
  // to avoid changing the results of existing faker calls.
  faker.seed(fakerSeed);

  const name = faker.commerce.productName();
  let description = faker.commerce.productDescription();
  // Small price range so we get duplicates
  const price = faker.commerce.price(10, 40, 0);
  let brand = faker.company.name();
  // Save the brand so we can re-use it on the next product
  if (i % 7 === 5) previousBrand = brand;
  // To test the full-text search we need some products to have
  // common words in the name and description.
  // Every 7th product we:
  // - return a product with common words
  // - re-use the previous brand
  if (i % 7 === 6) {
    brand = previousBrand;
    // Add the last word of name to the start of the description
    description = `${name.split(' ').pop()} ${description}`;
  }

  return [name, description, price, brand];
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
    'CREATE TABLE IF NOT EXISTS %I (id SERIAL PRIMARY KEY, name text, description text, price int4, brand text)',
    tableName
  );
  // run the sql
  await client.query(sql);

  // Generate commerce test data using faker and createRandomProduct
  // const values = Array.from({ length: rowCount }, createRandomProduct);

  const values = [];
  for (let i = 0; i < rowCount; i++) {
    values.push(createRandomProduct(i, (fakerSeed ?? 0) + i));
  }

  // Insert test data into test table
  const insertSql = format(
    'INSERT INTO %I (name, description, price, brand) VALUES %L',
    tableName,
    values
  );
  // Run the insert sql
  await client.query(insertSql);
  // Disconnect client
  await client.end();
}
