'use strict';

const {
  clearSessionCookie,
  createSessionCookie,
  getAuthConfig,
  getAuthDiagnostics,
  getSessionUser,
  verifyCredentials
} = require('./_lib/auth');
const { getDatabaseDiagnostics } = require('./_lib/db');
const { json, noContent, parseBody, toErrorResponse } = require('./_lib/http');

function buildDiagnostics() {
  return {
    auth: getAuthDiagnostics(),
    database: getDatabaseDiagnostics()
  };
}

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
        requiredUsername: authConfig.username,
        diagnostics: buildDiagnostics()
      });
    }

    if (event.httpMethod === 'POST') {
      if (!authConfig.ready) {
        return json(500, {
          error: 'Admin authentication is not configured. Add an admin password hash or password before signing in.',
          details: {
            diagnostics: buildDiagnostics()
          }
        });
      }

      const body = parseBody(event);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const fieldErrors = {};

      if (!username) {
        fieldErrors.username = 'Enter the admin username.';
      }
      if (!password.trim()) {
        fieldErrors.password = 'Enter the admin password.';
      }

      if (Object.keys(fieldErrors).length) {
        return json(400, {
          error: 'Enter the required login fields.',
          details: {
            fields: fieldErrors
          }
        });
      }

      const valid = await verifyCredentials(username, password);
      if (!valid) {
        const details = username !== authConfig.username
          ? {
              fields: {
                username: `Use the configured username: ${authConfig.username}.`
              }
            }
          : undefined;

        return json(401, {
          error: 'Invalid username or password.',
          ...(details ? { details } : {})
        });
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
