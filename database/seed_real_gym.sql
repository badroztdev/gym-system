-- ============================================================
--  Seed Data — نادي صقور الهضاب
--  ملف UTF-8 نظيف، يُشغَّل عبر psql -f مباشرة (بدون نسخ/لصق)
-- ============================================================

INSERT INTO gyms (id, name, address, phone, email, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'نادي صقور الهضاب',
  NULL,
  '0661153294',
  NULL,
  '{"currency": "DZD", "timezone": "Africa/Algiers", "session_qr_validity_minutes": 10}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone;

-- كلمة المرور: badro123  (مُشفَّرة مسبقاً بـ bcrypt)
INSERT INTO users (id, gym_id, full_name, email, phone, password_hash, role)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'زاوي أبوبكر',
  NULL,
  '0661153294',
  '$2b$10$VRAa1SWsAY7A0vEtxiT7PO1alryx3Ey0s4YjoE46lWyyKfJjCowEm',
  'owner'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash;

-- فئات رياضية أساسية (يمكنك تعديلها لاحقاً من صفحة "الفريق")
INSERT INTO sport_categories (gym_id, name, color) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'كرة القدم',       '#ef4444'),
  ('a0000000-0000-0000-0000-000000000001', 'كمال الأجسام',    '#f97316'),
  ('a0000000-0000-0000-0000-000000000001', 'الفنون القتالية', '#8b5cf6'),
  ('a0000000-0000-0000-0000-000000000001', 'السباحة',         '#0ea5e9'),
  ('a0000000-0000-0000-0000-000000000001', 'الجمباز',         '#10b981')
ON CONFLICT DO NOTHING;

-- ============================================================
--  التحقق
-- ============================================================
SELECT id, name, phone FROM gyms;
SELECT id, full_name, phone, role FROM users;
