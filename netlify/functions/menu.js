'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key'
};

const CATEGORY_SEED = [
  { slug: 'signature', title: 'Signature Drinks', layout: 'card', require_image: true, allow_multi_price: false, price_labels: [], order_index: 1 },
  { slug: 'iced-favorites', title: 'Iced Favorites', layout: 'card', require_image: true, allow_multi_price: false, price_labels: [], order_index: 2 },
  { slug: 'hot-coffee', title: 'Hot Coffee', layout: 'table', require_image: false, allow_multi_price: true, price_labels: ['M', 'L'], order_index: 3 },
  { slug: 'iced-coffee', title: 'Iced Coffee', layout: 'table', require_image: false, allow_multi_price: true, price_labels: ['M', 'L'], order_index: 4 },
  { slug: 'tea-drinks', title: 'Tea & Drinks', layout: 'table', require_image: false, allow_multi_price: true, price_labels: ['M', 'L'], order_index: 5 },
  { slug: 'more-to-explore', title: 'More To Explore', layout: 'list', require_image: false, allow_multi_price: false, price_labels: ['Price'], order_index: 6 }
];

function json(statusCode, bodyObj, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extra },
    body: JSON.stringify(bodyObj)
  };
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      layout TEXT NOT NULL,
      price_labels JSONB DEFAULT '[]'::JSONB,
      require_image BOOLEAN NOT NULL DEFAULT FALSE,
      allow_multi_price BOOLEAN NOT NULL DEFAULT FALSE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price_single NUMERIC(10,2),
      price_medium NUMERIC(10,2),
      price_large NUMERIC(10,2),
      image_data TEXT,
      image_mime TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
  `);

  for (const cat of CATEGORY_SEED) {
    await pool.query(
      `INSERT INTO menu_categories (slug, title, layout, price_labels, require_image, allow_multi_price, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (slug)
       DO UPDATE SET title = EXCLUDED.title,
                     layout = EXCLUDED.layout,
                     price_labels = EXCLUDED.price_labels,
                     require_image = EXCLUDED.require_image,
                     allow_multi_price = EXCLUDED.allow_multi_price,
                     order_index = EXCLUDED.order_index,
                     updated_at = NOW();`,
      [cat.slug, cat.title, cat.layout, JSON.stringify(cat.price_labels || []), cat.require_image, cat.allow_multi_price, cat.order_index]
    );
  }
}

async function loadCategories() {
  const { rows } = await pool.query(`
    SELECT id, slug, title, layout, price_labels, require_image, allow_multi_price, order_index
    FROM menu_categories
    ORDER BY order_index, id
  `);
  const list = rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    layout: row.layout,
    priceLabels: Array.isArray(row.price_labels) ? row.price_labels : (row.price_labels ? Object.values(row.price_labels) : []),
    requireImage: row.require_image,
    allowMultiPrice: row.allow_multi_price,
    orderIndex: row.order_index
  }));
  const map = new Map();
  list.forEach(cat => map.set(cat.slug, cat));
  return { list, map };
}

function parseImageField(imageValue) {
  if (!imageValue || typeof imageValue !== 'string') return null;
  if (imageValue.startsWith('data:')) {
    const match = /^data:(.*?);base64,(.+)$/.exec(imageValue);
    if (!match) return null;
    return { mime: match[1], data: match[2] };
  }
  return null;
}

function itemRowToJSON(row) {
  const imageData = row.image_data && row.image_mime ? `data:${row.image_mime};base64,${row.image_data}` : null;
  return {
    id: row.id,
    categorySlug: row.category_slug,
    name: row.name,
    description: row.description,
    priceSingle: row.price_single != null ? Number(row.price_single) : null,
    priceMedium: row.price_medium != null ? Number(row.price_medium) : null,
    priceLarge: row.price_large != null ? Number(row.price_large) : null,
    imageData,
    position: row.position
  };
}

function requireAdmin(event) {
  const keyHeader = event.headers && (event.headers['x-admin-key'] || event.headers['X-Admin-Key']);
  if (!process.env.ADMIN_KEY) return true;
  return keyHeader && keyHeader === process.env.ADMIN_KEY;
}

async function fetchMenuPayload() {
  const { list } = await loadCategories();
  const { rows } = await pool.query(`
    SELECT i.id, i.name, i.description,
           i.price_single::float AS price_single,
           i.price_medium::float AS price_medium,
           i.price_large::float AS price_large,
           i.image_data, i.image_mime, i.position,
           c.slug AS category_slug
    FROM menu_items i
    JOIN menu_categories c ON c.id = i.category_id
    ORDER BY c.order_index, i.position, i.name;
  `);
  const bySlug = {};
  rows.forEach(row => {
    const item = itemRowToJSON(row);
    if (!bySlug[item.categorySlug]) bySlug[item.categorySlug] = [];
    bySlug[item.categorySlug].push(item);
  });

  return {
    categories: list.map(cat => ({
      slug: cat.slug,
      title: cat.title,
      layout: cat.layout,
      priceLabels: cat.priceLabels,
      requireImage: cat.requireImage,
      allowMultiPrice: cat.allowMultiPrice,
      items: bySlug[cat.slug] || []
    }))
  };
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function validatePrices(catMeta, payload, existingItem) {
  const existing = existingItem || {};
  const priceSingle = payload.priceSingle !== undefined ? normalizePrice(payload.priceSingle) : normalizePrice(existing.price_single);
  const priceMedium = payload.priceMedium !== undefined ? normalizePrice(payload.priceMedium) : normalizePrice(existing.price_medium);
  const priceLarge = payload.priceLarge !== undefined ? normalizePrice(payload.priceLarge) : normalizePrice(existing.price_large);

  if (catMeta.layout === 'card' || (!catMeta.allowMultiPrice && catMeta.layout !== 'table')) {
    const price = priceSingle;
    if (price == null || isNaN(Number(price))) {
      throw json(400, { error: 'Price is required for this category' });
    }
  }
  if (catMeta.allowMultiPrice) {
    const hasAny = (priceMedium != null && !isNaN(Number(priceMedium))) ||
                   (priceLarge != null && !isNaN(Number(priceLarge)));
    if (!hasAny) {
      throw json(400, { error: 'At least one price is required for this category' });
    }
  }
  return { priceSingle, priceMedium, priceLarge };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    if (!process.env.NEON_DATABASE_URL) {
      return json(500, { error: 'NEON_DATABASE_URL not configured' });
    }

    await ensureSchema();
    const { list: categories, map: categoryMap } = await loadCategories();

    if (event.httpMethod === 'GET') {
      const payload = await fetchMenuPayload();
      return json(200, payload);
    }

    if (!requireAdmin(event)) {
      return json(401, { error: 'Unauthorized' });
    }

    const payload = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === 'POST') {
      const { categorySlug, name, description, priceSingle, priceMedium, priceLarge, image } = payload;
      if (!categorySlug || !categoryMap.has(categorySlug)) {
        return json(400, { error: 'Invalid category' });
      }
      if (!name || !name.trim()) return json(400, { error: 'Name is required' });

      const catMeta = categoryMap.get(categorySlug);
      const priceInfo = validatePrices(catMeta, payload);

      let imageParts = null;
      if (catMeta.requireImage) {
        imageParts = parseImageField(image);
        if (!imageParts) {
          return json(400, { error: 'Image required for this category' });
        }
        if (imageParts.data.length > 2 * 1024 * 1024) {
          return json(413, { error: 'Image too large (max 2MB)' });
        }
      }

      const { rows: posRows } = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM menu_items WHERE category_id = $1', [catMeta.id]);
      const nextPosition = posRows[0].next || 1;

      const insertSQL = `
        INSERT INTO menu_items (category_id, name, description, price_single, price_medium, price_large, image_data, image_mime, position)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, name, description, price_single::float AS price_single, price_medium::float AS price_medium, price_large::float AS price_large, image_data, image_mime, position
      `;

      const values = [
        catMeta.id,
        name.trim(),
        description ? description.trim() : null,
        priceInfo.priceSingle,
        priceInfo.priceMedium,
        priceInfo.priceLarge,
        imageParts ? imageParts.data : null,
        imageParts ? imageParts.mime : null,
        nextPosition
      ];

      const { rows } = await pool.query(insertSQL, values);
      const itemRow = rows[0];
      itemRow.category_slug = categorySlug;
      const payloadOut = itemRowToJSON(itemRow);
      return json(201, { item: payloadOut });
    }

    if (event.httpMethod === 'PUT') {
      const { id, categorySlug, name, description, priceSingle, priceMedium, priceLarge, image, removeImage } = payload;
      if (!id) return json(400, { error: 'Missing id' });

      const itemRes = await pool.query(`
        SELECT i.id, i.category_id, c.slug AS category_slug, c.require_image, c.allow_multi_price, c.layout,
               i.image_data, i.image_mime,
               i.price_single::float AS price_single,
               i.price_medium::float AS price_medium,
               i.price_large::float AS price_large
        FROM menu_items i
        JOIN menu_categories c ON c.id = i.category_id
        WHERE i.id = $1
      `, [id]);
      if (!itemRes.rows.length) return json(404, { error: 'Not found' });
      let current = itemRes.rows[0];

      let catMeta = categoryMap.get(current.category_slug);
      let newCategoryId = current.category_id;
      let categorySlugFinal = current.category_slug;
      let positionOverride = null;
      if (categorySlug && categoryMap.has(categorySlug) && categorySlug !== current.category_slug) {
        catMeta = categoryMap.get(categorySlug);
        newCategoryId = catMeta.id;
        categorySlugFinal = catMeta.slug;
        const { rows: newPosRows } = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM menu_items WHERE category_id = $1', [newCategoryId]);
        positionOverride = newPosRows[0].next || 1;
      }

      const metaForValidation = {
        layout: catMeta.layout,
        allowMultiPrice: catMeta.allowMultiPrice,
        priceSingle,
        priceMedium,
        priceLarge
      };

      const priceInfo = validatePrices(catMeta, payload, current);

      let imageParts = null;
      let willUpdateImage = false;
      if (typeof image === 'string' && image.length) {
        imageParts = parseImageField(image);
        if (!imageParts) return json(400, { error: 'Invalid image data' });
        if (imageParts.data.length > 2 * 1024 * 1024) {
          return json(413, { error: 'Image too large (max 2MB)' });
        }
        willUpdateImage = true;
      } else if (removeImage) {
        willUpdateImage = true;
        imageParts = null;
      }

      if (catMeta.requireImage && willUpdateImage && !imageParts) {
        return json(400, { error: 'Image required for this category' });
      }

      const fields = [];
      const values = [];
      let i = 1;

      if (newCategoryId !== current.category_id) { fields.push(`category_id = $${i++}`); values.push(newCategoryId); }
      if (name != null) { fields.push(`name = $${i++}`); values.push(name.trim()); }
      if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description ? description.trim() : null); }
      if (!catMeta.allowMultiPrice || catMeta.layout === 'card' || catMeta.layout === 'list') {
        fields.push(`price_single = $${i++}`);
        values.push(priceInfo.priceSingle);
        fields.push(`price_medium = $${i++}`);
        values.push(null);
        fields.push(`price_large = $${i++}`);
        values.push(null);
      } else {
        fields.push(`price_single = $${i++}`);
        values.push(null);
        fields.push(`price_medium = $${i++}`);
        values.push(priceInfo.priceMedium);
        fields.push(`price_large = $${i++}`);
        values.push(priceInfo.priceLarge);
      }
      if (willUpdateImage) {
        fields.push(`image_data = $${i++}`);
        values.push(imageParts ? imageParts.data : null);
        fields.push(`image_mime = $${i++}`);
        values.push(imageParts ? imageParts.mime : null);
      }

      if (!fields.length) return json(400, { error: 'No fields to update' });

      if (positionOverride != null) {
        fields.push(`position = $${i++}`);
        values.push(positionOverride);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const sql = `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, description, price_single::float AS price_single, price_medium::float AS price_medium, price_large::float AS price_large, image_data, image_mime, position`;
      const { rows } = await pool.query(sql, values);
      if (!rows.length) return json(404, { error: 'Not found' });
      const itemRow = rows[0];
      itemRow.category_slug = categorySlugFinal;
      return json(200, { item: itemRowToJSON(itemRow) });
    }

    if (event.httpMethod === 'DELETE') {
      const { id } = payload;
      if (!id) return json(400, { error: 'Missing id' });
      const { rowCount } = await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
      if (!rowCount) return json(404, { error: 'Not found' });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    if (err && err.statusCode) return err; // already formatted response
    return json(500, { error: 'Server error' });
  }
};
