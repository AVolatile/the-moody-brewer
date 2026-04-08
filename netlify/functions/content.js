'use strict';

const { getPublicContent } = require('./_lib/content-service');
const { json, toErrorResponse } = require('./_lib/http');

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const payload = await getPublicContent();
    return json(200, payload);
  } catch (error) {
    return toErrorResponse(error);
  }
};
