// src/services/cron.service.js
// تشغيل المهام التلقائية يومياً بدون مكتبات خارجية
import { query } from "../utils/db.js";
import { sendMulticast, NotificationTemplates } from "./fcm.service.js";

// ── دالة إشعار انتهاء الاشتراكات ─────────────────────────────
async function notifyExpiringSubscriptions() {
  try {
    console.log("🔔 [Cron] Checking expiring subscriptions...");

    const subs = await query(
      `SELECT s.id, s.athlete_id, u.full_name AS athlete_name,
              u.gym_id, (s.end_date - CURRENT_DATE) AS days_left
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       WHERE s.status = 'active'
         AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'`
    );

    for (const sub of subs.rows) {
      const tpl = NotificationTemplates.subscriptionExpiring(sub.athlete_name, sub.days_left);

      // أولياء الأمور + الرياضي نفسه
      const ids = await query(
        `SELECT guardian_id AS id FROM guardian_athlete WHERE athlete_id = $1
         UNION SELECT $1::uuid`,
        [sub.athlete_id]
      );

      for (const { id } of ids.rows) {
        await query(
          `INSERT INTO notifications (user_id, title, body, type, metadata)
           VALUES ($1,$2,$3,'subscription_expiry',$4)
           ON CONFLICT DO NOTHING`,
          [id, tpl.title, tpl.body, JSON.stringify({ subscriptionId: sub.id, daysLeft: sub.days_left })]
        );
      }

      const tokens = await query(
        `SELECT token FROM user_fcm_tokens WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE`,
        [ids.rows.map(r => r.id)]
      );
      if (tokens.rows.length) {
        await sendMulticast({ tokens: tokens.rows.map(r => r.token), ...tpl });
      }
    }

    console.log(`✅ [Cron] Notified ${subs.rows.length} expiring subscriptions`);
  } catch (err) {
    console.error("❌ [Cron] notifyExpiring error:", err.message);
  }
}

// ── دالة تحديث حالة الاشتراكات المنتهية ──────────────────────
async function expireSubscriptions() {
  try {
    const { rowCount } = await query(
      `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND end_date < CURRENT_DATE`
    );
    if (rowCount > 0) {
      console.log(`✅ [Cron] Expired ${rowCount} subscriptions`);
    }
  } catch (err) {
    console.error("❌ [Cron] expireSubscriptions error:", err.message);
  }
}

// ── تشغيل المهام كل 24 ساعة ───────────────────────────────────
export function startCronJobs() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 ساعة

  // تشغيل فوري عند بدء الخادم
  expireSubscriptions();
  notifyExpiringSubscriptions();

  // جدولة يومية
  setInterval(async () => {
    await expireSubscriptions();
    await notifyExpiringSubscriptions();
  }, INTERVAL_MS);

  console.log("✅ [Cron] Daily jobs scheduled (every 24h)");
}