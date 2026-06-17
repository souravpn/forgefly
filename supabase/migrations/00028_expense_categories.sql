-- Migration 00028: expense_categories table + seed data (#40)

CREATE TABLE IF NOT EXISTS expense_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,  -- null = system default
  name            text NOT NULL,
  schedule_c_line text,
  is_cogs         boolean DEFAULT false,
  is_default      boolean DEFAULT false,
  vertical        text,   -- null = all verticals; 'b2c_local' | 'b2b_creative' | 'b2b_professional'
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON expense_categories (business_id);
CREATE INDEX ON expense_categories (vertical) WHERE vertical IS NOT NULL;

-- RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- System defaults (business_id IS NULL) are readable by all authenticated users
CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT USING (
    business_id IS NULL
    OR business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "expense_categories_insert" ON expense_categories
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "expense_categories_update" ON expense_categories
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "expense_categories_delete" ON expense_categories
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- ─── Seed: all-vertical defaults (business_id = NULL) ───────────────────────

INSERT INTO expense_categories (name, schedule_c_line, is_cogs, is_default, vertical, sort_order) VALUES
  ('Software & subscriptions',    'L22',  false, true, NULL,  1),
  ('Hardware & equipment',        'L13',  false, true, NULL,  2),
  ('Phone & internet',            'L25',  false, true, NULL,  3),
  ('Marketing & advertising',     'L8',   false, true, NULL,  4),
  ('Professional development',    'L27a', false, true, NULL,  5),
  ('Bank & payment fees',         'L10',  false, true, NULL,  6),
  ('Office supplies',             'L18',  false, true, NULL,  7),
  ('Travel — flights & hotels',   'L24a', false, true, NULL,  8),
  ('Meals with clients',          'L24b', false, true, NULL,  9),
  ('Professional services',       'L17',  false, true, NULL, 10),
  ('Home office',                 'L30',  false, true, NULL, 11),
  ('Other',                       'L27a', false, true, NULL, 12);

-- ─── Seed: b2c_local additions ───────────────────────────────────────────────

INSERT INTO expense_categories (name, schedule_c_line, is_cogs, is_default, vertical, sort_order) VALUES
  ('COGS — materials',   'L4', true, true, 'b2c_local', 1),
  ('COGS — packaging',   'L4', true, true, 'b2c_local', 2),
  ('COGS — supplies',    'L4', true, true, 'b2c_local', 3),
  ('Vehicle / mileage',  'L9', false, true, 'b2c_local', 4);

-- ─── Seed: b2b_creative additions ────────────────────────────────────────────

INSERT INTO expense_categories (name, schedule_c_line, is_cogs, is_default, vertical, sort_order) VALUES
  ('Software licenses',       'L22',  false, true, 'b2b_creative', 1),
  ('Stock assets',            'L22',  false, true, 'b2b_creative', 2),
  ('Contractor payments',     'L11',  false, true, 'b2b_creative', 3),
  ('Equipment rental',        'L20b', false, true, 'b2b_creative', 4);

-- ─── Seed: b2b_professional additions ────────────────────────────────────────

INSERT INTO expense_categories (name, schedule_c_line, is_cogs, is_default, vertical, sort_order) VALUES
  ('Professional liability insurance', 'L15',  false, true, 'b2b_professional', 1),
  ('Continuing education',             'L27a', false, true, 'b2b_professional', 2),
  ('Association memberships',          'L27a', false, true, 'b2b_professional', 3),
  ('Contractor payments',              'L11',  false, true, 'b2b_professional', 4);
