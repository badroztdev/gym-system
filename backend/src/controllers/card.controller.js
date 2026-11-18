// src/controllers/card.controller.js — مسح بطاقة الرياضي (QR)
import { query } from "../utils/db.js";
import { ok, badRequest, notFound, forbidden, serverError } from "../utils/response.js";
import { hasPermission, memberInScope } from "../utils/access.js";

const PREFIX = "SGMS-A:";

// ── POST /api/attendance/card-scan  { code, record?: boolean } ─
// يعيد: green (اشتراك ساري ومدفوع بالكامل) | red (غير مدفوع كلياً أو لا اشتراك)
export const cardScan = async (req, res) => {
  try {
    const raw = String(req.body.code || "").trim();
    const id  = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length).trim() : "";
    if (!/^[0-9a-fA-F-]{8,40}$/.test(id)) return badRequest(res, "رمز غير صالح");

    const gymId = req.user.gym_id || req.user.gymId;
    const a = await query(
      `SELECT id, full_name, avatar_url, age_category, group_name, is_active, role
         FROM users WHERE id::text = $1 AND gym_id = $2 AND role = 'athlete'
          AND (phone IS NULL OR phone <> '__visitor__')`,
      [id, gymId]
    );
    if (!a.rows.length) return notFound(res, "الرياضي غير موجود في هذا النادي");
    const ath = a.rows[0];
    if (!(await memberInScope(req.user, ath.id))) return forbidden(res, "خارج نطاق صلاحياتك");

    // الاشتراكات السارية حالياً (غير الزوار)
    const subs = await query(
      `SELECT s.id, s.price, s.start_date, s.end_date, p.name AS plan_name,
              COALESCE((SELECT SUM(amount) FROM payments WHERE subscription_id = s.id AND status = 'paid'), 0) AS paid
         FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
        WHERE s.athlete_id = $1 AND s.status = 'active' AND s.visitor_name IS NULL
          AND s.start_date <= CURRENT_DATE AND s.end_date >= CURRENT_DATE
        ORDER BY s.end_date DESC`,
      [ath.id]
    );

    let state = "none", remaining = 0, plan = null, endDate = null;
    if (subs.rows.length) {
      remaining = subs.rows.reduce((n, r) => n + Math.max(0, Number(r.price) - Number(r.paid)), 0);
      plan = subs.rows[0].plan_name; endDate = subs.rows[0].end_date;
      state = remaining <= 0.009 ? "paid" : "unpaid";
    }
    if (!ath.is_active) state = "inactive";
    const green = state === "paid";

    const canMoney = hasPermission(req.user, "payments.view") || hasPermission(req.user, "payments.add") || hasPermission(req.user, "subscriptions.add");

    // تسجيل الحضور (فقط لمن يملك attendance.manage)
    let attendance = { done: false, reason: null, session: null };
    if (req.body.record !== false && hasPermission(req.user, "attendance.manage")) {
      const ss = await query(
        `SELECT s.id, s.title, s.start_time, s.end_time
           FROM sessions s
          WHERE s.gym_id = $1 AND s.is_cancelled = FALSE
            AND s.session_date = (NOW() AT TIME ZONE 'Africa/Algiers')::date
            AND s.start_time <= (NOW() AT TIME ZONE 'Africa/Algiers')::time + INTERVAL '30 minutes'
            AND s.end_time   >= (NOW() AT TIME ZONE 'Africa/Algiers')::time - INTERVAL '30 minutes'
            AND (s.age_category IS NULL OR cardinality(s.age_category) = 0 OR COALESCE($2::text,'') = ANY(s.age_category))
            AND (s.age_groups IS NULL
                 OR NOT (s.age_groups ? COALESCE($2::text,''))
                 OR jsonb_array_length(s.age_groups -> COALESCE($2::text,'')) = 0
                 OR (s.age_groups -> COALESCE($2::text,'')) ? COALESCE($3::text,''))
          ORDER BY ABS(EXTRACT(EPOCH FROM (s.start_time - (NOW() AT TIME ZONE 'Africa/Algiers')::time)))
          LIMIT 1`,
        [gymId, ath.age_category, ath.group_name]
      );
      if (!ss.rows.length) attendance.reason = "no_session";
      else {
        const s = ss.rows[0];
        await query(
          `INSERT INTO attendance (session_id, athlete_id, status, scanned_at, scan_method, recorded_by)
           VALUES ($1, $2, 'present', NOW(), 'qr_card', $3)
           ON CONFLICT (session_id, athlete_id)
           DO UPDATE SET status = 'present', scanned_at = NOW(), scan_method = 'qr_card', recorded_by = $3`,
          [s.id, ath.id, req.user.id]
        );
        attendance = { done: true, reason: null, session: { id: s.id, title: s.title } };
      }
    } else if (req.body.record !== false) attendance.reason = "no_permission";

    return ok(res, {
      color: green ? "green" : "red",
      state,                                   // paid | unpaid | none | inactive
      athlete: { id: ath.id, name: ath.full_name, avatar: ath.avatar_url, category: ath.age_category, group: ath.group_name },
      plan, endDate,
      remaining: canMoney ? remaining : undefined,
      attendance,
    });
  } catch (err) { serverError(res, err); }
};
