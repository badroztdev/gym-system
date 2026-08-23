-- ============================================================
--  GYM MANAGEMENT SYSTEM — PostgreSQL Schema
--  Stack: Node.js + React + Flutter | DB: PostgreSQL
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'owner',
  'coach',
  'assistant',
  'athlete',
  'guardian'
);

CREATE TYPE subscription_status AS ENUM (
  'active',
  'expired',
  'suspended',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'cash',
  'card',
  'bank_transfer',
  'online'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'failed',
  'refunded'
);

CREATE TYPE attendance_status AS ENUM (
  'present',
  'absent',
  'late',
  'excused'
);

CREATE TYPE enrollment_status AS ENUM (
  'enrolled',
  'cancelled',
  'waitlisted'
);

CREATE TYPE notification_type AS ENUM (
  'attendance',
  'subscription_expiry',
  'payment',
  'session_reminder',
  'progress_update',
  'general'
);

CREATE TYPE notification_trigger AS ENUM (
  'on_absence',
  'on_late',
  'subscription_expiring_3days',
  'subscription_expiring_1day',
  'subscription_expired',
  'payment_received',
  'session_starting_soon',
  'progress_recorded'
);

CREATE TYPE media_type AS ENUM (
  'image',
  'video'
);

-- ============================================================
-- TABLE: gyms
-- ============================================================

CREATE TABLE gyms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(150) NOT NULL,
  address      TEXT,
  phone        VARCHAR(20),
  email        VARCHAR(150),
  logo_url     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  settings     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN gyms.settings IS 'Flexible gym config: currency, timezone, working_hours, etc.';

-- ============================================================
-- TABLE: users
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(20) NOT NULL,
  password_hash   TEXT,
  role            user_role NOT NULL,
  avatar_url      TEXT,
  date_of_birth   DATE,
  gender          VARCHAR(10),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_gym_unique UNIQUE (gym_id, email),
  CONSTRAINT users_phone_gym_unique UNIQUE (gym_id, phone)
);

CREATE INDEX idx_users_gym_id   ON users(gym_id);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_phone    ON users(phone);

-- ============================================================
-- TABLE: guardian_athlete  (many-to-many)
-- ============================================================

CREATE TABLE guardian_athlete (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guardian_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guardian_athlete_unique UNIQUE (guardian_id, athlete_id)
);

CREATE INDEX idx_guardian_athlete_guardian ON guardian_athlete(guardian_id);
CREATE INDEX idx_guardian_athlete_athlete  ON guardian_athlete(athlete_id);

-- ============================================================
-- TABLE: sport_categories
-- ============================================================

CREATE TABLE sport_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id     UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  icon       VARCHAR(50),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: subscription_plans
-- ============================================================

CREATE TABLE subscription_plans (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id           UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  duration_days    INT NOT NULL CHECK (duration_days > 0),
  price            NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  sessions_limit   INT,                         -- NULL = unlimited
  category_id      UUID REFERENCES sport_categories(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: subscriptions
-- ============================================================

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES subscription_plans(id),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  status              subscription_status NOT NULL DEFAULT 'active',
  sessions_remaining  INT,                       -- NULL = unlimited
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX idx_subscriptions_athlete ON subscriptions(athlete_id);
CREATE INDEX idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX idx_subscriptions_end     ON subscriptions(end_date);

-- ============================================================
-- TABLE: payments
-- ============================================================

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount           NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  method           payment_method NOT NULL DEFAULT 'cash',
  status           payment_status NOT NULL DEFAULT 'pending',
  reference        VARCHAR(100),                 -- external transaction ID
  notes            TEXT,
  recorded_by      UUID REFERENCES users(id),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_payments_status       ON payments(status);

-- ============================================================
-- TABLE: sessions  (scheduled classes)
-- ============================================================

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id        UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  coach_id      UUID NOT NULL REFERENCES users(id),
  category_id   UUID REFERENCES sport_categories(id) ON DELETE SET NULL,
  title         VARCHAR(150) NOT NULL,
  description   TEXT,
  session_date  DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  capacity      INT NOT NULL DEFAULT 20 CHECK (capacity > 0),
  room          VARCHAR(50),
  is_cancelled  BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_times_check CHECK (end_time > start_time)
);

CREATE INDEX idx_sessions_gym_id       ON sessions(gym_id);
CREATE INDEX idx_sessions_coach_id     ON sessions(coach_id);
CREATE INDEX idx_sessions_date         ON sessions(session_date);

-- ============================================================
-- TABLE: session_enrollments
-- ============================================================

CREATE TABLE session_enrollments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  athlete_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT enrollment_unique UNIQUE (session_id, athlete_id)
);

CREATE INDEX idx_enrollments_session ON session_enrollments(session_id);
CREATE INDEX idx_enrollments_athlete ON session_enrollments(athlete_id);

-- ============================================================
-- TABLE: attendance
-- ============================================================

CREATE TABLE attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  athlete_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        attendance_status NOT NULL DEFAULT 'absent',
  qr_token      TEXT UNIQUE,                     -- one-time QR per session per athlete
  qr_expires_at TIMESTAMPTZ,
  scanned_at    TIMESTAMPTZ,
  recorded_by   UUID REFERENCES users(id),       -- coach/assistant who recorded manually
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_unique UNIQUE (session_id, athlete_id)
);

CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_athlete ON attendance(athlete_id);
CREATE INDEX idx_attendance_status  ON attendance(status);

-- ============================================================
-- TABLE: athlete_progress
-- ============================================================

CREATE TABLE athlete_progress (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id          UUID REFERENCES users(id),
  record_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg         NUMERIC(5, 2),
  height_cm         NUMERIC(5, 2),
  body_fat_pct      NUMERIC(4, 2),
  performance_score INT CHECK (performance_score BETWEEN 1 AND 100),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_progress_athlete ON athlete_progress(athlete_id);
CREATE INDEX idx_progress_date    ON athlete_progress(record_date);

-- ============================================================
-- TABLE: progress_media
-- ============================================================

CREATE TABLE progress_media (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  progress_id  UUID NOT NULL REFERENCES athlete_progress(id) ON DELETE CASCADE,
  file_url     TEXT NOT NULL,
  media_type   media_type NOT NULL DEFAULT 'image',
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: notification_templates
-- ============================================================

CREATE TABLE notification_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trigger_event   notification_trigger NOT NULL,
  title_template  VARCHAR(200) NOT NULL,
  body_template   TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT template_gym_trigger_unique UNIQUE (gym_id, trigger_event)
);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  type       notification_type NOT NULL DEFAULT 'general',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSONB NOT NULL DEFAULT '{}',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user   ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- ============================================================
-- FUNCTION: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gyms_updated_at
  BEFORE UPDATE ON gyms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FUNCTION: auto-expire subscriptions
-- ============================================================

CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA — default gym + owner
-- ============================================================

INSERT INTO gyms (id, name, address, phone, email, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'نادي الفجر الرياضي',
  'شارع زيان عاشور، تلمسان',
  '+213550000000',
  'contact@alfajr-gym.dz',
  '{"currency": "DZD", "timezone": "Africa/Algiers", "session_qr_validity_minutes": 10}'
);

INSERT INTO users (id, gym_id, full_name, email, phone, password_hash, role)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'أحمد بن عمر',
  'admin@alfajr-gym.dz',
  '+213550000001',
  crypt('Admin@1234', gen_salt('bf')),
  'owner'
);

INSERT INTO sport_categories (gym_id, name, color) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'كرة القدم',    '#ef4444'),
  ('a0000000-0000-0000-0000-000000000001', 'كمال الأجسام', '#f97316'),
  ('a0000000-0000-0000-0000-000000000001', 'الفنون القتالية', '#8b5cf6'),
  ('a0000000-0000-0000-0000-000000000001', 'السباحة',      '#0ea5e9'),
  ('a0000000-0000-0000-0000-000000000001', 'الجمباز',      '#10b981');

