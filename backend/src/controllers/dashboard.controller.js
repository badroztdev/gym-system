// src/controllers/dashboard.controller.js
import { query } from "../utils/db.js";
import { ok, serverError } from "../utils/response.js";

// ── GET /api/dashboard/overview ─────────────────────────────────
// بطاقات الإحصائيات الرئيسية (نظرة سريعة)
export const getOverview = async (req, res) => {
  try {
    const gymId = req.user.gym_id;

    const [members, subs, revenue, sessions, attendance, staff] = await Promise.all([
      // الأعضاء
      query(`
        SELECT
          COUNT(*) FILTER (WHERE role='athlete')                                   AS total_athletes,
          COUNT(*) FILTER (WHERE role='guardian')                                  AS total_guardians,
          COUNT(*) FILTER (WHERE role='athlete' AND created_at >= DATE_TRUNC('month', NOW())) AS new_this_month
        FROM users WHERE gym_id=$1 AND is_active=TRUE`, [gymId]),

      // الاشتراكات
      query(`
        SELECT
          COUNT(*) FILTER (WHERE s.status='active' AND s.end_date>=CURRENT_DATE)                                   AS active_count,
          COUNT(*) FILTER (WHERE s.status='active' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days') AS expiring_count,
          COUNT(*) FILTER (WHERE s.status='active' AND s.end_date<CURRENT_DATE)                                     AS overdue_count
        FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1`, [gymId]),

      // الإيرادات
      query(`
        SELECT
          COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at >= DATE_TRUNC('month', NOW())), 0) AS this_month,
          COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at >= CURRENT_DATE), 0)                AS today,
          COALESCE(SUM(s.price - COALESCE(pay.paid,0)) FILTER (WHERE s.status='active'), 0)  AS total_due
        FROM subscriptions s
        JOIN users u ON u.id=s.athlete_id
        LEFT JOIN payments p ON p.subscription_id=s.id AND p.status='paid'
        LEFT JOIN LATERAL (SELECT SUM(amount) AS paid FROM payments WHERE subscription_id=s.id AND status='paid') pay ON TRUE
        WHERE u.gym_id=$1`, [gymId]),

      // الحصص
      query(`
        SELECT
          COUNT(*) FILTER (WHERE session_date=CURRENT_DATE AND is_cancelled=FALSE)                       AS today_count,
          COUNT(*) FILTER (WHERE session_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days' AND is_cancelled=FALSE) AS week_count
        FROM sessions WHERE gym_id=$1`, [gymId]),

      // الحضور (آخر 30 يوم)
      query(`
        SELECT
          COUNT(*) FILTER (WHERE a.status='present') AS present,
          COUNT(*) FILTER (WHERE a.status='absent')  AS absent,
          COUNT(*) FILTER (WHERE a.status='late')    AS late
        FROM attendance a
        JOIN sessions s ON s.id=a.session_id
        WHERE s.gym_id=$1 AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'`, [gymId]),

      // الفريق
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

    let rows;
    if (period === "week") {
      const r = await query(`
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS label,
               COALESCE(SUM(p.amount),0) AS value
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d(day)
        LEFT JOIN payments p ON p.paid_at::date = d.day AND p.status='paid'
          AND p.subscription_id IN (SELECT id FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1)
        GROUP BY d.day ORDER BY d.day`, [gymId]);
      rows = r.rows;
    } else if (period === "year") {
      const r = await query(`
        SELECT TO_CHAR(d.month, 'YYYY-MM') AS label,
               COALESCE(SUM(p.amount),0) AS value
        FROM generate_series(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months', DATE_TRUNC('month', CURRENT_DATE), INTERVAL '1 month') d(month)
        LEFT JOIN payments p ON DATE_TRUNC('month', p.paid_at) = d.month AND p.status='paid'
          AND p.subscription_id IN (SELECT id FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1)
        GROUP BY d.month ORDER BY d.month`, [gymId]);
      rows = r.rows;
    } else { // month
      const r = await query(`
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS label,
               COALESCE(SUM(p.amount),0) AS value
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d(day)
        LEFT JOIN payments p ON p.paid_at::date = d.day AND p.status='paid'
          AND p.subscription_id IN (SELECT id FROM subscriptions s JOIN users u ON u.id=s.athlete_id WHERE u.gym_id=$1)
        GROUP BY d.day ORDER BY d.day`, [gymId]);
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
      LEFT JOIN sessions s ON DATE_TRUNC('${truncUnit}', s.session_date) = d.unit AND s.gym_id = $1
      LEFT JOIN attendance a ON a.session_id = s.id
      GROUP BY d.unit ORDER BY d.unit
    `, [gymId]);

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

    const { rows } = await query(`
      SELECT TO_CHAR(d.unit, '${dateFormat}') AS label,
             COUNT(u.id) AS new_members
      FROM generate_series(
        DATE_TRUNC('${truncUnit}', CURRENT_DATE) - INTERVAL '${interval}',
        DATE_TRUNC('${truncUnit}', CURRENT_DATE),
        INTERVAL '${stepInterval}'
      ) d(unit)
      LEFT JOIN users u ON DATE_TRUNC('${truncUnit}', u.created_at) = d.unit
        AND u.gym_id = $1 AND u.role='athlete'
      GROUP BY d.unit ORDER BY d.unit
    `, [gymId]);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/top-coaches ──────────────────────────────
// أفضل المدربين حسب عدد الحصص والحضور
export const getTopCoaches = async (req, res) => {
  try {
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
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/age-category-distribution ────────────────
// توزيع الرياضيين حسب الفئة العمرية (للرسم الدائري)
export const getAgeCategoryDistribution = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT COALESCE(age_category::text, 'غير محدد') AS category, COUNT(*) AS count
      FROM users WHERE gym_id=$1 AND role='athlete' AND is_active=TRUE
      GROUP BY age_category ORDER BY count DESC
    `, [req.user.gym_id]);
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/dashboard/recent-activity ──────────────────────────
// آخر الأنشطة (تسجيلات، دفعات، اشتراكات جديدة)
export const getRecentActivity = async (req, res) => {
  try {
    const gymId = req.user.gym_id;

    const { rows } = await query(`
      (SELECT 'member' AS type, full_name AS title, created_at AS ts, NULL::text AS detail
       FROM users WHERE gym_id=$1 AND role='athlete' ORDER BY created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'payment' AS type, u.full_name AS title, p.paid_at AS ts, p.amount::text AS detail
       FROM payments p
       JOIN subscriptions s ON s.id=p.subscription_id
       JOIN users u ON u.id=s.athlete_id
       WHERE u.gym_id=$1 AND p.status='paid' ORDER BY p.paid_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'subscription' AS type, u.full_name AS title, s.created_at AS ts, sp.name AS detail
       FROM subscriptions s
       JOIN users u ON u.id=s.athlete_id
       JOIN subscription_plans sp ON sp.id=s.plan_id
       WHERE u.gym_id=$1 ORDER BY s.created_at DESC LIMIT 5)
      ORDER BY ts DESC LIMIT 10
    `, [gymId]);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};