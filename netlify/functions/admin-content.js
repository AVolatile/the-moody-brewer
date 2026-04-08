'use strict';

const { getSessionUser } = require('./_lib/auth');
const { getAdminSnapshot } = require('./_lib/content-service');
const { json, toErrorResponse } = require('./_lib/http');

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!getSessionUser(event)) {
    return json(401, { error: 'Unauthorized.' });
  }

  try {
    const payload = await getAdminSnapshot();
    return json(200, payload);
  } catch (error) {
    return toErrorResponse(error);
  }
};
