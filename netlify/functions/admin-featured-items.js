'use strict';

const { getSessionUser } = require('./_lib/auth');
const {
  createFeaturedItem,
  deleteFeaturedItem,
  reorderFeaturedItems,
  updateFeaturedItem
} = require('./_lib/content-service');
const { json, parseBody, toErrorResponse } = require('./_lib/http');

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  const sessionUser = getSessionUser(event);

  if (!sessionUser) {
    return json(401, { error: 'Unauthorized.' });
  }

  try {
    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
      await createFeaturedItem(body, sessionUser);
      return json(201, { ok: true });
    }
    if (event.httpMethod === 'PUT') {
      await updateFeaturedItem(body, sessionUser);
      return json(200, { ok: true });
    }
    if (event.httpMethod === 'DELETE') {
      await deleteFeaturedItem(body, sessionUser);
      return json(200, { ok: true });
    }
    if (event.httpMethod === 'PATCH') {
      await reorderFeaturedItems(body, sessionUser);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (error) {
    return toErrorResponse(error);
  }
};
