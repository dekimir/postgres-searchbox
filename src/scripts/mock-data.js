import pkg from 'pg';
const { Client } = pkg;
import format from 'pg-format';
import { faker } from '@faker-js/faker';

function createRandomProduct() {
  return [
    faker.commerce.productName(),
    faker.commerce.productDescription(),
    faker.commerce.price(10, 20000, 0),
  ];
}

export async function initTestDatabase({ tableName, rowCount, fakerSeed }) {
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
    values.push(createRandomProduct());
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
