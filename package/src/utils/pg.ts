import pkg from 'pg';
const { Client } = pkg;

export const getClient = () => {
  const client = new Client();
  client.connect();
  return client;
};
