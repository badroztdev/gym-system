// src/controllers/push.controller.js — اختبار إشعارات الهاتف (ملف مستقل كي لا نمسّ notifications.controller.js)
import { query } from "../utils/db.js";
import { ok, serverError } from "../utils/response.js";
import { sendNotification } from "../services/fcm.service.js";

// ── POST /api/notifications/test ──────────────────────────────
// يرسل إشعاراً تجريبياً لأجهزة المستخدم الحالي ويُرجع التشخيص (كم جهازاً، وهل نجح الإرسال)
export const testPush = async (req, res) => {
  try {
    const tokens = await query(
      "SELECT token FROM user_fcm_tokens WHERE user_id = $1 AND is_active = TRUE",
      [req.user.id]
    );
    if (!tokens.rows.length) return ok(res, { devices: 0, sent: 0, errors: [] });
    const results = await Promise.all(tokens.rows.map(r => sendNotification({
      token: r.token,
      title: "SGMS 🔔",
      body: "هذا إشعار تجريبي — إذا ظهر في شريط هاتفك فكل شيء يعمل",
      data: { tag: "sgms-test" },
    })));
    return ok(res, {
      devices: results.length,
      sent: results.filter(r => r.success).length,
      errors: [...new Set(results.filter(r => !r.success).map(r => String(r.error)))],
    });
  } catch (err) { serverError(res, err); }
};
