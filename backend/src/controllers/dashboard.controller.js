// src/controllers/dashboard.controller.js
import { query } from "../utils/db.js";
import { ok, serverError } from "../utils/response.js";
import { athleteScopeSql, memberScopeSql, sessionScopeSql } from "../utils/access.js";

// ✅ نطاق المدرب: كل دالة تبني شرطها وتدفع معاملاتها في مصفوفة params الخاصة بالاستعلام
const sc = {
  member:  (req, a, p) => { const c = memberScopeSql(req.user, a, p);  return c ? ` AND ${c}` : ""; },
  athlete: (req, a, p) => { const c = athleteScopeSql(req.user, a, p); return c ? ` AND ${c}` : ""; },
  session: (req, a, p) => { const c = sessionScopeSql(req.user, a, p); return c ? ` AND ${c}` : ""; },
};

// ── GET /api/dashboard/overview ─────────────────────────────────
export const getOverview = async (req, res) => {
  try {
    const gymId = req.user.gym_id;

    const mP = [gymId];  const mS = sc.member(req, "u", mP);
    const sP = [gymId];  const sS = sc.athlete(req, "u", sP);
    const rP = [gymId];  const rS = sc.athlete(req, "u", rP);
    const seP = [gymId]; const seS = sc.session(req, "sessions", seP);
    const aP = [gymId];  const aS = sc.session(req, "s", aP) + sc.athlete(req, "ua", aP);

    const [members, subs, revenue, sessions, attendance, staff] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE u.role='athlete')                                   AS total_athletes,
          COUNT(*) FILTER (WHERE u.role='guardian')                                  AS total_guardians,
          COUNT(*) FILTER (WHERE u.role='athlete' AND u.created_at >= DATE_TRUNC('month', NOW())) AS new_this_month
        FROM users u WHERE u.gym_id=$1 AND u.is_active=TRUE${mS}`, mP),

      query(`
        SELECT
          COUNT(*) FILTER (WHERE s.status='active' AND s.end_date>=CURRENT_DATE)                                   AS active_count,
          COUNT(*) FILTER (WHERE s.status='active' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days') AS expiring_count,
          COUNT(*) FILTER (WHERE s.status='active' AND s.end_date<CURRENT_DATE)                                     AS overdue_count
        FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1${sS}`, sP),

      query(`
        SELECT
          COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at >= DATE_TRUNC('month', NOW())), 0) AS this_month,
          COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at >= CURRENT_DATE), 0)                AS today,
          COALESCE(SUM(s.price - COALESCE(pay.paid,0)) FILTER (WHERE s.status='active'), 0)  AS total_due
        FROM subscriptions s
        JOIN users u ON u.id=s.athlete_id
        LEFT JOIN payments p ON p.subscription_id=s.id AND p.status='paid'
        LEFT JOIN LATERAL (SELECT SUM(amount) AS paid FROM payments WHERE subscription_id=s.id AND status='paid') pay ON TRUE
        WHERE u.gym_id=$1${rS}`, rP),

      query(`
        SELECT
          COUNT(*) FILTER (WHERE session_date=CURRENT_DATE AND is_cancelled=FALSE)                       AS today_count,
          COUNT(*) FILTER (WHERE session_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days' AND is_cancelled=FALSE) AS week_count
        FROM sessions WHERE gym_id=$1${seS}`, seP),

      query(`
        SELECT
          COUNT(*) FILTER (WHERE a.status='present') AS present,
          COUNT(*) FILTER (WHERE a.status='absent')  AS absent,
          COUNT(*) FILTER (WHERE a.status='late')    AS late
        FROM attendance a
        JOIN sessions s ON s.id=a.session_id
        JOIN users ua ON ua.id=a.athlete_id
        WHERE s.gym_id=$1 AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'${aS}`, aP),

      query(`
        SELECT
          COUNT(*) FILTER (WHERE role='coach')     AS coaches,
          COUNT(*) FILTER (WHERE role='assistant') AS assistants
        FROM users WHERE gym_id=$1 AND is_active=TRUE`, [gymId]),
    ]);

    return ok(res, {
      members:    members.rows[0],
      subscriptions: subs.rows[0],
      revenue:    revenue.rows[0],
      sessions:   sessions.rows[0],
      attendance: attendance.rows[0],
      staff:      staff.rows[0],
    });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/revenue-chart?period=week|month|year ────
export const getRevenueChart = async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const gymId = req.user.gym_id;
    const rcP = [gymId]; const rcS = sc.athlete(req, "u", rcP);

    let rows;
    if (period === "week") {
      const r = await query(`
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS label,
               COALESCE(SUM(p.amount),0) AS value
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d(day)
        LEFT JOIN payments p ON p.paid_at::date = d.day AND p.status='paid'
          AND p.subscription_id IN (SELECT s.id FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1${rcS})
        GROUP BY d.day ORDER BY d.day`, rcP);
      rows = r.rows;
    } else if (period === "year") {
      const r = await query(`
        SELECT TO_CHAR(d.month, 'YYYY-MM') AS label,
               COALESCE(SUM(p.amount),0) AS value
        FROM generate_series(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months', DATE_TRUNC('month', CURRENT_DATE), INTERVAL '1 month') d(month)
        LEFT JOIN payments p ON DATE_TRUNC('month', p.paid_at) = d.month AND p.status='paid'
          AND p.subscription_id IN (SELECT s.id FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1${rcS})
        GROUP BY d.month ORDER BY d.month`, rcP);
      rows = r.rows;
    } else { // month
      const r = await query(`
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS label,
               COALESCE(SUM(p.amount),0) AS value
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d(day)
        LEFT JOIN payments p ON p.paid_at::date = d.day AND p.status='paid'
          AND p.subscription_id IN (SELECT s.id FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1${rcS})
        GROUP BY d.day ORDER BY d.day`, rcP);
      rows = r.rows;
    }

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/attendance-chart?period=week|month|year ─
export const getAttendanceChart = async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const gymId = req.user.gym_id;

    let interval, dateFormat, truncUnit;
    if (period === "week")  { interval = "6 days";   dateFormat = "YYYY-MM-DD"; truncUnit = "day"; }
    if (period === "month") { interval = "29 days";  dateFormat = "YYYY-MM-DD"; truncUnit = "day"; }
    if (period === "year")  { interval = "11 months";dateFormat = "YYYY-MM";    truncUnit = "month"; }

    const stepInterval = truncUnit === "month" ? "1 month" : "1 day";
    const acP = [gymId];
    const acSes = sc.session(req, "s", acP);
    const acAth = sc.athlete(req, "ua", acP);

    const { rows } = await query(`
      SELECT TO_CHAR(d.unit, '${dateFormat}') AS label,
             COUNT(a.id) FILTER (WHERE a.status='present') AS present,
             COUNT(a.id) FILTER (WHERE a.status='absent')  AS absent,
             COUNT(a.id) FILTER (WHERE a.status='late')    AS late
      FROM generate_series(
        DATE_TRUNC('${truncUnit}', CURRENT_DATE) - INTERVAL '${interval}',
        DATE_TRUNC('${truncUnit}', CURRENT_DATE),
        INTERVAL '${stepInterval}'
      ) d(unit)
      LEFT JOIN sessions s ON DATE_TRUNC('${truncUnit}', s.session_date) = d.unit AND s.gym_id = $1${acSes}
      LEFT JOIN attendance a ON a.session_id = s.id
        ${acAth ? `AND EXISTS (SELECT 1 FROM users ua WHERE ua.id = a.athlete_id${acAth})` : ""}
      GROUP BY d.unit ORDER BY d.unit
    `, acP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/members-growth?period=week|month|year ───
export const getMembersGrowth = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const gymId = req.user.gym_id;

    let interval, dateFormat, truncUnit;
    if (period === "week")  { interval = "6 days";   dateFormat = "YYYY-MM-DD"; truncUnit = "day"; }
    if (period === "month") { interval = "29 days";  dateFormat = "YYYY-MM-DD"; truncUnit = "day"; }
    if (period === "year")  { interval = "11 months";dateFormat = "YYYY-MM";    truncUnit = "month"; }

    const stepInterval = truncUnit === "month" ? "1 month" : "1 day";
    const gP = [gymId]; const gS = sc.athlete(req, "u", gP);

    const { rows } = await query(`
      SELECT TO_CHAR(d.unit, '${dateFormat}') AS label,
             COUNT(u.id) AS new_members
      FROM generate_series(
        DATE_TRUNC('${truncUnit}', CURRENT_DATE) - INTERVAL '${interval}',
        DATE_TRUNC('${truncUnit}', CURRENT_DATE),
        INTERVAL '${stepInterval}'
      ) d(unit)
      LEFT JOIN users u ON DATE_TRUNC('${truncUnit}', u.created_at) = d.unit
        AND u.gym_id = $1 AND u.role='athlete'${gS}
      GROUP BY d.unit ORDER BY d.unit
    `, gP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/top-coaches ──────────────────────────────
export const getTopCoaches = async (req, res) => {
  try {
    const tcScoped = sc.session(req, "s", [req.user.gym_id]) !== "";
    const { rows } = await query(`
      SELECT u.id, u.full_name,
             COUNT(DISTINCT s.id) AS sessions_count,
             COUNT(a.id) FILTER (WHERE a.status='present') AS total_attendance
      FROM users u
      JOIN sessions s ON s.coach_id = u.id AND s.is_cancelled=FALSE
      LEFT JOIN attendance a ON a.session_id = s.id
      WHERE u.gym_id = $1 AND u.role IN ('coach','assistant')
        AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.full_name
      ORDER BY sessions_count DESC
      LIMIT 5
    `, [req.user.gym_id]);
    // المدرب المقيَّد بنطاق لا يرى أداء زملائه
    return ok(res, tcScoped ? rows.filter(r => r.id === req.user.id) : rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/age-category-distribution ────────────────
export const getAgeCategoryDistribution = async (req, res) => {
  try {
    const dP = [req.user.gym_id]; const dS = sc.athlete(req, "u", dP);
    const { rows } = await query(`
      SELECT COALESCE(u.age_category::text, 'غير محدد') AS category, COUNT(*) AS count
      FROM users u WHERE u.gym_id=$1 AND u.role='athlete' AND u.is_active=TRUE${dS}
      GROUP BY u.age_category ORDER BY count DESC
    `, dP);
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/recent-activity ──────────────────────────
export const getRecentActivity = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const raP = [gymId];
    const raS1 = sc.athlete(req, "u", raP);
    const raS2 = sc.athlete(req, "u", raP);
    const raS3 = sc.athlete(req, "u", raP);

    const { rows } = await query(`
      (SELECT 'member' AS type, u.full_name AS title, u.created_at AS ts, NULL::text AS detail
       FROM users u WHERE u.gym_id=$1 AND u.role='athlete'${raS1} ORDER BY u.created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'payment' AS type, u.full_name AS title, p.paid_at AS ts, p.amount::text AS detail
       FROM payments p
       JOIN subscriptions s ON s.id=p.subscription_id
       JOIN users u ON u.id=s.athlete_id
       WHERE u.gym_id=$1 AND p.status='paid'${raS2} ORDER BY p.paid_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'subscription' AS type, u.full_name AS title, s.created_at AS ts, sp.name AS detail
       FROM subscriptions s
       JOIN users u ON u.id=s.athlete_id
       JOIN subscription_plans sp ON sp.id=s.plan_id
       WHERE u.gym_id=$1${raS3} ORDER BY s.created_at DESC LIMIT 5)
      ORDER BY ts DESC LIMIT 10
    `, raP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};