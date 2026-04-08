'use strict';

const {
  clearSessionCookie,
  createSessionCookie,
  getAuthConfig,
  getSessionUser,
  verifyCredentials
} = require('./_lib/auth');
const { json, noContent, parseBody, toErrorResponse } = require('./_lib/http');

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  try {
    const authConfig = getAuthConfig();

    if (event.httpMethod === 'GET') {
      const sessionUser = getSessionUser(event);
      return json(200, {
        configured: authConfig.ready,
        authenticated: Boolean(sessionUser),
        username: sessionUser ? sessionUser.username : null,
        requiredUsername: authConfig.username
      });
    }

    if (event.httpMethod === 'POST') {
      if (!authConfig.ready) {
        return json(500, {
          error: 'Admin authentication is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD or ADMIN_PASSWORD_HASH.'
        });
      }

      const body = parseBody(event);
      const valid = await verifyCredentials(body.username, body.password);
      if (!valid) {
        return json(401, { error: 'Invalid username or password.' });
      }

      return json(
        200,
        { ok: true, username: authConfig.username },
        { 'Set-Cookie': createSessionCookie(event, authConfig.username) }
      );
    }

    if (event.httpMethod === 'DELETE') {
      return noContent({ 'Set-Cookie': clearSessionCookie(event) });
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (error) {
    return toErrorResponse(error);
  }
};
