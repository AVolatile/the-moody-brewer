'use strict';

const { CATEGORY_SEED, FEATURED_SEED, ITEM_SEED } = require('./seed-data');

async function ensureSchema(sql) {
  await sql(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT,
      title TEXT,
      description TEXT,
      layout TEXT NOT NULL DEFAULT 'card',
      price_labels JSONB NOT NULL DEFAULT '[]'::JSONB,
      require_image BOOLEAN NOT NULL DEFAULT FALSE,
      allow_multi_price BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS promotions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      badge_text TEXT,
      discount_type TEXT NOT NULL DEFAULT 'text',
      discount_value NUMERIC(10,2),
      start_date DATE,
      end_date DATE,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      pricing_mode TEXT NOT NULL DEFAULT 'single',
      price_single NUMERIC(10,2),
      price_medium NUMERIC(10,2),
      price_large NUMERIC(10,2),
      sizes JSONB NOT NULL DEFAULT '[]'::JSONB,
      image_url TEXT,
      image_path TEXT,
      image_data TEXT,
      image_mime TEXT,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      position INTEGER,
      promotion_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS featured_items (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER,
      headline TEXT NOT NULL,
      subtext TEXT,
      image_url TEXT,
      image_data TEXT,
      image_mime TEXT,
      promotion_id INTEGER,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_username TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_label TEXT,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      changes JSONB NOT NULL DEFAULT '[]'::JSONB,
      before_data JSONB,
      after_data JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS name TEXT`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS title TEXT`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS description TEXT`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'card'`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS price_labels JSONB NOT NULL DEFAULT '[]'::JSONB`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS require_image BOOLEAN NOT NULL DEFAULT FALSE`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS allow_multi_price BOOLEAN NOT NULL DEFAULT FALSE`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await sql(`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS order_index INTEGER`);

  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_path TEXT`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_data TEXT`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_mime TEXT`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS position INTEGER`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS promotion_id INTEGER`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'numeric'`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'single'`);
  await sql(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '[]'::JSONB`);

  await sql(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS badge_text TEXT`);
  await sql(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);

  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS menu_item_id INTEGER`);
  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS image_data TEXT`);
  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS image_mime TEXT`);
  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS promotion_id INTEGER`);
  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await sql(`ALTER TABLE featured_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);

  await sql(`UPDATE menu_categories SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), slug) WHERE name IS NULL OR name = ''`);
  await sql(`UPDATE menu_categories SET title = COALESCE(NULLIF(title, ''), name) WHERE title IS NULL OR title = ''`);
  await sql(`UPDATE menu_categories SET display_order = COALESCE(NULLIF(display_order, 0), order_index, 0)`);
  await sql(`UPDATE menu_items SET image_url = COALESCE(NULLIF(image_url, ''), NULLIF(image_path, '')) WHERE image_url IS NULL OR image_url = ''`);
  await sql(`UPDATE menu_items SET display_order = COALESCE(NULLIF(display_order, 0), position, 0)`);

  await sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_promotion_fk'
      ) THEN
        ALTER TABLE menu_items
          ADD CONSTRAINT menu_items_promotion_fk
          FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'featured_items_menu_item_fk'
      ) THEN
        ALTER TABLE featured_items
          ADD CONSTRAINT featured_items_menu_item_fk
          FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'featured_items_promotion_fk'
      ) THEN
        ALTER TABLE featured_items
          ADD CONSTRAINT featured_items_promotion_fk
          FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await sql(`CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_menu_items_display_order ON menu_items(category_id, display_order)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_featured_items_display_order ON featured_items(display_order)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_promotions_display_order ON promotions(display_order)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_created_at ON audit_logs(entity_type, created_at DESC)`);

  for (const category of CATEGORY_SEED) {
    await sql(
      `
        INSERT INTO menu_categories (slug, name, title, description, layout, price_labels, require_image, allow_multi_price, display_order)
        VALUES ($1, $2, $2, $3, $4, $5::jsonb, $6, $7, $8)
        ON CONFLICT (slug) DO NOTHING
      `,
      [
        category.slug,
        category.name,
        category.description,
        category.layout,
        JSON.stringify(category.priceLabels),
        category.requireImage,
        category.allowMultiPrice,
        category.displayOrder
      ]
    );
  }

  const itemCountRows = await sql(`SELECT COUNT(*)::int AS count FROM menu_items`);
  const itemCount = itemCountRows[0] ? itemCountRows[0].count : 0;

  if (itemCount === 0) {
    const categories = await sql(`SELECT id, slug FROM menu_categories`);
    const categoryMap = new Map(categories.map(category => [category.slug, category.id]));

    for (const item of ITEM_SEED) {
      const categoryId = categoryMap.get(item.categorySlug);
      if (!categoryId) continue;

      await sql(
        `
          INSERT INTO menu_items (
            category_id, name, description, price_single, price_medium, price_large,
            image_url, is_featured, is_available, display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          categoryId,
          item.name,
          item.description || null,
          item.priceSingle != null ? item.priceSingle : null,
          item.priceMedium != null ? item.priceMedium : null,
          item.priceLarge != null ? item.priceLarge : null,
          item.imageUrl || null,
          item.isFeatured || false,
          item.isAvailable !== false,
          item.displayOrder || 0
        ]
      );
    }
  }

  await sql(`
    UPDATE menu_items i
    SET
      pricing_mode = 'sizes',
      sizes = (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('label', label, 'price', price) ORDER BY sort_order),
          '[]'::jsonb
        )
        FROM (
          VALUES
            (1, COALESCE(NULLIF(c.price_labels->>0, ''), 'M'), i.price_medium),
            (2, COALESCE(NULLIF(c.price_labels->>1, ''), 'L'), i.price_large)
        ) AS candidate_prices(sort_order, label, price)
        WHERE price IS NOT NULL
      )
    FROM menu_categories c
    WHERE c.id = i.category_id
      AND jsonb_array_length(COALESCE(i.sizes, '[]'::jsonb)) = 0
      AND (i.price_medium IS NOT NULL OR i.price_large IS NOT NULL)
      AND (c.allow_multi_price = TRUE OR i.price_single IS NULL)
  `);

  const featuredCountRows = await sql(`SELECT COUNT(*)::int AS count FROM featured_items`);
  const featuredCount = featuredCountRows[0] ? featuredCountRows[0].count : 0;

  if (featuredCount === 0) {
    for (const entry of FEATURED_SEED) {
      const rows = await sql(
        `
          SELECT id, image_url
          FROM menu_items
          WHERE name = $1
          ORDER BY id
          LIMIT 1
        `,
        [entry.sourceName]
      );

      if (!rows.length) continue;

      await sql(
        `
          INSERT INTO featured_items (menu_item_id, headline, subtext, image_url, display_order, is_active)
          VALUES ($1, $2, $3, $4, $5, TRUE)
        `,
        [rows[0].id, entry.headline, entry.subtext, rows[0].image_url || null, entry.displayOrder]
      );
    }
  }
}

module.exports = {
  ensureSchema
};
