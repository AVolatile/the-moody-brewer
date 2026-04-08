'use strict';

const { neon } = require('@netlify/neon');

let sqlInstance = null;
let sqlConnectionString = null;
let schemaReadyPromise = null;

function getDatabaseConnection() {
  const candidates = [
    'NETLIFY_DATABASE_URL_UNPOOLED',
    'NETLIFY_DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'DATABASE_URL'
  ];

  for (const key of candidates) {
    const value = String(process.env[key] || '').trim();
    if (value) {
      return { key, value };
    }
  }

  return { key: null, value: '' };
}

function getDatabaseDiagnostics() {
  const connection = getDatabaseConnection();

  return {
    configured: Boolean(connection.value),
    source: connection.key,
    acceptedVariables: [
      'NETLIFY_DATABASE_URL_UNPOOLED',
      'NETLIFY_DATABASE_URL',
      'DATABASE_URL_UNPOOLED',
      'DATABASE_URL'
    ],
    missing: connection.value
      ? []
      : ['NETLIFY_DATABASE_URL_UNPOOLED, NETLIFY_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL']
  };
}

function getSql() {
  const connection = getDatabaseConnection();
  const connectionString = connection.value;

  if (!connectionString) {
    const error = new Error(
      'Neon database is not configured. Set NETLIFY_DATABASE_URL_UNPOOLED, NETLIFY_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL.'
    );
    error.statusCode = 500;
    error.details = {
      diagnostics: {
        database: getDatabaseDiagnostics()
      }
    };
    throw error;
  }

  if (!sqlInstance || sqlConnectionString !== connectionString) {
    sqlInstance = neon(connectionString);
    sqlConnectionString = connectionString;
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
  getDatabaseDiagnostics,
  getSql
};
