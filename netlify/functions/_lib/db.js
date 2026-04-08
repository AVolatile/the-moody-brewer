'use strict';

const { neon } = require('@netlify/neon');

let sqlInstance = null;
let schemaReadyPromise = null;

function getSql() {
  const connectionString = process.env.NETLIFY_DATABASE_URL_UNPOOLED || process.env.NETLIFY_DATABASE_URL;

  if (!connectionString) {
    const error = new Error('NETLIFY_DATABASE_URL or NETLIFY_DATABASE_URL_UNPOOLED must be configured.');
    error.statusCode = 500;
    throw error;
  }

  if (!sqlInstance) {
    sqlInstance = neon(connectionString);
  }

  return sqlInstance;
}

async function ensureDatabase() {
  if (!schemaReadyPromise) {
    const { ensureSchema } = require('./schema');
    schemaReadyPromise = ensureSchema(getSql());
  }

  return schemaReadyPromise;
}

module.exports = {
  ensureDatabase,
  getSql
};
