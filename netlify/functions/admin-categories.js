'use strict';

const { getSessionUser } = require('./_lib/auth');
const {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory
} = require('./_lib/content-service');
const { json, parseBody, toErrorResponse } = require('./_lib/http');

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (!getSessionUser(event)) {
    return json(401, { error: 'Unauthorized.' });
  }

  try {
    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
      await createCategory(body);
      return json(201, { ok: true });
    }
    if (event.httpMethod === 'PUT') {
      await updateCategory(body);
      return json(200, { ok: true });
    }
    if (event.httpMethod === 'DELETE') {
      await deleteCategory(body);
      return json(200, { ok: true });
    }
    if (event.httpMethod === 'PATCH') {
      await reorderCategories(body);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (error) {
    return toErrorResponse(error);
  }
};
