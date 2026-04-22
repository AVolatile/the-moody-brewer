'use strict';

const { createHttpError } = require('./http');
const { ensureDatabase, getSql } = require('./db');

const IMAGE_LIMIT_BASE64 = Math.floor(2.8 * 1024 * 1024);
const CATEGORY_LAYOUTS = new Set(['card', 'table', 'list']);
const DISCOUNT_TYPES = new Set(['text', 'percentage', 'fixed']);
const AUDIT_FETCH_LIMIT = 120;
const AUDIT_FIELD_LABELS = {
  category: {
    name: 'Section name',
    slug: 'Slug',
    description: 'Description',
    layout: 'Layout',
    pricing: 'Pricing style',
    priceLabels: 'Price labels',
    imageRequirement: 'Image requirement',
    displayOrder: 'Sort order'
  },
  item: {
    name: 'Item name',
    category: 'Menu section',
    description: 'Description',
    price: 'Price',
    mediumPrice: 'Medium price',
    largePrice: 'Large price',
    image: 'Image',
    offer: 'Offer',
    availability: 'Availability',
    featured: 'Homepage feature',
    displayOrder: 'Sort order'
  },
  featured: {
    headline: 'Headline',
    linkedItem: 'Linked menu item',
    subtext: 'Subtext',
    image: 'Image',
    offer: 'Offer',
    visibility: 'Visibility',
    displayOrder: 'Sort order'
  },
  promotion: {
    title: 'Offer title',
    badge: 'Offer label',
    description: 'Description',
    discountType: 'Offer type',
    discountValue: 'Amount off',
    schedule: 'Schedule',
    visibility: 'Visibility',
    displayOrder: 'Sort order'
  }
};
const AUDIT_FIELD_ORDER = {
  category: ['name', 'slug', 'description', 'layout', 'pricing', 'priceLabels', 'imageRequirement', 'displayOrder'],
  item: ['name', 'category', 'description', 'price', 'mediumPrice', 'largePrice', 'image', 'offer', 'availability', 'featured', 'displayOrder'],
  featured: ['headline', 'linkedItem', 'subtext', 'image', 'offer', 'visibility', 'displayOrder'],
  promotion: ['title', 'badge', 'description', 'discountType', 'discountValue', 'schedule', 'visibility', 'displayOrder']
};

function roundCurrency(value) {
  if (value == null) return null;
  return Math.round(Number(value) * 100) / 100;
}

function formatMoney(value) {
  return value == null ? null : `$${Number(value).toFixed(2)}`;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  return {};
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizeString(value, fieldName, options) {
  const settings = { required: false, maxLength: 255, allowEmpty: false, ...(options || {}) };
  if (value == null) {
    if (settings.required) throw createHttpError(400, `${fieldName} is required.`);
    return null;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    if (settings.required && !settings.allowEmpty) throw createHttpError(400, `${fieldName} is required.`);
    return settings.allowEmpty ? '' : null;
  }

  if (stringValue.length > settings.maxLength) {
    throw createHttpError(400, `${fieldName} is too long.`);
  }

  return stringValue;
}

function normalizeInteger(value, fieldName, options) {
  const settings = { required: false, min: 0, max: Number.MAX_SAFE_INTEGER, ...(options || {}) };
  if (value === undefined || value === null || value === '') {
    if (settings.required) throw createHttpError(400, `${fieldName} is required.`);
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw createHttpError(400, `${fieldName} must be a whole number.`);
  }
  if (numberValue < settings.min || numberValue > settings.max) {
    throw createHttpError(400, `${fieldName} is out of range.`);
  }

  return numberValue;
}

function normalizePrice(value, fieldName, options) {
  const settings = { required: false, ...(options || {}) };
  if (value === undefined || value === null || value === '') {
    if (settings.required) throw createHttpError(400, `${fieldName} is required.`);
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createHttpError(400, `${fieldName} must be a valid positive amount.`);
  }

  return roundCurrency(numericValue);
}

function normalizeBoolean(value, fallback) {
  if (value === undefined) return Boolean(fallback);
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
}

function hasSubmittedValue(value) {
  return !(value === undefined || value === null || (typeof value === 'string' && value.trim() === ''));
}

function normalizePriceLabels(value) {
  if (!value) return [];
  const labels = Array.isArray(value) ? value : String(value).split(',');
  return labels
    .map(label => String(label || '').trim())
    .filter(Boolean)
    .slice(0, 2);
}

function normalizeLayout(value) {
  const layout = String(value || 'card').trim().toLowerCase();
  const normalized = layout === 'cards' ? 'card' : layout;
  if (!CATEGORY_LAYOUTS.has(normalized)) {
    throw createHttpError(400, 'Layout must be card, table, or list.');
  }
  return normalized;
}

function normalizeDiscountType(value) {
  const discountType = String(value || 'text').trim().toLowerCase();
  if (!DISCOUNT_TYPES.has(discountType)) {
    throw createHttpError(400, 'Discount type must be text, percentage, or fixed.');
  }
  return discountType;
}

function normalizeDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const dateValue = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw createHttpError(400, `${fieldName} must use YYYY-MM-DD format.`);
  }
  return dateValue;
}

function ensureDateRange(startDate, endDate) {
  if (startDate && endDate && startDate > endDate) {
    throw createHttpError(400, 'Promotion start date must be before the end date.');
  }
}

function parseUploadImage(value) {
  if (!value) return null;
  const match = /^data:(.+?);base64,(.+)$/.exec(String(value).trim());
  if (!match) {
    throw createHttpError(400, 'Uploaded image data is invalid.');
  }
  if (match[2].length > IMAGE_LIMIT_BASE64) {
    throw createHttpError(413, 'Uploaded image exceeds the 2MB limit.');
  }
  return {
    image_url: null,
    image_data: match[2],
    image_mime: match[1]
  };
}

function normalizePlaceholderImage(value) {
  const rawValue = String(value || '').trim().toLowerCase();
  const placeholderKey = rawValue.startsWith('placeholder:')
    ? rawValue.slice('placeholder:'.length)
    : rawValue;

  if (placeholderKey !== 'drink' && placeholderKey !== 'food') {
    throw createHttpError(400, 'Placeholder image is invalid.');
  }

  return `placeholder:${placeholderKey}`;
}

function normalizeImageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  const imageUrl = String(value).trim();
  if (!imageUrl) return null;
  if (/^placeholder:/i.test(imageUrl)) {
    return normalizePlaceholderImage(imageUrl);
  }
  if (/^javascript:/i.test(imageUrl)) {
    throw createHttpError(400, 'Image URL is invalid.');
  }
  return imageUrl;
}

function resolveImageFields(payload, existingFields) {
  const imageMode = String(
    payload.imageMode ||
    (payload.imageUpload ? 'upload' : payload.imageUrl !== undefined ? 'url' : payload.removeImage ? 'remove' : 'keep')
  ).trim().toLowerCase();

  const existing = existingFields || { image_url: null, image_data: null, image_mime: null };

  if (imageMode === 'keep') {
    return { ...existing };
  }
  if (imageMode === 'remove') {
    return { image_url: null, image_data: null, image_mime: null };
  }
  if (imageMode === 'upload') {
    return parseUploadImage(payload.imageUpload);
  }
  if (imageMode === 'url') {
    return {
      image_url: normalizeImageUrl(payload.imageUrl),
      image_data: null,
      image_mime: null
    };
  }
  if (imageMode === 'placeholder') {
    return {
      image_url: normalizePlaceholderImage(payload.imagePlaceholder),
      image_data: null,
      image_mime: null
    };
  }

  throw createHttpError(400, 'Image mode is invalid.');
}

function buildPromotionLabel(promotion) {
  if (!promotion) return null;
  if (promotion.badgeText) return promotion.badgeText;
  if (promotion.discountType === 'percentage' && promotion.discountValue != null) {
    return `${promotion.discountValue}% off`;
  }
  if (promotion.discountType === 'fixed' && promotion.discountValue != null) {
    return `${formatMoney(promotion.discountValue)} off`;
  }
  return promotion.title;
}

function applyPromotion(value, promotion) {
  if (value == null || !promotion || !promotion.isCurrent) return value;
  if (promotion.discountType === 'percentage' && promotion.discountValue != null) {
    return roundCurrency(Math.max(0, value - (value * Number(promotion.discountValue)) / 100));
  }
  if (promotion.discountType === 'fixed' && promotion.discountValue != null) {
    return roundCurrency(Math.max(0, value - Number(promotion.discountValue)));
  }
  return value;
}

function serializePromotion(row) {
  if (!row || !row.id) return null;
  const promotion = {
    id: row.id,
    title: row.title,
    description: row.description || '',
    badgeText: row.badge_text || '',
    discountType: row.discount_type,
    discountValue: row.discount_value != null ? Number(row.discount_value) : null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    isActive: Boolean(row.is_active),
    isCurrent: Boolean(row.is_current),
    displayOrder: row.display_order || 0
  };
  promotion.label = buildPromotionLabel(promotion);
  return promotion;
}

function buildMediaUrl(type, id, version) {
  if (!type || !id) return null;
  const params = new URLSearchParams({
    type,
    id: String(id)
  });

  if (version) {
    params.set('v', String(version));
  }

  return `/api/media?${params.toString()}`;
}

function isDataImageUrl(value) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || '').trim());
}

function hasEmbeddedImage(fields) {
  return Boolean(fields && (((fields.image_data || fields.has_image_data) && fields.image_mime) || fields.has_image_data || isDataImageUrl(fields.image_url)));
}

function hasImageFields(fields) {
  return Boolean(fields && (fields.image_url || hasEmbeddedImage(fields)));
}

function imageFromFields(fields, options) {
  if (!fields) return null;
  if (hasEmbeddedImage(fields)) {
    return buildMediaUrl(options && options.type, options && options.id, options && options.version) || fields.image_url || null;
  }
  return fields.image_url || null;
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    layout: row.layout,
    priceLabels: parseJsonArray(row.price_labels),
    requireImage: Boolean(row.require_image),
    allowMultiPrice: Boolean(row.allow_multi_price),
    displayOrder: row.display_order || 0
  };
}

function buildPriceSummary(item, category, promotion) {
  if (item.priceType === 'tbd') return 'TBD';
  if (item.priceType === 'in_store') return 'See in store';

  const labels = (category && category.priceLabels) || [];
  const firstLabel = labels[0] || 'M';
  const secondLabel = labels[1] || 'L';

  if (category && category.allowMultiPrice) {
    const parts = [];
    const mediumValue = item.effectivePriceMedium != null ? item.effectivePriceMedium : item.priceMedium;
    const largeValue = item.effectivePriceLarge != null ? item.effectivePriceLarge : item.priceLarge;
    if (mediumValue != null) parts.push(`${firstLabel} ${formatMoney(mediumValue)}`);
    if (largeValue != null) parts.push(`${secondLabel} ${formatMoney(largeValue)}`);
    return parts.length ? parts.join(' / ') : '';
  }

  const singleValue = item.effectivePriceSingle != null ? item.effectivePriceSingle : item.priceSingle;
  return singleValue != null ? formatMoney(singleValue) : '';
}

function mapMenuItemRow(row, categoriesById) {
  const category = categoriesById.get(row.category_id) || null;
  const promotion = row.promotion_id
    ? serializePromotion({
        id: row.promotion_id,
        title: row.promotion_title,
        description: row.promotion_description,
        badge_text: row.promotion_badge_text,
        discount_type: row.promotion_discount_type,
        discount_value: row.promotion_discount_value,
        start_date: row.promotion_start_date,
        end_date: row.promotion_end_date,
        is_active: row.promotion_is_active,
        is_current: row.promotion_is_current,
        display_order: row.promotion_display_order
      })
    : null;

  const priceSingle = row.price_single != null
    ? Number(row.price_single)
    : row.price_medium != null
      ? Number(row.price_medium)
      : row.price_large != null
        ? Number(row.price_large)
        : null;
  const priceMedium = row.price_medium != null
    ? Number(row.price_medium)
    : row.price_single != null && category && category.allowMultiPrice
      ? Number(row.price_single)
      : null;
  const priceLarge = row.price_large != null ? Number(row.price_large) : null;

  const item = {
    id: row.id,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    name: row.name,
    description: row.description || '',
    priceType: row.price_type || 'numeric',
    priceSingle,
    priceMedium,
    priceLarge,
    effectivePriceSingle: applyPromotion(priceSingle, promotion),
    effectivePriceMedium: applyPromotion(priceMedium, promotion),
    effectivePriceLarge: applyPromotion(priceLarge, promotion),
    imageUrl: imageFromFields(row, { type: 'menu-item', id: row.id, version: row.updated_at }),
    isFeatured: Boolean(row.is_featured),
    isAvailable: Boolean(row.is_available),
    displayOrder: row.display_order || 0,
    promotionId: row.promotion_id || null,
    promotion
  };

  item.priceSummary = buildPriceSummary(item, category, promotion);
  return item;
}

function mapFeaturedItemRow(row) {
  const promotion = row.promotion_id
    ? serializePromotion({
        id: row.promotion_id,
        title: row.promotion_title,
        description: row.promotion_description,
        badge_text: row.promotion_badge_text,
        discount_type: row.promotion_discount_type,
        discount_value: row.promotion_discount_value,
        start_date: row.promotion_start_date,
        end_date: row.promotion_end_date,
        is_active: row.promotion_is_active,
        is_current: row.promotion_is_current,
        display_order: row.promotion_display_order
      })
    : null;

  const linkedPromotion = row.linked_promotion_id
    ? serializePromotion({
        id: row.linked_promotion_id,
        title: row.linked_promotion_title,
        description: row.linked_promotion_description,
        badge_text: row.linked_promotion_badge_text,
        discount_type: row.linked_promotion_discount_type,
        discount_value: row.linked_promotion_discount_value,
        start_date: row.linked_promotion_start_date,
        end_date: row.linked_promotion_end_date,
        is_active: row.linked_promotion_is_active,
        is_current: row.linked_promotion_is_current,
        display_order: row.linked_promotion_display_order
      })
    : null;

  const linkedCategory = {
    allowMultiPrice: Boolean(row.menu_item_allow_multi_price),
    priceLabels: parseJsonArray(row.menu_item_price_labels)
  };

  const linkedItem = row.menu_item_id
    ? {
        id: row.menu_item_id,
        name: row.menu_item_name,
        description: row.menu_item_description || '',
        priceType: row.menu_item_price_type || 'numeric',
        priceSingle: row.menu_item_price_single != null ? Number(row.menu_item_price_single) : null,
        priceMedium: row.menu_item_price_medium != null ? Number(row.menu_item_price_medium) : null,
        priceLarge: row.menu_item_price_large != null ? Number(row.menu_item_price_large) : null,
        imageUrl: imageFromFields({
          image_url: row.menu_item_image_url,
          has_image_data: row.menu_item_has_image_data,
          image_mime: row.menu_item_image_mime
        }, { type: 'menu-item', id: row.menu_item_id, version: row.menu_item_updated_at }),
        isAvailable: Boolean(row.menu_item_is_available),
        categoryName: row.menu_item_category_name,
        categorySlug: row.menu_item_category_slug,
        priceSummary: buildPriceSummary(
          {
            priceType: row.menu_item_price_type || 'numeric',
            priceSingle: row.menu_item_price_single != null ? Number(row.menu_item_price_single) : null,
            priceMedium: row.menu_item_price_medium != null ? Number(row.menu_item_price_medium) : null,
            priceLarge: row.menu_item_price_large != null ? Number(row.menu_item_price_large) : null,
            effectivePriceSingle: applyPromotion(
              row.menu_item_price_single != null ? Number(row.menu_item_price_single) : null,
              linkedPromotion
            ),
            effectivePriceMedium: applyPromotion(
              row.menu_item_price_medium != null ? Number(row.menu_item_price_medium) : null,
              linkedPromotion
            ),
            effectivePriceLarge: applyPromotion(
              row.menu_item_price_large != null ? Number(row.menu_item_price_large) : null,
              linkedPromotion
            )
          },
          linkedCategory,
          linkedPromotion
        )
      }
    : null;

  return {
    id: row.id,
    menuItemId: row.menu_item_id || null,
    headline: row.headline,
    subtext: row.subtext || '',
    imageUrl: imageFromFields(row, { type: 'featured-item', id: row.id, version: row.updated_at }) || (linkedItem ? linkedItem.imageUrl : null),
    displayOrder: row.display_order || 0,
    isActive: Boolean(row.is_active),
    promotionId: row.promotion_id || null,
    promotion: promotion || linkedPromotion,
    linkedItem
  };
}

function formatCategoryLayoutLabel(layout) {
  if (layout === 'table') return 'Compact list';
  if (layout === 'list') return 'Simple list';
  return 'Feature cards';
}

function formatPriceLabelsForAudit(value) {
  const labels = parseJsonArray(value).filter(Boolean);
  return labels.length ? labels.join(' / ') : 'Default labels';
}

function describeImageForAudit(imageUrl, imageData) {
  if (imageData) return 'Uploaded image';
  if (!imageUrl) return 'No image';
  if (String(imageUrl).startsWith('placeholder:drink')) return 'Coffee cup placeholder';
  if (String(imageUrl).startsWith('placeholder:food')) return 'Food item placeholder';
  return 'Image link';
}

function describePromotionValueForAudit(promotion) {
  return promotion && promotion.title ? promotion.title : 'No offer';
}

function describeScheduleForAudit(startDate, endDate) {
  return [startDate || 'Now', endDate || 'Ongoing'].join(' → ');
}

function describeDiscountTypeForAudit(value) {
  if (value === 'percentage') return 'Percentage';
  if (value === 'fixed') return 'Fixed amount';
  return 'Text only';
}

function describeDiscountValueForAudit(row) {
  if (!row || row.discount_value == null) return '—';
  if (row.discount_type === 'percentage') return `${Number(row.discount_value)}%`;
  return formatMoney(row.discount_value);
}

function normalizeAuditActor(actor) {
  if (!actor) return 'Unknown user';
  if (typeof actor === 'string') return actor.trim() || 'Unknown user';
  return String(actor.username || actor.sub || '').trim() || 'Unknown user';
}

function buildCategoryAuditState(row) {
  const label = row.name || row.title || row.slug || 'Untitled section';
  return {
    label,
    name: label,
    slug: row.slug || '—',
    description: row.description || '—',
    layout: formatCategoryLayoutLabel(row.layout),
    pricing: row.allow_multi_price ? 'Multiple sizes' : 'Single price',
    priceLabels: formatPriceLabelsForAudit(row.price_labels),
    imageRequirement: row.require_image ? 'Required' : 'Optional',
    displayOrder: String(row.display_order || 0)
  };
}

async function buildMenuItemAuditState(row) {
  const promotion = row && row.promotion_id ? await getPromotionById(row.promotion_id) : null;
  const label = row.name || 'Untitled item';
  return {
    label,
    name: label,
    category: row.category_name || row.category_slug || 'No section',
    description: row.description || '—',
    price: row.price_single != null ? formatMoney(row.price_single) : '—',
    mediumPrice: row.price_medium != null ? formatMoney(row.price_medium) : '—',
    largePrice: row.price_large != null ? formatMoney(row.price_large) : '—',
    image: describeImageForAudit(row.image_url, row.image_data),
    offer: describePromotionValueForAudit(promotion),
    availability: row.is_available ? 'Available' : 'Hidden',
    featured: row.is_featured ? 'Yes' : 'No',
    displayOrder: String(row.display_order || 0)
  };
}

async function buildFeaturedAuditState(row) {
  const linkedItem = row && row.menu_item_id ? await getMenuItemById(row.menu_item_id) : null;
  const promotion = row && row.promotion_id ? await getPromotionById(row.promotion_id) : null;
  const label = row.headline || (linkedItem && linkedItem.name) || 'Menu spotlight';

  return {
    label,
    headline: label,
    linkedItem: linkedItem ? linkedItem.name : 'No linked menu item',
    subtext: row.subtext || '—',
    image: describeImageForAudit(row.image_url || (linkedItem && linkedItem.image_url), row.image_data || (linkedItem && linkedItem.image_data)),
    offer: describePromotionValueForAudit(promotion),
    visibility: row.is_active ? 'Visible' : 'Hidden',
    displayOrder: String(row.display_order || 0)
  };
}

function buildPromotionAuditState(row) {
  const label = row.title || 'Untitled offer';
  return {
    label,
    title: label,
    badge: row.badge_text || '—',
    description: row.description || '—',
    discountType: describeDiscountTypeForAudit(row.discount_type),
    discountValue: describeDiscountValueForAudit(row),
    schedule: describeScheduleForAudit(row.start_date, row.end_date),
    visibility: row.is_active ? 'Visible' : 'Hidden',
    displayOrder: String(row.display_order || 0)
  };
}

function buildAuditChanges(entityType, beforeState, afterState) {
  const labels = AUDIT_FIELD_LABELS[entityType] || {};
  const order = AUDIT_FIELD_ORDER[entityType] || Object.keys(labels);

  return order.reduce((changes, field) => {
    const beforeValue = beforeState && beforeState[field] != null ? String(beforeState[field]) : '';
    const afterValue = afterState && afterState[field] != null ? String(afterState[field]) : '';

    if (!beforeState && (!afterValue || afterValue === '—')) return changes;
    if (!afterState && (!beforeValue || beforeValue === '—')) return changes;
    if (beforeState && afterState && beforeValue === afterValue) return changes;

    changes.push({
      field,
      label: labels[field] || field,
      before: beforeValue || '—',
      after: afterValue || '—'
    });

    return changes;
  }, []);
}

async function logAuditEvent(entry) {
  const sql = getSql();
  const actorUsername = normalizeAuditActor(entry.actor);
  const changes = Array.isArray(entry.changes) ? entry.changes : [];

  await sql(
    `
      INSERT INTO audit_logs (
        actor_username, entity_type, entity_id, entity_label, action, summary, changes, before_data, after_data, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
    `,
    [
      actorUsername,
      entry.entityType,
      entry.entityId || null,
      entry.entityLabel || null,
      entry.action,
      entry.summary,
      JSON.stringify(changes),
      entry.beforeData ? JSON.stringify(entry.beforeData) : null,
      entry.afterData ? JSON.stringify(entry.afterData) : null,
      JSON.stringify(entry.metadata || {})
    ]
  );
}

function mapAuditLogRow(row) {
  return {
    id: row.id,
    actorUsername: row.actor_username,
    entityType: row.entity_type,
    entityId: row.entity_id || null,
    entityLabel: row.entity_label || '',
    action: row.action,
    summary: row.summary,
    changes: parseJsonArray(row.changes),
    beforeData: parseJsonObject(row.before_data),
    afterData: parseJsonObject(row.after_data),
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at
  };
}

function sortAuditRecordsForOrder(records) {
  return (Array.isArray(records) ? records : []).slice().sort((a, b) => {
    const firstOrder = Number(a && (a.display_order != null ? a.display_order : a.displayOrder) || 0);
    const secondOrder = Number(b && (b.display_order != null ? b.display_order : b.displayOrder) || 0);
    const firstId = Number(a && a.id || 0);
    const secondId = Number(b && b.id || 0);
    return firstOrder - secondOrder || firstId - secondId;
  });
}

async function fetchAuditLogs(limit) {
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(Number(limit) || AUDIT_FETCH_LIMIT, AUDIT_FETCH_LIMIT));
  const rows = await sql(
    `
      SELECT
        id,
        actor_username,
        entity_type,
        entity_id,
        entity_label,
        action,
        summary,
        changes,
        before_data,
        after_data,
        metadata,
        created_at::text AS created_at
      FROM audit_logs
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return rows.map(mapAuditLogRow);
}

async function queryOneOrNull(sql, query, params) {
  const rows = await sql(query, params || []);
  return rows[0] || null;
}

async function getCategoryById(categoryId) {
  const sql = getSql();
  return queryOneOrNull(
    sql,
    `
      SELECT id, slug, name, description, layout, price_labels, require_image, allow_multi_price, display_order
      FROM menu_categories
      WHERE id = $1
    `,
    [categoryId]
  );
}

async function getMenuItemById(itemId) {
  const sql = getSql();
  return queryOneOrNull(
    sql,
    `
      SELECT i.*, c.slug AS category_slug, c.name AS category_name, c.layout, c.price_labels, c.allow_multi_price, c.require_image
      FROM menu_items i
      JOIN menu_categories c ON c.id = i.category_id
      WHERE i.id = $1
    `,
    [itemId]
  );
}

async function getPromotionById(promotionId) {
  const sql = getSql();
  return queryOneOrNull(sql, `SELECT * FROM promotions WHERE id = $1`, [promotionId]);
}

async function getFeaturedItemById(featuredItemId) {
  const sql = getSql();
  return queryOneOrNull(sql, `SELECT * FROM featured_items WHERE id = $1`, [featuredItemId]);
}

async function assertPromotionExists(promotionId) {
  if (promotionId == null) return null;
  const promotion = await getPromotionById(promotionId);
  if (!promotion) throw createHttpError(404, 'Promotion not found.');
  return promotion.id;
}

async function assertMenuItemExists(menuItemId) {
  if (menuItemId == null) return null;
  const item = await getMenuItemById(menuItemId);
  if (!item) throw createHttpError(404, 'Menu item not found.');
  return item;
}

async function nextDisplayOrder(tableName, whereClause, params) {
  const sql = getSql();
  const rows = await sql(
    `SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM ${tableName} ${whereClause || ''}`,
    params || []
  );
  return rows[0] ? Number(rows[0].next) : 1;
}

async function updateRecord(tableName, id, fields) {
  const sql = getSql();
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);

  if (!entries.length) {
    throw createHttpError(400, 'No changes were submitted.');
  }

  const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
  const params = entries.map(([, value]) => value).concat(id);
  const rows = await sql(
    `UPDATE ${tableName} SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${entries.length + 1} RETURNING *`,
    params
  );

  return rows[0] || null;
}

async function updateDisplayOrderForIds(tableName, orderedIds) {
  const ids = Array.from(
    new Set(
      (Array.isArray(orderedIds) ? orderedIds : [])
        .map(id => normalizeInteger(id, 'Display order item'))
        .filter(id => id != null)
    )
  );

  if (!ids.length) {
    throw createHttpError(400, 'No records were supplied for reordering.');
  }

  const sql = getSql();

  for (let index = 0; index < ids.length; index += 1) {
    await sql(
      `UPDATE ${tableName} SET display_order = $1, updated_at = NOW() WHERE id = $2`,
      [index + 1, ids[index]]
    );
  }
}

async function fetchCategories() {
  const sql = getSql();
  const rows = await sql(`
    SELECT id, slug, name, description, layout, price_labels, require_image, allow_multi_price, display_order
    FROM menu_categories
    ORDER BY display_order, id
  `);
  return rows.map(mapCategoryRow);
}

async function fetchPromotions(options) {
  const settings = { onlyCurrent: false, ...(options || {}) };
  const sql = getSql();
  const where = settings.onlyCurrent
    ? `WHERE is_active = TRUE AND (start_date IS NULL OR start_date <= CURRENT_DATE) AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
    : '';

  const rows = await sql(`
    SELECT
      id,
      title,
      description,
      badge_text,
      discount_type,
      discount_value::float AS discount_value,
      start_date::text AS start_date,
      end_date::text AS end_date,
      is_active,
      display_order,
      CASE
        WHEN is_active = TRUE
          AND (start_date IS NULL OR start_date <= CURRENT_DATE)
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        THEN TRUE
        ELSE FALSE
      END AS is_current
    FROM promotions
    ${where}
    ORDER BY display_order, id
  `);

  return rows.map(serializePromotion);
}

async function fetchMenuItems(categories) {
  const sql = getSql();
  const categoriesById = new Map(categories.map(category => [category.id, category]));
  const rows = await sql(`
    SELECT
      i.id,
      i.category_id,
      c.slug AS category_slug,
      i.name,
      i.description,
      i.price_type,
      i.price_single::float AS price_single,
      i.price_medium::float AS price_medium,
      i.price_large::float AS price_large,
      CASE
        WHEN LOWER(COALESCE(i.image_url, '')) LIKE 'data:image/%;base64,%' THEN NULL
        WHEN LENGTH(TRIM(COALESCE(i.image_url, ''))) > 2048 THEN NULL
        ELSE i.image_url
      END AS image_url,
      (
        (i.image_data IS NOT NULL AND i.image_mime IS NOT NULL)
        OR LOWER(COALESCE(i.image_url, '')) LIKE 'data:image/%;base64,%'
        OR LENGTH(TRIM(COALESCE(i.image_url, ''))) > 2048
      ) AS has_image_data,
      i.image_mime,
      i.is_featured,
      i.is_available,
      i.display_order,
      i.updated_at::text AS updated_at,
      i.promotion_id,
      p.title AS promotion_title,
      p.description AS promotion_description,
      p.badge_text AS promotion_badge_text,
      p.discount_type AS promotion_discount_type,
      p.discount_value::float AS promotion_discount_value,
      p.start_date::text AS promotion_start_date,
      p.end_date::text AS promotion_end_date,
      p.is_active AS promotion_is_active,
      p.display_order AS promotion_display_order,
      CASE
        WHEN p.id IS NOT NULL
          AND p.is_active = TRUE
          AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
          AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
        THEN TRUE
        ELSE FALSE
      END AS promotion_is_current
    FROM menu_items i
    JOIN menu_categories c ON c.id = i.category_id
    LEFT JOIN promotions p ON p.id = i.promotion_id
    ORDER BY c.display_order, i.display_order, i.id
  `);

  return rows.map(row => mapMenuItemRow(row, categoriesById));
}

async function fetchFeaturedItems() {
  const sql = getSql();
  const rows = await sql(`
    SELECT
      f.id,
      f.menu_item_id,
      f.headline,
      f.subtext,
      CASE
        WHEN LOWER(COALESCE(f.image_url, '')) LIKE 'data:image/%;base64,%' THEN NULL
        WHEN LENGTH(TRIM(COALESCE(f.image_url, ''))) > 2048 THEN NULL
        ELSE f.image_url
      END AS image_url,
      (
        (f.image_data IS NOT NULL AND f.image_mime IS NOT NULL)
        OR LOWER(COALESCE(f.image_url, '')) LIKE 'data:image/%;base64,%'
        OR LENGTH(TRIM(COALESCE(f.image_url, ''))) > 2048
      ) AS has_image_data,
      f.image_mime,
      f.promotion_id,
      f.display_order,
      f.is_active,
      f.updated_at::text AS updated_at,
      p.title AS promotion_title,
      p.description AS promotion_description,
      p.badge_text AS promotion_badge_text,
      p.discount_type AS promotion_discount_type,
      p.discount_value::float AS promotion_discount_value,
      p.start_date::text AS promotion_start_date,
      p.end_date::text AS promotion_end_date,
      p.is_active AS promotion_is_active,
      p.display_order AS promotion_display_order,
      CASE
        WHEN p.id IS NOT NULL
          AND p.is_active = TRUE
          AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
          AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
        THEN TRUE
        ELSE FALSE
      END AS promotion_is_current,
      mi.name AS menu_item_name,
      mi.description AS menu_item_description,
      mi.price_type AS menu_item_price_type,
      mi.price_single::float AS menu_item_price_single,
      mi.price_medium::float AS menu_item_price_medium,
      mi.price_large::float AS menu_item_price_large,
      CASE
        WHEN LOWER(COALESCE(mi.image_url, '')) LIKE 'data:image/%;base64,%' THEN NULL
        WHEN LENGTH(TRIM(COALESCE(mi.image_url, ''))) > 2048 THEN NULL
        ELSE mi.image_url
      END AS menu_item_image_url,
      (
        (mi.image_data IS NOT NULL AND mi.image_mime IS NOT NULL)
        OR LOWER(COALESCE(mi.image_url, '')) LIKE 'data:image/%;base64,%'
        OR LENGTH(TRIM(COALESCE(mi.image_url, ''))) > 2048
      ) AS menu_item_has_image_data,
      mi.image_mime AS menu_item_image_mime,
      mi.is_available AS menu_item_is_available,
      mi.updated_at::text AS menu_item_updated_at,
      mc.name AS menu_item_category_name,
      mc.slug AS menu_item_category_slug,
      mc.price_labels AS menu_item_price_labels,
      mc.allow_multi_price AS menu_item_allow_multi_price,
      lp.id AS linked_promotion_id,
      lp.title AS linked_promotion_title,
      lp.description AS linked_promotion_description,
      lp.badge_text AS linked_promotion_badge_text,
      lp.discount_type AS linked_promotion_discount_type,
      lp.discount_value::float AS linked_promotion_discount_value,
      lp.start_date::text AS linked_promotion_start_date,
      lp.end_date::text AS linked_promotion_end_date,
      lp.is_active AS linked_promotion_is_active,
      lp.display_order AS linked_promotion_display_order,
      CASE
        WHEN lp.id IS NOT NULL
          AND lp.is_active = TRUE
          AND (lp.start_date IS NULL OR lp.start_date <= CURRENT_DATE)
          AND (lp.end_date IS NULL OR lp.end_date >= CURRENT_DATE)
        THEN TRUE
        ELSE FALSE
      END AS linked_promotion_is_current
    FROM featured_items f
    LEFT JOIN promotions p ON p.id = f.promotion_id
    LEFT JOIN menu_items mi ON mi.id = f.menu_item_id
    LEFT JOIN menu_categories mc ON mc.id = mi.category_id
    LEFT JOIN promotions lp ON lp.id = mi.promotion_id
    ORDER BY f.display_order, f.id
  `);

  return rows.map(mapFeaturedItemRow);
}

async function getPublicContent() {
  await ensureDatabase();

  const categories = await fetchCategories();
  const menuItems = await fetchMenuItems(categories);
  const itemsByCategoryId = new Map();

  menuItems.forEach(item => {
    if (!itemsByCategoryId.has(item.categoryId)) {
      itemsByCategoryId.set(item.categoryId, []);
    }
    itemsByCategoryId.get(item.categoryId).push(item);
  });

  const featuredItems = (await fetchFeaturedItems()).filter(item => item.isActive);
  const promotions = await fetchPromotions({ onlyCurrent: true });

  return {
    categories: categories.map(category => ({
      ...category,
      items: itemsByCategoryId.get(category.id) || []
    })),
    featuredItems,
    promotions
  };
}

async function getAdminSnapshot() {
  await ensureDatabase();

  const categories = await fetchCategories();
  const menuItems = await fetchMenuItems(categories);
  const featuredItems = await fetchFeaturedItems();
  const promotions = await fetchPromotions();
  const auditLogs = await fetchAuditLogs();

  return {
    dashboard: {
      categoryCount: categories.length,
      itemCount: menuItems.length,
      availableItemCount: menuItems.filter(item => item.isAvailable).length,
      featuredItemCount: featuredItems.length,
      activePromotionCount: promotions.filter(promotion => promotion.isCurrent).length,
      auditLogCount: auditLogs.length
    },
    categories,
    menuItems,
    featuredItems,
    promotions,
    auditLogs
  };
}

function validateCategoryPrices(category, payload, existingItem) {
  const existing = existingItem || {};

  const priceType = payload.priceType !== undefined
    ? normalizeString(payload.priceType, 'Price type', { maxLength: 20 }) || 'numeric'
    : existing.price_type || 'numeric';

  const priceSingle = payload.priceSingle !== undefined
    ? normalizePrice(payload.priceSingle, 'Price', { required: false })
    : existing.price_single != null
      ? Number(existing.price_single)
      : existing.price_medium != null && !category.allowMultiPrice
        ? Number(existing.price_medium)
        : null;
  const priceMedium = payload.priceMedium !== undefined
    ? normalizePrice(payload.priceMedium, 'Medium price', { required: false })
    : existing.price_medium != null
      ? Number(existing.price_medium)
      : category.allowMultiPrice && existing.price_single != null
        ? Number(existing.price_single)
        : null;
  const priceLarge = payload.priceLarge !== undefined
    ? normalizePrice(payload.priceLarge, 'Large price', { required: false })
    : existing.price_large != null
      ? Number(existing.price_large)
      : null;

  if (priceType === 'numeric') {
    if (category.allowMultiPrice) {
      if (priceMedium == null && priceLarge == null) {
        throw createHttpError(400, 'At least one category price is required.');
      }
    } else if (priceSingle == null) {
      throw createHttpError(400, 'Price is required.');
    }
  }

  return {
    price_type: priceType,
    price_single: category.allowMultiPrice ? null : priceSingle,
    price_medium: category.allowMultiPrice ? priceMedium : null,
    price_large: category.allowMultiPrice ? priceLarge : null
  };
}

async function createCategory(payload, actor) {
  await ensureDatabase();
  const sql = getSql();

  const name = normalizeString(payload.name, 'Category name', { required: true, maxLength: 120 });
  const slug = slugify(payload.slug || name);
  if (!slug) throw createHttpError(400, 'Category slug could not be created.');

  const displayOrder = hasSubmittedValue(payload.displayOrder)
    ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
    : await nextDisplayOrder('menu_categories');

  const rows = await sql(
    `
      INSERT INTO menu_categories (
        slug, name, title, description, layout, price_labels, require_image, allow_multi_price, display_order
      )
      VALUES ($1, $2, $2, $3, $4, $5::jsonb, $6, $7, $8)
      RETURNING *
    `,
    [
      slug,
      name,
      normalizeString(payload.description, 'Category description', { maxLength: 400 }) || null,
      normalizeLayout(payload.layout || 'card'),
      JSON.stringify(normalizePriceLabels(payload.priceLabels)),
      normalizeBoolean(payload.requireImage, false),
      normalizeBoolean(payload.allowMultiPrice, false),
      displayOrder
    ]
  );

  const created = rows[0];
  const afterState = buildCategoryAuditState(created);
  await logAuditEvent({
    actor,
    entityType: 'category',
    entityId: created.id,
    entityLabel: afterState.label,
    action: 'create',
    summary: `Added menu section "${afterState.label}".`,
    changes: buildAuditChanges('category', null, afterState),
    beforeData: null,
    afterData: afterState
  });
}

async function updateCategory(payload, actor) {
  await ensureDatabase();
  const id = normalizeInteger(payload.id, 'Category id', { required: true, min: 1 });
  const current = await getCategoryById(id);
  if (!current) throw createHttpError(404, 'Category not found.');
  const beforeState = buildCategoryAuditState(current);

  const nextName = payload.name !== undefined
    ? normalizeString(payload.name, 'Category name', { required: true, maxLength: 120 })
    : current.name;
  const nextSlug = payload.slug !== undefined
    ? slugify(payload.slug || nextName)
    : current.slug;
  if (!nextSlug) throw createHttpError(400, 'Category slug could not be created.');

  const updated = await updateRecord('menu_categories', id, {
    name: nextName,
    title: nextName,
    slug: nextSlug,
    description: payload.description !== undefined
      ? normalizeString(payload.description, 'Category description', { maxLength: 400 }) || null
      : undefined,
    layout: payload.layout !== undefined ? normalizeLayout(payload.layout) : undefined,
    price_labels: payload.priceLabels !== undefined ? JSON.stringify(normalizePriceLabels(payload.priceLabels)) : undefined,
    require_image: payload.requireImage !== undefined ? normalizeBoolean(payload.requireImage, false) : undefined,
    allow_multi_price: payload.allowMultiPrice !== undefined ? normalizeBoolean(payload.allowMultiPrice, false) : undefined,
    display_order: hasSubmittedValue(payload.displayOrder)
      ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
      : undefined
  });

  const afterState = buildCategoryAuditState(updated);
  await logAuditEvent({
    actor,
    entityType: 'category',
    entityId: updated.id,
    entityLabel: afterState.label,
    action: 'update',
    summary: `Updated menu section "${afterState.label}".`,
    changes: buildAuditChanges('category', beforeState, afterState),
    beforeData: beforeState,
    afterData: afterState
  });
}

async function deleteCategory(payload, actor) {
  await ensureDatabase();
  const sql = getSql();
  const id = normalizeInteger(payload.id, 'Category id', { required: true, min: 1 });
  const current = await getCategoryById(id);
  if (!current) throw createHttpError(404, 'Category not found.');
  const beforeState = buildCategoryAuditState(current);

  const usage = await sql(`SELECT COUNT(*)::int AS count FROM menu_items WHERE category_id = $1`, [id]);
  if (usage[0] && usage[0].count > 0) {
    throw createHttpError(409, 'This category still contains menu items.');
  }

  const rows = await sql(`DELETE FROM menu_categories WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throw createHttpError(404, 'Category not found.');

  await logAuditEvent({
    actor,
    entityType: 'category',
    entityId: id,
    entityLabel: beforeState.label,
    action: 'delete',
    summary: `Deleted menu section "${beforeState.label}".`,
    changes: buildAuditChanges('category', beforeState, null),
    beforeData: beforeState,
    afterData: null
  });
}

async function reorderCategories(payload, actor) {
  await ensureDatabase();
  const categories = await fetchCategories();
  const beforeOrder = sortAuditRecordsForOrder(categories).map(category => category.name);
  await updateDisplayOrderForIds('menu_categories', payload.orderedIds);
  const reordered = await fetchCategories();
  const afterOrder = sortAuditRecordsForOrder(reordered).map(category => category.name);

  await logAuditEvent({
    actor,
    entityType: 'category',
    entityId: null,
    entityLabel: 'Menu sections',
    action: 'reorder',
    summary: 'Reordered menu sections.',
    changes: [
      {
        field: 'displayOrder',
        label: 'New order',
        before: beforeOrder.join(' → ') || '—',
        after: afterOrder.join(' → ') || '—'
      }
    ],
    beforeData: { order: beforeOrder },
    afterData: { order: afterOrder }
  });
}

async function createMenuItem(payload, actor) {
  await ensureDatabase();
  const sql = getSql();

  const categoryId = normalizeInteger(payload.categoryId, 'Category', { required: true, min: 1 });
  const categoryRow = await getCategoryById(categoryId);
  if (!categoryRow) throw createHttpError(404, 'Category not found.');
  const category = mapCategoryRow(categoryRow);

  const prices = validateCategoryPrices(category, payload);
  const imageFields = resolveImageFields(payload);
  if (category.requireImage && !hasImageFields(imageFields)) {
    throw createHttpError(400, 'This category requires an image.');
  }

  const promotionId = payload.promotionId === '' || payload.promotionId == null
    ? null
    : normalizeInteger(payload.promotionId, 'Promotion', { min: 1 });

  if (promotionId != null) {
    await assertPromotionExists(promotionId);
  }

  const displayOrder = hasSubmittedValue(payload.displayOrder)
    ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
    : await nextDisplayOrder('menu_items', 'WHERE category_id = $1', [categoryId]);

  const rows = await sql(
    `
      INSERT INTO menu_items (
        category_id, name, description, price_single, price_medium, price_large,
        image_url, image_data, image_mime, is_featured, is_available, display_order, promotion_id, price_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `,
    [
      categoryId,
      normalizeString(payload.name, 'Item name', { required: true, maxLength: 160 }),
      normalizeString(payload.description, 'Description', { maxLength: 600 }) || null,
      prices.price_single,
      prices.price_medium,
      prices.price_large,
      imageFields.image_url,
      imageFields.image_data,
      imageFields.image_mime,
      normalizeBoolean(payload.isFeatured, false),
      normalizeBoolean(payload.isAvailable, true),
      displayOrder,
      promotionId,
      prices.price_type
    ]
  );

  const inserted = rows[0];
  const insertedWithContext = await getMenuItemById(inserted.id);
  const afterState = await buildMenuItemAuditState(insertedWithContext);
  await logAuditEvent({
    actor,
    entityType: 'item',
    entityId: inserted.id,
    entityLabel: afterState.label,
    action: 'create',
    summary: `Added menu item "${afterState.label}" to "${afterState.category}".`,
    changes: buildAuditChanges('item', null, afterState),
    beforeData: null,
    afterData: afterState
  });
}

async function updateMenuItem(payload, actor) {
  await ensureDatabase();
  const id = normalizeInteger(payload.id, 'Item id', { required: true, min: 1 });
  const current = await getMenuItemById(id);
  if (!current) throw createHttpError(404, 'Menu item not found.');
  const beforeState = await buildMenuItemAuditState(current);

  const nextCategoryId = payload.categoryId !== undefined
    ? normalizeInteger(payload.categoryId, 'Category', { required: true, min: 1 })
    : current.category_id;
  const categoryRow = await getCategoryById(nextCategoryId);
  if (!categoryRow) throw createHttpError(404, 'Category not found.');
  const category = mapCategoryRow(categoryRow);

  const prices = validateCategoryPrices(category, payload, current);
  const imageFields = resolveImageFields(payload, current);
  if (category.requireImage && !hasImageFields(imageFields)) {
    throw createHttpError(400, 'This category requires an image.');
  }

  const promotionId = payload.promotionId === ''
    ? null
    : payload.promotionId !== undefined
      ? normalizeInteger(payload.promotionId, 'Promotion', { min: 1 })
      : current.promotion_id;

  if (promotionId != null) {
    await assertPromotionExists(promotionId);
  }

  const displayOrder = hasSubmittedValue(payload.displayOrder)
    ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
    : nextCategoryId !== current.category_id
      ? await nextDisplayOrder('menu_items', 'WHERE category_id = $1', [nextCategoryId])
      : undefined;

  const updated = await updateRecord('menu_items', id, {
    category_id: nextCategoryId,
    name: payload.name !== undefined
      ? normalizeString(payload.name, 'Item name', { required: true, maxLength: 160 })
      : undefined,
    description: payload.description !== undefined
      ? normalizeString(payload.description, 'Description', { maxLength: 600 }) || null
      : undefined,
    price_single: prices.price_single,
    price_medium: prices.price_medium,
    price_large: prices.price_large,
    price_type: prices.price_type,
    image_url: imageFields.image_url,
    image_data: imageFields.image_data,
    image_mime: imageFields.image_mime,
    is_featured: payload.isFeatured !== undefined ? normalizeBoolean(payload.isFeatured, false) : undefined,
    is_available: payload.isAvailable !== undefined ? normalizeBoolean(payload.isAvailable, true) : undefined,
    display_order: displayOrder,
    promotion_id: promotionId
  });

  if (!updated) throw createHttpError(404, 'Menu item not found.');
  const updatedWithContext = await getMenuItemById(id);
  const afterState = await buildMenuItemAuditState(updatedWithContext);

  await logAuditEvent({
    actor,
    entityType: 'item',
    entityId: id,
    entityLabel: afterState.label,
    action: 'update',
    summary: `Updated menu item "${afterState.label}".`,
    changes: buildAuditChanges('item', beforeState, afterState),
    beforeData: beforeState,
    afterData: afterState
  });
}

async function deleteMenuItem(payload, actor) {
  await ensureDatabase();
  const sql = getSql();
  const id = normalizeInteger(payload.id, 'Item id', { required: true, min: 1 });
  const current = await getMenuItemById(id);
  if (!current) throw createHttpError(404, 'Menu item not found.');
  const beforeState = await buildMenuItemAuditState(current);
  const rows = await sql(`DELETE FROM menu_items WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throw createHttpError(404, 'Menu item not found.');

  await logAuditEvent({
    actor,
    entityType: 'item',
    entityId: id,
    entityLabel: beforeState.label,
    action: 'delete',
    summary: `Deleted menu item "${beforeState.label}".`,
    changes: buildAuditChanges('item', beforeState, null),
    beforeData: beforeState,
    afterData: null
  });
}

async function reorderMenuItems(payload, actor) {
  await ensureDatabase();
  const orderedIds = Array.isArray(payload.orderedIds) ? payload.orderedIds : [];
  const currentRows = await Promise.all(
    orderedIds.map(id => getMenuItemById(normalizeInteger(id, 'Display order item')))
  );
  const beforeOrder = currentRows.filter(Boolean).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0) || (a.id || 0) - (b.id || 0);
  });
  const categoryName = beforeOrder[0] ? beforeOrder[0].category_name : 'Menu';
  await updateDisplayOrderForIds('menu_items', payload.orderedIds);
  const reorderedRows = await Promise.all(
    orderedIds.map(id => getMenuItemById(normalizeInteger(id, 'Display order item')))
  );
  const afterOrder = reorderedRows.filter(Boolean).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0) || (a.id || 0) - (b.id || 0);
  });

  await logAuditEvent({
    actor,
    entityType: 'item',
    entityId: null,
    entityLabel: categoryName,
    action: 'reorder',
    summary: `Reordered menu items in "${categoryName}".`,
    changes: [
      {
        field: 'displayOrder',
        label: 'New order',
        before: beforeOrder.map(item => item.name).join(' → ') || '—',
        after: afterOrder.map(item => item.name).join(' → ') || '—'
      }
    ],
    beforeData: { order: beforeOrder.map(item => item.name), category: categoryName },
    afterData: { order: afterOrder.map(item => item.name), category: categoryName }
  });
}

async function createFeaturedItem(payload, actor) {
  await ensureDatabase();
  const sql = getSql();

  const linkedItem = await assertMenuItemExists(normalizeInteger(payload.menuItemId, 'Linked menu item', { required: true, min: 1 }));
  const imageFields = resolveImageFields(payload);
  const promotionId = payload.promotionId === '' || payload.promotionId == null
    ? null
    : normalizeInteger(payload.promotionId, 'Promotion', { min: 1 });

  if (promotionId != null) {
    await assertPromotionExists(promotionId);
  }

  const displayOrder = hasSubmittedValue(payload.displayOrder)
    ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
    : await nextDisplayOrder('featured_items');

  const rows = await sql(
    `
      INSERT INTO featured_items (
        menu_item_id, headline, subtext, image_url, image_data, image_mime, promotion_id, display_order, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      linkedItem.id,
      normalizeString(payload.headline || linkedItem.name, 'Featured headline', { required: true, maxLength: 160 }),
      normalizeString(payload.subtext, 'Featured subtext', { maxLength: 600 }) || null,
      imageFields.image_url,
      imageFields.image_data,
      imageFields.image_mime,
      promotionId,
      displayOrder,
      normalizeBoolean(payload.isActive, true)
    ]
  );

  const created = rows[0];
  const afterState = await buildFeaturedAuditState(created);
  await logAuditEvent({
    actor,
    entityType: 'featured',
    entityId: created.id,
    entityLabel: afterState.label,
    action: 'create',
    summary: `Added menu spotlight item "${afterState.label}".`,
    changes: buildAuditChanges('featured', null, afterState),
    beforeData: null,
    afterData: afterState
  });
}

async function updateFeaturedItem(payload, actor) {
  await ensureDatabase();
  const id = normalizeInteger(payload.id, 'Featured item id', { required: true, min: 1 });
  const current = await getFeaturedItemById(id);
  if (!current) throw createHttpError(404, 'Featured item not found.');
  const beforeState = await buildFeaturedAuditState(current);

  const linkedItemId = payload.menuItemId !== undefined ? payload.menuItemId : current.menu_item_id;
  const linkedItem = await assertMenuItemExists(normalizeInteger(linkedItemId, 'Linked menu item', { required: true, min: 1 }));

  const imageFields = resolveImageFields(payload, current);
  const promotionId = payload.promotionId === ''
    ? null
    : payload.promotionId !== undefined
      ? normalizeInteger(payload.promotionId, 'Promotion', { min: 1 })
      : current.promotion_id;

  if (promotionId != null) {
    await assertPromotionExists(promotionId);
  }

  const updated = await updateRecord('featured_items', id, {
    menu_item_id: payload.menuItemId !== undefined ? linkedItem.id : undefined,
    headline: payload.headline !== undefined
      ? normalizeString(payload.headline || linkedItem.name, 'Featured headline', { required: true, maxLength: 160 })
      : undefined,
    subtext: payload.subtext !== undefined
      ? normalizeString(payload.subtext, 'Featured subtext', { maxLength: 600 }) || null
      : undefined,
    image_url: imageFields.image_url,
    image_data: imageFields.image_data,
    image_mime: imageFields.image_mime,
    promotion_id: promotionId,
    display_order: hasSubmittedValue(payload.displayOrder)
      ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
      : undefined,
    is_active: payload.isActive !== undefined ? normalizeBoolean(payload.isActive, true) : undefined
  });

  if (!updated) throw createHttpError(404, 'Featured item not found.');
  const refreshed = await getFeaturedItemById(id);
  const afterState = await buildFeaturedAuditState(refreshed);

  await logAuditEvent({
    actor,
    entityType: 'featured',
    entityId: id,
    entityLabel: afterState.label,
    action: 'update',
    summary: `Updated menu spotlight item "${afterState.label}".`,
    changes: buildAuditChanges('featured', beforeState, afterState),
    beforeData: beforeState,
    afterData: afterState
  });
}

async function deleteFeaturedItem(payload, actor) {
  await ensureDatabase();
  const sql = getSql();
  const id = normalizeInteger(payload.id, 'Featured item id', { required: true, min: 1 });
  const current = await getFeaturedItemById(id);
  if (!current) throw createHttpError(404, 'Featured item not found.');
  const beforeState = await buildFeaturedAuditState(current);
  const rows = await sql(`DELETE FROM featured_items WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throw createHttpError(404, 'Featured item not found.');

  await logAuditEvent({
    actor,
    entityType: 'featured',
    entityId: id,
    entityLabel: beforeState.label,
    action: 'delete',
    summary: `Deleted menu spotlight item "${beforeState.label}".`,
    changes: buildAuditChanges('featured', beforeState, null),
    beforeData: beforeState,
    afterData: null
  });
}

async function reorderFeaturedItems(payload, actor) {
  await ensureDatabase();
  const orderedIds = Array.isArray(payload.orderedIds) ? payload.orderedIds : [];
  const beforeRows = await Promise.all(
    orderedIds.map(id => getFeaturedItemById(normalizeInteger(id, 'Display order item')))
  );
  await updateDisplayOrderForIds('featured_items', payload.orderedIds);
  const afterRows = await Promise.all(
    orderedIds.map(id => getFeaturedItemById(normalizeInteger(id, 'Display order item')))
  );
  const beforeOrder = beforeRows.filter(Boolean).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0) || (a.id || 0) - (b.id || 0);
  }).map(function(item) {
    return item.headline;
  });
  const afterOrder = afterRows.filter(Boolean).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0) || (a.id || 0) - (b.id || 0);
  }).map(function(item) {
    return item.headline;
  });

  await logAuditEvent({
    actor,
    entityType: 'featured',
    entityId: null,
    entityLabel: 'Menu spotlight',
    action: 'reorder',
    summary: 'Reordered menu spotlight items.',
    changes: [
      {
        field: 'displayOrder',
        label: 'New order',
        before: beforeOrder.join(' → ') || '—',
        after: afterOrder.join(' → ') || '—'
      }
    ],
    beforeData: { order: beforeOrder },
    afterData: { order: afterOrder }
  });
}

async function createPromotion(payload, actor) {
  await ensureDatabase();
  const sql = getSql();

  const discountType = normalizeDiscountType(payload.discountType);
  const discountValue = discountType === 'text'
    ? null
    : normalizePrice(payload.discountValue, 'Discount value', { required: true });
  if (discountType === 'percentage' && discountValue > 100) {
    throw createHttpError(400, 'Percentage discounts cannot exceed 100.');
  }

  const startDate = normalizeDate(payload.startDate, 'Start date');
  const endDate = normalizeDate(payload.endDate, 'End date');
  ensureDateRange(startDate, endDate);

  const displayOrder = hasSubmittedValue(payload.displayOrder)
    ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
    : await nextDisplayOrder('promotions');

  const rows = await sql(
    `
      INSERT INTO promotions (
        title, description, badge_text, discount_type, discount_value, start_date, end_date, is_active, display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      normalizeString(payload.title, 'Promotion title', { required: true, maxLength: 160 }),
      normalizeString(payload.description, 'Promotion description', { maxLength: 600 }) || null,
      normalizeString(payload.badgeText, 'Promotion badge text', { maxLength: 80 }) || null,
      discountType,
      discountValue,
      startDate,
      endDate,
      normalizeBoolean(payload.isActive, true),
      displayOrder
    ]
  );

  const created = rows[0];
  const afterState = buildPromotionAuditState(created);
  await logAuditEvent({
    actor,
    entityType: 'promotion',
    entityId: created.id,
    entityLabel: afterState.label,
    action: 'create',
    summary: `Added special offer "${afterState.label}".`,
    changes: buildAuditChanges('promotion', null, afterState),
    beforeData: null,
    afterData: afterState
  });
}

async function updatePromotion(payload, actor) {
  await ensureDatabase();
  const id = normalizeInteger(payload.id, 'Promotion id', { required: true, min: 1 });
  const current = await getPromotionById(id);
  if (!current) throw createHttpError(404, 'Promotion not found.');
  const beforeState = buildPromotionAuditState(current);

  const discountType = payload.discountType !== undefined
    ? normalizeDiscountType(payload.discountType)
    : current.discount_type;
  const discountValue = payload.discountValue !== undefined
    ? (discountType === 'text' ? null : normalizePrice(payload.discountValue, 'Discount value', { required: true }))
    : discountType === 'text'
      ? null
      : current.discount_value != null
        ? Number(current.discount_value)
        : null;
  if (discountType === 'percentage' && discountValue != null && discountValue > 100) {
    throw createHttpError(400, 'Percentage discounts cannot exceed 100.');
  }

  const startDate = payload.startDate !== undefined
    ? normalizeDate(payload.startDate, 'Start date')
    : current.start_date;
  const endDate = payload.endDate !== undefined
    ? normalizeDate(payload.endDate, 'End date')
    : current.end_date;
  ensureDateRange(startDate, endDate);

  const updated = await updateRecord('promotions', id, {
    title: payload.title !== undefined
      ? normalizeString(payload.title, 'Promotion title', { required: true, maxLength: 160 })
      : undefined,
    description: payload.description !== undefined
      ? normalizeString(payload.description, 'Promotion description', { maxLength: 600 }) || null
      : undefined,
    badge_text: payload.badgeText !== undefined
      ? normalizeString(payload.badgeText, 'Promotion badge text', { maxLength: 80 }) || null
      : undefined,
    discount_type: discountType,
    discount_value: discountValue,
    start_date: startDate,
    end_date: endDate,
    is_active: payload.isActive !== undefined ? normalizeBoolean(payload.isActive, true) : undefined,
    display_order: hasSubmittedValue(payload.displayOrder)
      ? normalizeInteger(payload.displayOrder, 'Display order', { min: 1 })
      : undefined
  });

  if (!updated) throw createHttpError(404, 'Promotion not found.');
  const afterState = buildPromotionAuditState(updated);

  await logAuditEvent({
    actor,
    entityType: 'promotion',
    entityId: id,
    entityLabel: afterState.label,
    action: 'update',
    summary: `Updated special offer "${afterState.label}".`,
    changes: buildAuditChanges('promotion', beforeState, afterState),
    beforeData: beforeState,
    afterData: afterState
  });
}

async function deletePromotion(payload, actor) {
  await ensureDatabase();
  const sql = getSql();
  const id = normalizeInteger(payload.id, 'Promotion id', { required: true, min: 1 });
  const current = await getPromotionById(id);
  if (!current) throw createHttpError(404, 'Promotion not found.');
  const beforeState = buildPromotionAuditState(current);
  const rows = await sql(`DELETE FROM promotions WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throw createHttpError(404, 'Promotion not found.');

  await logAuditEvent({
    actor,
    entityType: 'promotion',
    entityId: id,
    entityLabel: beforeState.label,
    action: 'delete',
    summary: `Deleted special offer "${beforeState.label}".`,
    changes: buildAuditChanges('promotion', beforeState, null),
    beforeData: beforeState,
    afterData: null
  });
}

async function reorderPromotions(payload, actor) {
  await ensureDatabase();
  const orderedIds = Array.isArray(payload.orderedIds) ? payload.orderedIds : [];
  const beforeRows = await Promise.all(
    orderedIds.map(id => getPromotionById(normalizeInteger(id, 'Display order item')))
  );
  await updateDisplayOrderForIds('promotions', payload.orderedIds);
  const afterRows = await Promise.all(
    orderedIds.map(id => getPromotionById(normalizeInteger(id, 'Display order item')))
  );
  const beforeOrder = beforeRows.filter(Boolean).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0) || (a.id || 0) - (b.id || 0);
  }).map(function(item) {
    return item.title;
  });
  const afterOrder = afterRows.filter(Boolean).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0) || (a.id || 0) - (b.id || 0);
  }).map(function(item) {
    return item.title;
  });

  await logAuditEvent({
    actor,
    entityType: 'promotion',
    entityId: null,
    entityLabel: 'Special offers',
    action: 'reorder',
    summary: 'Reordered special offers.',
    changes: [
      {
        field: 'displayOrder',
        label: 'New order',
        before: beforeOrder.join(' → ') || '—',
        after: afterOrder.join(' → ') || '—'
      }
    ],
    beforeData: { order: beforeOrder },
    afterData: { order: afterOrder }
  });
}

module.exports = {
  createCategory,
  createFeaturedItem,
  createMenuItem,
  createPromotion,
  deleteCategory,
  deleteFeaturedItem,
  deleteMenuItem,
  deletePromotion,
  getAdminSnapshot,
  getPublicContent,
  reorderCategories,
  reorderFeaturedItems,
  reorderMenuItems,
  reorderPromotions,
  updateCategory,
  updateFeaturedItem,
  updateMenuItem,
  updatePromotion
};
