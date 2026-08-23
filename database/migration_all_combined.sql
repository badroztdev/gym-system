-- ============================================================
--  Migration شاملة — تُطبَّق بأمان حتى لو أُعيد تشغيلها عدة مرات
--  تُضيف فقط ما هو ناقص، ولا تلمس الجداول أو البيانات الموجودة
-- ============================================================

-- ── 1. ENUMs الجديدة (فحص الوجود يدوياً لأن ENUM لا يدعم IF NOT EXISTS) ──
DO $$ BEGIN
  CREATE TYPE blood_group AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sport_category_age AS ENUM ('مدارس','براعم','أصاغر','أشبال','أواسط','أمال','أكابر');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. أعمدة إضافية على users ──────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_category  sport_category_age,
  ADD COLUMN IF NOT EXISTS rank          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS weight_kg     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS blood_group   blood_group,
  ADD COLUMN IF NOT EXISTS group_name    VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_users_group_name ON users(group_name);

-- السماح بترك رقم الهاتف فارغاً (رياضي مرتبط بولي أمر بدون رقم خاص)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

-- ── 3. سعر الاشتراك (لقطة من سعر الخطة وقت الإنشاء) ──────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
UPDATE subscriptions s SET price = sp.price
  FROM subscription_plans sp WHERE s.plan_id = sp.id AND s.price IS NULL;
ALTER TABLE subscriptions
  ALTER COLUMN price SET DEFAULT 0,
  ALTER COLUMN price SET NOT NULL;

-- ── 4. جدول القاعات (rooms) مع QR ثابت ──────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id     UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  capacity   INT NOT NULL DEFAULT 20,
  qr_code    TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_gym_id  ON rooms(gym_id);
CREATE INDEX IF NOT EXISTS idx_rooms_qr_code ON rooms(qr_code);

-- ── 5. تكرار الحصص + الفئة العمرية + ربط القاعة ─────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS room_id           UUID REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurring      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_days   INT[],
  ADD COLUMN IF NOT EXISTS recurrence_end    DATE,
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS age_category      sport_category_age;

-- ── 6. الحضور عبر QR القاعة ──────────────────────────────────
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS room_id     UUID REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_method VARCHAR(20) DEFAULT 'qr_room';

-- ── 7. رموز FCM لإشعارات Firebase ─────────────────────────────
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   VARCHAR(20) NOT NULL DEFAULT 'web',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fcm_user_id ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_token   ON user_fcm_tokens(token);

-- ── 8. متابعة التقدم: قياسات مخصصة + سجل الرتب ───────────────
ALTER TABLE athlete_progress ADD COLUMN IF NOT EXISTS custom_metrics JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS rank_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_rank   VARCHAR(100),
  new_rank   VARCHAR(100) NOT NULL,
  changed_by UUID REFERENCES users(id),
  notes      TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rank_history_athlete ON rank_history(athlete_id);

CREATE TABLE IF NOT EXISTS metric_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id       UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES sport_categories(id) ON DELETE CASCADE,
  metric_key   VARCHAR(50)  NOT NULL,
  metric_label VARCHAR(100) NOT NULL,
  unit         VARCHAR(20),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metric_templates_category ON metric_templates(category_id);

-- ============================================================
--  التحقق النهائي — يجب أن تظهر كل هذه الأعمدة/الجداول
-- ============================================================
SELECT 'users.group_name' AS check_item, EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name='users' AND column_name='group_name'
) AS exists
UNION ALL
SELECT 'rooms table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rooms')
UNION ALL
SELECT 'user_fcm_tokens table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_fcm_tokens')
UNION ALL
SELECT 'rank_history table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rank_history')
UNION ALL
SELECT 'athlete_progress.custom_metrics', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name='athlete_progress' AND column_name='custom_metrics'
);
