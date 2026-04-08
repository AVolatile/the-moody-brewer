'use strict';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function json(statusCode, body, headers) {
  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...(headers || {}) },
    body: JSON.stringify(body)
  };
}

function noContent(headers) {
  return {
    statusCode: 204,
    headers: { ...DEFAULT_HEADERS, ...(headers || {}) },
    body: ''
  };
}

function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  error.details = details;
  return error;
}

function getDatabaseErrorMessage(error) {
  if (!error || !error.code) return null;
  if (error.code === '23505') return 'That record already exists.';
  if (error.code === '23503') return 'That change would leave related records in an invalid state.';
  if (error.code === '23514') return 'That value failed database validation.';
  if (error.code === '22P02') return 'One of the submitted values has an invalid format.';
  return null;
}

function toErrorResponse(error) {
  if (error && error.statusCode) {
    return json(error.statusCode, {
      error: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  const message = getDatabaseErrorMessage(error) || 'Server error';
  console.error(error);
  return json(500, { error: message });
}

function parseBody(event) {
  if (!event || !event.body) return {};

  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

module.exports = {
  createHttpError,
  json,
  noContent,
  parseBody,
  toErrorResponse
};
