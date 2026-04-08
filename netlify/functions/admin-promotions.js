'use strict';

const { getSessionUser } = require('./_lib/auth');
const {
  createPromotion,
  deletePromotion,
  reorderPromotions,
  updatePromotion
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
      await createPromotion(body);
      return json(201, { ok: true });
    }
    if (event.httpMethod === 'PUT') {
      await updatePromotion(body);
      return json(200, { ok: true });
    }
    if (event.httpMethod === 'DELETE') {
      await deletePromotion(body);
      return json(200, { ok: true });
    }
    if (event.httpMethod === 'PATCH') {
      await reorderPromotions(body);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (error) {
    return toErrorResponse(error);
  }
};
