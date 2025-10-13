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

function json(statusCode, bodyObj, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extra },
    body: JSON.stringify(bodyObj)
  };
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
  `);
}

function requireAdmin(event) {
  const keyHeader = event.headers && (event.headers['x-admin-key'] || event.headers['X-Admin-Key']);
  if (!process.env.ADMIN_KEY) return true; // if not configured, allow (for initial setup)
  return keyHeader && keyHeader === process.env.ADMIN_KEY;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    if (!process.env.NEON_DATABASE_URL) {
      return json(500, { error: 'NEON_DATABASE_URL not configured' });
    }
    await ensureTable();

    if (event.httpMethod === 'GET') {
      const { rows } = await pool.query('SELECT id, category, name, description, price::float AS price FROM menu_items ORDER BY category, name');
      return json(200, { items: rows });
    }

    if (!requireAdmin(event)) {
      return json(401, { error: 'Unauthorized' });
    }

    const payload = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === 'POST') {
      const { category, name, description, price } = payload;
      if (!category || !name || !description || typeof price === 'undefined') {
        return json(400, { error: 'Missing fields' });
      }
      const { rows } = await pool.query(
        'INSERT INTO menu_items (category, name, description, price) VALUES ($1,$2,$3,$4) RETURNING id, category, name, description, price::float AS price',
        [category, name, description, price]
      );
      return json(201, { item: rows[0] });
    }

    if (event.httpMethod === 'PUT') {
      const { id, category, name, description, price } = payload;
      if (!id) return json(400, { error: 'Missing id' });

      const fields = [];
      const values = [];
      let i = 1;
      if (category != null) { fields.push(`category = $${i++}`); values.push(category); }
      if (name != null) { fields.push(`name = $${i++}`); values.push(name); }
      if (description != null) { fields.push(`description = $${i++}`); values.push(description); }
      if (price != null) { fields.push(`price = $${i++}`); values.push(price); }
      if (!fields.length) return json(400, { error: 'No fields to update' });
      values.push(id);
      const sql = `UPDATE menu_items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id, category, name, description, price::float AS price`;
      const { rows } = await pool.query(sql, values);
      if (!rows.length) return json(404, { error: 'Not found' });
      return json(200, { item: rows[0] });
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
    return json(500, { error: 'Server error' });
  }
};

