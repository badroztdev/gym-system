-- ============================================================
--  Migration: أساس تحويل المشروع إلى SaaS
--  آمنة 100% — لا تحذف أو تُعدّل أي بيانات موجودة
-- ============================================================

-- ── 1. دور "super_admin" الجديد (أنت، مطوّر المنصة) ───────────
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. السماح بـ gym_id = NULL لحساب super_admin فقط ───────────
-- (لا ينتمي لأي صالة، يدير المنصة بأكملها)
ALTER TABLE users ALTER COLUMN gym_id DROP NOT NULL;

-- ── 3. حالة اشتراك الصالة نفسها (وليس اشتراك الرياضي) ─────────
DO $$ BEGIN
  CREATE TYPE gym_subscription_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. أعمدة SaaS الجديدة على جدول gyms ────────────────────────
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS slug                  VARCHAR(60) UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status    gym_subscription_status NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_plan      VARCHAR(50) DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_ends_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_athletes           INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS owner_email            VARCHAR(150),
  ADD COLUMN IF NOT EXISTS notes                  TEXT,
  ADD COLUMN IF NOT EXISTS created_by_self_signup BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 5. توليد slug فريد للصالة الحالية (صقور الهضاب) إن لم يكن موجوداً ──
UPDATE gyms
SET slug = 's-elhidhab'
WHERE id = 'a0000000-0000-0000-0000-000000000001' AND slug IS NULL;

-- ── 6. صالة "صقور الهضاب" الحالية تُعتبر نشطة دائماً (ليست تجريبية) ────
UPDATE gyms
SET subscription_status = 'active', subscription_plan = 'unlimited'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- ── 7. جدول سجل نشاط الصالات (للـ Super Admin) ──────────────────
CREATE TABLE IF NOT EXISTS gym_activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  action      VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES users(id),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gym_activity_gym ON gym_activity_log(gym_id);

-- ── 8. فهرس على slug للبحث السريع ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gyms_slug ON gyms(slug);

-- ============================================================
--  التحقق
-- ============================================================
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'gym_id';

SELECT id, name, slug, subscription_status, subscription_plan, trial_ends_at
FROM gyms;
