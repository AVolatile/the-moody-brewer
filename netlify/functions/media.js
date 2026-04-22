'use strict';

const { ensureDatabase, getSql } = require('./_lib/db');
const { createHttpError, json, toErrorResponse } = require('./_lib/http');

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function parsePositiveId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw createHttpError(400, 'Image id is invalid.');
  }
  return id;
}

function normalizeImageType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (type !== 'menu-item' && type !== 'featured-item') {
    throw createHttpError(400, 'Image type is invalid.');
  }
  return type;
}

function normalizeMimeType(value) {
  const mimeType = String(value || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createHttpError(415, 'Stored image type is not supported.');
  }
  return mimeType;
}

function parseDataImageUrl(value) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(String(value || '').trim());
  if (!match) return null;

  return {
    image_data: match[2],
    image_mime: normalizeMimeType(match[1])
  };
}

function inferMimeTypeFromBase64(value) {
  const bytes = Buffer.from(String(value || '').slice(0, 64), 'base64');

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return 'image/webp';
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    bytes[11] === 0x66
  ) return 'image/avif';

  return null;
}

function parseRawBase64Image(value, mimeHint) {
  const imageData = String(value || '').trim().replace(/\s+/g, '');
  if (imageData.length < 128 || !/^[a-z0-9+/]+={0,2}$/i.test(imageData)) return null;

  const mimeType = mimeHint ? normalizeMimeType(mimeHint) : inferMimeTypeFromBase64(imageData);
  if (!mimeType) return null;

  return {
    image_data: imageData,
    image_mime: mimeType
  };
}

async function fetchStoredImage(type, id) {
  const sql = getSql();
  const rows = type === 'menu-item'
    ? await sql(
        `
          SELECT image_data, image_mime, image_url
          FROM menu_items
          WHERE id = $1
        `,
        [id]
      )
    : await sql(
        `
          SELECT image_data, image_mime, image_url
          FROM featured_items
          WHERE id = $1
        `,
        [id]
      );

  const image = rows[0] || null;
  if (!image) {
    throw createHttpError(404, 'Image not found.');
  }

  if (image.image_data && image.image_mime) {
    return image;
  }

  const dataUrlImage = parseDataImageUrl(image.image_url);
  if (dataUrlImage) return dataUrlImage;

  const rawBase64Image = parseRawBase64Image(image.image_url, image.image_mime);
  if (rawBase64Image) return rawBase64Image;

  throw createHttpError(404, 'Image not found.');
}

function getImageBody(image) {
  if (!image || !image.image_data) {
    throw createHttpError(404, 'Image not found.');
  }
  return image;
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const params = event.queryStringParameters || {};
    const type = normalizeImageType(params.type);
    const id = parsePositiveId(params.id);

    await ensureDatabase();

    const image = await fetchStoredImage(type, id);
    const imageBody = getImageBody(image);
    const mimeType = normalizeMimeType(imageBody.image_mime);
    const headers = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'Content-Type': mimeType,
      'X-Content-Type-Options': 'nosniff'
    };

    if (event.httpMethod === 'HEAD') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    return {
      statusCode: 200,
      headers,
      body: imageBody.image_data,
      isBase64Encoded: true
    };
  } catch (error) {
    return toErrorResponse(error);
  }
};
