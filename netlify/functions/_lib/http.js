'use strict';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const DATABASE_FIELD_MAP = {
  badge_text: { field: 'badgeText', label: 'Offer label' },
  category_id: { field: 'categoryId', label: 'Category' },
  description: { field: 'description', label: 'Description' },
  discount_value: { field: 'discountValue', label: 'Amount off' },
  display_order: { field: 'displayOrder', label: 'Display order' },
  end_date: { field: 'endDate', label: 'End date' },
  headline: { field: 'headline', label: 'Headline' },
  image_data: { field: 'imageUpload', label: 'Image upload' },
  image_mime: { field: 'imageUpload', label: 'Image upload' },
  image_url: { field: 'imageUrl', label: 'Image link' },
  menu_item_id: { field: 'menuItemId', label: 'Linked menu item' },
  name: { field: 'name', label: 'Name' },
  price_large: { field: 'priceLarge', label: 'Large price' },
  price_medium: { field: 'priceMedium', label: 'Medium price' },
  price_single: { field: 'priceSingle', label: 'Price' },
  pricing_mode: { field: 'pricingMode', label: 'Pricing mode' },
  promotion_id: { field: 'promotionId', label: 'Offer' },
  sizes: { field: 'sizes', label: 'Size prices' },
  slug: { field: 'slug', label: 'Slug' },
  start_date: { field: 'startDate', label: 'Start date' },
  subtext: { field: 'subtext', label: 'Subtext' },
  title: { field: 'title', label: 'Title' }
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

function getDatabaseFieldMeta(error) {
  if (!error || !error.column) return null;
  return DATABASE_FIELD_MAP[error.column] || null;
}

function buildFieldDetails(field, message) {
  if (!field || !message) return null;
  return {
    fields: {
      [field]: [message]
    }
  };
}

function getDatabaseErrorResponse(error) {
  if (!error || !error.code) return null;

  const fieldMeta = getDatabaseFieldMeta(error);
  const isDataError = /^(22|23)/.test(String(error.code || ''));

  if (fieldMeta && error.code === '23502') {
    const message = `${fieldMeta.label} is required.`;
    return json(400, { error: message, details: buildFieldDetails(fieldMeta.field, message) });
  }

  if (fieldMeta && error.code === '22001') {
    const message = `${fieldMeta.label} is too long.`;
    return json(400, { error: message, details: buildFieldDetails(fieldMeta.field, message) });
  }

  if (fieldMeta && error.code === '23514') {
    const message = `${fieldMeta.label} has an invalid value.`;
    return json(400, { error: message, details: buildFieldDetails(fieldMeta.field, message) });
  }

  if (fieldMeta && error.code === '22P02') {
    const message = `${fieldMeta.label} has an invalid format.`;
    return json(400, { error: message, details: buildFieldDetails(fieldMeta.field, message) });
  }

  return json(isDataError ? 400 : 500, {
    error: getDatabaseErrorMessage(error) || error.message || 'Server error'
  });
}

function toErrorResponse(error) {
  if (error && error.statusCode) {
    return json(error.statusCode, {
      error: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  const databaseResponse = getDatabaseErrorResponse(error);
  if (databaseResponse) {
    console.error(error);
    return databaseResponse;
  }

  const message = error && error.message ? error.message : 'Server error';
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
