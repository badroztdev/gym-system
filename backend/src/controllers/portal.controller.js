// src/controllers/portal.controller.js
import { query } from "../utils/db.js";
import { ok, notFound, badRequest, serverError } from "../utils/response.js";

// ── GET /api/portal/my-athletes ────────────────────────────────
export const getMyAthletes = async (req, res) => {
  try {
    const user = req.user;

    if (user.role === "athlete") {
      return ok(res, [{
        id: user.id, full_name: user.full_name, phone: user.phone,
        avatar_url: user.avatar_url, age_category: user.age_category,
      }]);
    }

    if (user.role === "guardian") {
      const { rows } = await query(
        `SELECT u.id, u.full_name, u.phone, u.avatar_url, u.age_category, u.rank
         FROM guardian_athlete ga
         JOIN users u ON u.id = ga.athlete_id
         WHERE ga.guardian_id = $1 AND u.is_active = TRUE
         ORDER BY u.full_name`,
        [user.id]
      );
      return ok(res, rows);
    }

    return ok(res, []);
  } catch (err) { serverError(res, err); }
};

async function canAccessAthlete(user, athleteId) {
  if (user.role === "athlete") return user.id === athleteId;
  if (user.role === "guardian") {
    const check = await query(
      "SELECT 1 FROM guardian_athlete WHERE guardian_id = $1 AND athlete_id = $2",
      [user.id, athleteId]
    );
    return check.rows.length > 0;
  }
  return false;
}

// ── GET /api/portal/dashboard/:athleteId ───────────────────────
export const getDashboard = async (req, res) => {
  try {
    const { athleteId } = req.params;
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");

    const athleteRes = await query(
      `SELECT id, full_name, phone, avatar_url, age_category, rank,
              weight_kg, blood_group, date_of_birth, gym_id
       FROM users WHERE id = $1`,
      [athleteId]
    );
    if (!athleteRes.rows.length) return notFound(res, "الرياضي غير موجود");
    const athlete = athleteRes.rows[0];

    const subRes = await query(
      `SELECT s.id, s.start_date, s.end_date, s.status, s.sessions_remaining,
              sp.name AS plan_name, sp.sessions_limit, s.price,
              COALESCE((SELECT SUM(amount) FROM payments WHERE subscription_id=s.id AND status='paid'),0) AS total_paid
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.athlete_id = $1
       ORDER BY s.end_date DESC LIMIT 1`,
      [athleteId]
    );

    // ✅ إصلاح: استخدام توقيت الجزائر بدل توقيت الخادم الافتراضي
    const todaySessionsRes = await query(
      `SELECT s.id, s.title, s.start_time, s.end_time,
              r.name AS room_name, u.full_name AS coach_name,
              c.name AS category_name, c.color AS category_color,
              EXISTS(SELECT 1 FROM attendance a WHERE a.session_id=s.id AND a.athlete_id=$2 AND a.status='present') AS attended
       FROM sessions s
       JOIN users u ON u.id = s.coach_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN sport_categories c ON c.id = s.category_id
       WHERE s.gym_id = $1
         AND s.session_date = (NOW() AT TIME ZONE 'Africa/Algiers')::date
         AND s.is_cancelled = FALSE
         AND (s.age_category IS NULL OR array_length(s.age_category,1) IS NULL OR $3 = ANY(s.age_category))
       ORDER BY s.start_time`,
      [athlete.gym_id, athleteId, athlete.age_category]
    );

    const attStatsRes = await query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status='present') AS present,
         COUNT(*) FILTER (WHERE a.status='absent')  AS absent,
         COUNT(*) FILTER (WHERE a.status='late')     AS late
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       WHERE a.athlete_id = $1 AND s.session_date >= DATE_TRUNC('month', (NOW() AT TIME ZONE 'Africa/Algiers')::date)`,
      [athleteId]
    );

    const notifRes = await query(
      `SELECT id, title, body, type, is_read, sent_at
       FROM notifications WHERE user_id = $1
       ORDER BY sent_at DESC LIMIT 5`,
      [req.user.id]
    );

    return ok(res, {
      athlete,
      subscription: subRes.rows[0] || null,
      todaySessions: todaySessionsRes.rows,
      attendanceStats: attStatsRes.rows[0],
      recentNotifications: notifRes.rows,
    });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/portal/schedule/:athleteId ────────────────────────
export const getSchedule = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { dateFrom, dateTo } = req.query;
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");

    const athleteRes = await query("SELECT gym_id, age_category FROM users WHERE id = $1", [athleteId]);
    if (!athleteRes.rows.length) return notFound(res, "الرياضي غير موجود");
    const { gym_id, age_category } = athleteRes.rows[0];

    const { rows } = await query(
      `SELECT s.id, s.title, TO_CHAR(s.session_date,'YYYY-MM-DD') AS session_date,
              s.start_time, s.end_time, s.age_category,
              u.full_name AS coach_name, r.name AS room_name,
              c.name AS category_name, c.color AS category_color,
              EXISTS(SELECT 1 FROM attendance a WHERE a.session_id=s.id AND a.athlete_id=$4 AND a.status='present') AS attended
       FROM sessions s
       JOIN users u ON u.id = s.coach_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN sport_categories c ON c.id = s.category_id
       WHERE s.gym_id = $1 AND s.is_cancelled = FALSE
         AND s.session_date BETWEEN $2 AND $3
         AND (s.age_category IS NULL OR array_length(s.age_category,1) IS NULL OR $5 = ANY(s.age_category))
       ORDER BY s.session_date, s.start_time`,
      [gym_id, dateFrom, dateTo, athleteId, age_category]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/portal/attendance/:athleteId ──────────────────────
export const getAttendanceHistory = async (req, res) => {
  try {
    const { athleteId } = req.params;
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");

    const { rows } = await query(
      `SELECT a.status, a.scanned_at, a.scan_method,
              s.title, TO_CHAR(s.session_date,'YYYY-MM-DD') AS session_date,
              s.start_time, r.name AS room_name
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       LEFT JOIN rooms r ON r.id = s.room_id
       WHERE a.athlete_id = $1
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 30`,
      [athleteId]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/portal/subscription/:athleteId ────────────────────
export const getSubscriptionHistory = async (req, res) => {
  try {
    const { athleteId } = req.params;
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");

    const { rows } = await query(
      `SELECT s.id, s.start_date, s.end_date, s.status, s.sessions_remaining, s.price,
              sp.name AS plan_name, sp.sessions_limit,
              COALESCE((SELECT SUM(amount) FROM payments WHERE subscription_id=s.id AND status='paid'),0) AS total_paid
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.athlete_id = $1
       ORDER BY s.start_date DESC`,
      [athleteId]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/portal/scan ───────────────────────────────────────
export const scanAttendance = async (req, res) => {
  try {
    const { qrCode, athleteId } = req.body;
    if (!qrCode || !athleteId) return badRequest(res, "البيانات غير مكتملة");
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية تسجيل الحضور لهذا الرياضي");

    const roomRes = await query(
      "SELECT id, gym_id, name FROM rooms WHERE qr_code = $1 AND is_active = TRUE",
      [qrCode]
    );
    if (!roomRes.rows.length) return badRequest(res, "رمز QR غير صالح");
    const room = roomRes.rows[0];

    // ✅ إصلاح: استخدام توقيت الجزائر صراحة بدل توقيت خادم قاعدة البيانات
    const sessionRes = await query(
      `SELECT id, title FROM sessions
       WHERE room_id = $1
         AND session_date = (NOW() AT TIME ZONE 'Africa/Algiers')::date
         AND start_time <= (NOW() AT TIME ZONE 'Africa/Algiers')::time + INTERVAL '30 minutes'
         AND end_time   >= (NOW() AT TIME ZONE 'Africa/Algiers')::time - INTERVAL '30 minutes'
         AND is_cancelled = FALSE
       ORDER BY start_time LIMIT 1`,
      [room.id]
    );
    if (!sessionRes.rows.length)
      return badRequest(res, `لا توجد حصة جارية الآن في قاعة ${room.name}`);
    const session = sessionRes.rows[0];

    const { rows } = await query(
      `INSERT INTO attendance (session_id, athlete_id, status, scanned_at, room_id, scan_method)
       VALUES ($1,$2,'present',NOW(),$3,'qr_room')
       ON CONFLICT (session_id, athlete_id)
       DO UPDATE SET status='present', scanned_at=NOW(), room_id=$3, scan_method='qr_room'
       RETURNING *`,
      [session.id, athleteId, room.id]
    );

    return ok(res, {
      message: `✅ تم تسجيل حضورك في "${session.title}"`,
      attendance: rows[0],
      sessionTitle: session.title,
    });
  } catch (err) { serverError(res, err); }
};