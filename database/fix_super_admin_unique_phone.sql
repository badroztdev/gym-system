-- ============================================================
--  منع تكرار رقم الهاتف لحسابات super_admin (التي gym_id = NULL)
--  القيد الأصلي (gym_id, phone) لا يمنع هذا لأن NULL يُعامل بشكل خاص
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_super_admin_phone
  ON users (phone)
  WHERE role = 'super_admin';

-- ============================================================
--  التحقق
-- ============================================================
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_unique_super_admin_phone';
