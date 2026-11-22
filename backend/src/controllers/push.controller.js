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

    // تأخير اختياري (حتى 30 ثانية): الإشعار لا يظهر في شريط الهاتف والصفحة مفتوحة أمامك،
    // فنمنحك وقتاً لتخرج من الصفحة أو تقفل الشاشة قبل وصوله
    const delay = Math.min(30, Math.max(0, Number(req.body?.delay) || 0));
    const sendAll = () => Promise.all(tokens.rows.map(r => sendNotification({
      token: r.token,
      title: "SGMS 🔔",
      body: "هذا إشعار تجريبي — إذا ظهر في شريط هاتفك فكل شيء يعمل",
      data: { tag: "sgms-test" },
    })));

    if (delay > 0) {
      setTimeout(() => sendAll().then(rs => {
        const bad = rs.filter(r => !r.success);
        if (bad.length) console.error("❌ [push test] failed:", bad.map(b => b.error).join(" | "));
      }).catch(e => console.error("❌ [push test]:", e.message)), delay * 1000);
      return ok(res, { devices: tokens.rows.length, scheduled: delay, sent: tokens.rows.length, errors: [] });
    }
    const results = await sendAll();
    return ok(res, {
      devices: results.length,
      sent: results.filter(r => r.success).length,
      errors: [...new Set(results.filter(r => !r.success).map(r => String(r.error)))],
    });
  } catch (err) { serverError(res, err); }
};
