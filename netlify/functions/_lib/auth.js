'use strict';

const crypto = require('crypto');

const SESSION_COOKIE = 'mb_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLength), 'base64').toString('utf8');
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index === -1) return cookies;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      cookies[key] = value;
      return cookies;
    }, {});
}

function getAuthConfig() {
  const username = String(process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
  const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY || '').trim();
  const sessionSecret = String(
    process.env.ADMIN_SESSION_SECRET || passwordHash || password
  ).trim();

  return {
    username,
    passwordHash,
    password,
    sessionSecret,
    ready: Boolean(sessionSecret && (passwordHash || password))
  };
}

function buildSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getRequestProtocol(event) {
  const header = event && event.headers
    ? event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto']
    : null;

  if (header) return String(header).split(',')[0].trim().toLowerCase();
  return process.env.CONTEXT === 'dev' ? 'http' : 'https';
}

function createSessionCookie(event, username) {
  const config = getAuthConfig();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = base64UrlEncode(JSON.stringify({ sub: username, exp: expiresAt }));
  const signature = buildSignature(payload, config.sessionSecret);
  const secure = getRequestProtocol(event) === 'https' ? '; Secure' : '';

  return [
    `${SESSION_COOKIE}=${payload}.${signature}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? secure.slice(2) : ''
  ].filter(Boolean).join('; ');
}

function clearSessionCookie(event) {
  const secure = getRequestProtocol(event) === 'https' ? '; Secure' : '';
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    secure ? secure.slice(2) : ''
  ].filter(Boolean).join('; ');
}

function verifyPasswordHash(password, storedHash) {
  if (!storedHash) return false;

  if (storedHash.startsWith('mb1$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  return false;
}

function verifyPlainPassword(password, expected) {
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifySessionToken(event) {
  const config = getAuthConfig();
  if (!config.ready) return null;

  const cookies = parseCookies(event && event.headers ? event.headers.cookie || event.headers.Cookie : '');
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;

  const parts = raw.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = buildSignature(payload, config.sessionSecret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(base64UrlDecode(payload));
    if (!data || !data.sub || !data.exp || Number(data.exp) < Date.now()) return null;
    return { username: data.sub };
  } catch (error) {
    return null;
  }
}

function verifyLegacyHeader(event) {
  const adminKey = String(process.env.ADMIN_KEY || '').trim();
  if (!adminKey || !event || !event.headers) return null;
  const header = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
  if (!header) return null;
  return verifyPlainPassword(String(header), adminKey)
    ? { username: getAuthConfig().username, mode: 'header' }
    : null;
}

async function verifyCredentials(username, password) {
  const config = getAuthConfig();
  if (!config.ready) return false;
  if (String(username || '').trim() !== config.username) return false;

  const inputPassword = String(password || '');
  if (config.passwordHash) {
    return verifyPasswordHash(inputPassword, config.passwordHash);
  }

  return verifyPlainPassword(inputPassword, config.password);
}

function getSessionUser(event) {
  return verifySessionToken(event) || verifyLegacyHeader(event);
}

module.exports = {
  clearSessionCookie,
  createSessionCookie,
  getAuthConfig,
  getSessionUser,
  verifyCredentials
};
