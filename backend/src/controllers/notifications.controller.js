// src/controllers/notifications.controller.js
import { query } from "../utils/db.js";
import { ok, noContent, badRequest, serverError } from "../utils/response.js";
import { sendMulticast, NotificationTemplates } from "../services/fcm.service.js";

// ── POST /api/notifications/token ─────────────────────────────
export const saveToken = async (req, res) => {
  try {
    const { token, platform = "web" } = req.body;
    if (!token) return badRequest(res, "FCM token مطلوب");
    await query(
      `INSERT INTO user_fcm_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id=$1, platform=$3, updated_at=NOW(), is_active=TRUE`,
      [req.user.id, token, platform]
    );
    return ok(res, { saved: true });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/notifications ────────────────────────────────────
export const getNotifications = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, body, type, is_read, metadata, sent_at
       FROM notifications WHERE user_id = $1
       ORDER BY sent_at DESC LIMIT 50`,
      [req.user.id]
    );
    return ok(res, rows, { meta: { unread: rows.filter(n => !n.is_read).length } });
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/notifications/:id/read ────────────────────────
export const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "all") {
      await query("UPDATE notifications SET is_read=TRUE WHERE user_id=$1", [req.user.id]);
    } else {
      await query("UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    }
    return noContent(res);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/notifications/send  (إرسال يدوي) ───────────────
export const sendManual = async (req, res) => {
  try {
    const { userIds, title, body, type = "general" } = req.body;
    if (!userIds?.length || !title || !body)
      return badRequest(res, "userIds والعنوان والنص مطلوبون");

    for (const uid of userIds) {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, metadata) VALUES ($1,$2,$3,$4,$5)`,
        [uid, title, body, type, JSON.stringify({ sentBy: req.user.id })]
      );
    }

    const tokensRes = await query(
      `SELECT ft.token FROM user_fcm_tokens ft
       JOIN users u ON u.id = ft.user_id
       WHERE ft.user_id = ANY($1::uuid[]) AND u.gym_id=$2 AND ft.is_active=TRUE`,
      [userIds, req.user.gym_id]
    );
    const result = await sendMulticast({ tokens: tokensRes.rows.map(r => r.token), title, body });
    return ok(res, { saved: userIds.length, pushed: result.sent });
  } catch (err) { serverError(res, err); }
};

// ── دالة داخلية: إشعار الغياب/التأخر ─────────────────────────
export const notifyAbsence = async ({ athleteId, athleteName, sessionTitle, status }) => {
  try {
    const template = status === "late"
      ? NotificationTemplates.late(athleteName, sessionTitle)
      : NotificationTemplates.absence(athleteName, sessionTitle);

    const guardiansRes = await query(
      `SELECT guardian_id AS id FROM guardian_athlete WHERE athlete_id=$1`,
      [athleteId]
    );
    if (!guardiansRes.rows.length) return;

    const gIds = guardiansRes.rows.map(r => r.id);
    for (const gId of gIds) {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, metadata) VALUES ($1,$2,$3,'attendance',$4)`,
        [gId, template.title, template.body, JSON.stringify({ athleteId, sessionTitle, status })]
      );
    }
    const tokens = await query(
      `SELECT token FROM user_fcm_tokens WHERE user_id=ANY($1::uuid[]) AND is_active=TRUE`,
      [gIds]
    );
    if (tokens.rows.length) await sendMulticast({ tokens: tokens.rows.map(r => r.token), ...template });
  } catch (err) { console.error("notifyAbsence:", err.message); }
};

// ── GET /api/notifications/notify-expiring (Cron يومي) ────────
export const notifyExpiringSubscriptions = async (req, res) => {
  try {
    const subs = await query(
      `SELECT s.id, s.athlete_id, u.full_name AS athlete_name,
              (s.end_date - CURRENT_DATE) AS days_left
       FROM subscriptions s JOIN users u ON u.id=s.athlete_id
       WHERE s.status='active'
         AND s.end_date BETWEEN CURRENT_DATE+INTERVAL '1 day' AND CURRENT_DATE+INTERVAL '3 days'
         AND u.gym_id=$1`,
      [req.user.gym_id]
    );
    let notified = 0;
    for (const sub of subs.rows) {
      const tpl = NotificationTemplates.subscriptionExpiring(sub.athlete_name, sub.days_left);
      const gRes = await query(
        `SELECT guardian_id AS id FROM guardian_athlete WHERE athlete_id=$1 UNION SELECT $1`,
        [sub.athlete_id]
      );
      const ids = gRes.rows.map(r => r.id);
      for (const id of ids) {
        await query(
          `INSERT INTO notifications (user_id,title,body,type,metadata) VALUES ($1,$2,$3,'subscription_expiry',$4)`,
          [id, tpl.title, tpl.body, JSON.stringify({ subscriptionId: sub.id, daysLeft: sub.days_left })]
        );
      }
      const tokens = await query(`SELECT token FROM user_fcm_tokens WHERE user_id=ANY($1::uuid[]) AND is_active=TRUE`, [ids]);
      if (tokens.rows.length) await sendMulticast({ tokens: tokens.rows.map(r => r.token), ...tpl });
      notified++;
    }
    return ok(res, { notified });
  } catch (err) { serverError(res, err); }
};