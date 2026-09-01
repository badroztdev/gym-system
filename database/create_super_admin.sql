-- ============================================================
--  إنشاء حساب Super Admin (أنت — مطوّر المنصة)
--  ملف UTF-8 نظيف، يُشغَّل عبر psql -f مباشرة (بدون نسخ/لصق في PowerShell)
--  غيّر كلمة المرور فوراً بعد أول تسجيل دخول
-- ============================================================

INSERT INTO users (id, gym_id, full_name, phone, email, password_hash, role)
VALUES (
  gen_random_uuid(),
  NULL,
  'Platform Admin',
  '+213550000001',
  'sokourelhidabkungfu@gmail.com',
  '$2b$10$k0YAWxRR9zegD.ulyLUbg./GKCSaByigDOzuo/vyt7ehm.ofD2MWK',
  'super_admin'
)
ON CONFLICT DO NOTHING;

-- ============================================================
--  التحقق (بدون full_name العربي لتفادي مشاكل ترميز PowerShell)
-- ============================================================
SELECT id, phone, role FROM users WHERE role = 'super_admin';