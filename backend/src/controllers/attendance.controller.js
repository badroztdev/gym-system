// src/controllers/attendance.controller.js
import { query, transaction } from "../utils/db.js";
import { ok, created, notFound, badRequest, serverError } from "../utils/response.js";
import { notifyAbsence } from "./notifications.controller.js";
import { athleteScopeSql, sessionScopeSql, sessionInScope, athleteInScope, athletesInScope } from "../utils/access.js";

// ── POST /api/attendance/scan ──────────────────────────────────
export const scanQR = async (req, res) => {
  try {
    const { qrCode, athleteId } = req.body;
    if (!qrCode)    return badRequest(res, "رمز QR مطلوب");
    if (!athleteId) return badRequest(res, "معرّف الرياضي مطلوب");

    const roomRes = await query(
      "SELECT id, gym_id, name FROM rooms WHERE qr_code = $1 AND is_active = TRUE",
      [qrCode]
    );
    if (!roomRes.rows.length) return badRequest(res, "رمز QR غير صالح أو القاعة معطّلة");
    const room = roomRes.rows[0];

    const athleteRes = await query(
      "SELECT id, full_name FROM users WHERE id = $1 AND gym_id = $2 AND is_active = TRUE",
      [athleteId, room.gym_id]
    );
    if (!athleteRes.rows.length) return badRequest(res, "الرياضي غير موجود في هذه الصالة");

    const sessionRes = await query(
      `SELECT s.id, s.title
       FROM sessions s
       WHERE s.room_id = $1
         AND s.session_date = (NOW() AT TIME ZONE 'Africa/Algiers')::date
         AND s.start_time <= (NOW() AT TIME ZONE 'Africa/Algiers')::time + INTERVAL '30 minutes'
         AND s.end_time   >= (NOW() AT TIME ZONE 'Africa/Algiers')::time - INTERVAL '30 minutes'
         AND s.is_cancelled = FALSE
       ORDER BY s.start_time
       LIMIT 1`,
      [room.id]
    );

    if (!sessionRes.rows.length) {
      return badRequest(res, `لا توجد حصة جارية الآن في قاعة ${room.name}`);
    }
    const session = sessionRes.rows[0];

    const { rows } = await query(
      `INSERT INTO attendance (session_id, athlete_id, status, scanned_at, room_id, scan_method)
       VALUES ($1, $2, 'present', NOW(), $3, 'qr_room')
       ON CONFLICT (session_id, athlete_id)
       DO UPDATE SET
         status      = 'present',
         scanned_at  = NOW(),
         room_id     = $3,
         scan_method = 'qr_room'
       RETURNING *`,
      [session.id, athleteId, room.id]
    );

    return ok(res, {
      message: `✅ تم تسجيل حضور ${athleteRes.rows[0].full_name} في حصة "${session.title}"`,
      attendance: rows[0],
      athlete: { id: athleteId, name: athleteRes.rows[0].full_name },
      session: { id: session.id, title: session.title },
      room: { id: room.id, name: room.name },
    });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/session/:sessionId ─────────────────────
// ✅ الإصلاح الجوهري: نعرض كل الرياضيين المؤهلين للحصة (حسب فئتها العمرية)
// حتى لو لم يُسجَّل حضورهم بعد — بدل الاعتماد فقط على سجلات attendance الموجودة
export const getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionCheck = await query(
      "SELECT id, gym_id, age_category, age_groups FROM sessions WHERE id = $1 AND gym_id = $2",
      [sessionId, req.user.gym_id]
    );
    if (sessionCheck.rows.length && !(await sessionInScope(req.user, sessionId)))
      return notFound(res, "الحصة غير موجودة");
    if (!sessionCheck.rows.length) return notFound(res, "الحصة غير موجودة");
    const session = sessionCheck.rows[0];

    // كل الرياضيين النشطين المؤهلين لهذه الحصة (بنفس فئتها العمرية، أو الجميع إذا لم تُحدَّد فئة)
    // مع حالة حضورهم إن وُجدت (LEFT JOIN)، وافتراضياً 'لم يُسجَّل بعد' إن لم توجد
    const conditions = ["u.gym_id = $1", "u.role = 'athlete'", "u.is_active = TRUE"];
    const params = [session.gym_id];
    let p = 2;

    if (Array.isArray(session.age_category) && session.age_category.length) {
      conditions.push(`u.age_category::text = ANY($${p}::text[])`);
      params.push(session.age_category);
      p++;

      // ✅ الأفواج: إن حُدّدت أفواج لفئة، يظهر فقط رياضيو هذه الأفواج (الفئات بلا أفواج تظهر كاملة)
      const ag = session.age_groups;
      if (ag && typeof ag === "object" && Object.keys(ag).length) {
        conditions.push(
          `(NOT ($${p}::jsonb ? u.age_category::text)
            OR jsonb_array_length($${p}::jsonb -> u.age_category::text) = 0
            OR ($${p}::jsonb -> u.age_category::text) ? u.group_name)`
        );
        params.push(JSON.stringify(ag));
        p++;
      }
    }

    // ✅ نطاق المدرب: يرى فقط رياضيي فئاته/أفواجه
    const rosterScope = athleteScopeSql(req.user, "u", params);
    if (rosterScope) conditions.push(rosterScope);
    p = params.length + 1;

    params.push(sessionId); // آخر معامل لربط attendance بالحصة الحالية تحديداً

    const { rows } = await query(
      `SELECT
         u.id AS athlete_id, u.full_name AS athlete_name,
         u.phone AS athlete_phone, u.age_category,
         a.id AS attendance_id, a.status, a.scanned_at, a.scan_method
       FROM users u
       LEFT JOIN attendance a ON a.athlete_id = u.id AND a.session_id = $${p}
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE WHEN a.status = 'present' THEN 0
              WHEN a.status = 'late'    THEN 1
              WHEN a.status IS NULL     THEN 2
              ELSE 3 END,
         u.full_name`,
      params
    );

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/attendance/manual ────────────────────────────────
export const manualAttendance = async (req, res) => {
  try {
    const { sessionId, athleteId, status, notes } = req.body;
    if (!sessionId || !athleteId || !status)
      return badRequest(res, "الحصة والرياضي والحالة مطلوبة");

    const validStatuses = ["present","absent","late","excused"];
    if (!validStatuses.includes(status))
      return badRequest(res, `الحالة يجب أن تكون: ${validStatuses.join(" | ")}`);

    if (!(await sessionInScope(req.user, sessionId)))
      return notFound(res, "الحصة غير موجودة");
    if (!(await athleteInScope(req.user, athleteId)))
      return badRequest(res, "هذا الرياضي خارج نطاق صلاحياتك");

    const { rows } = await query(
      `INSERT INTO attendance (session_id, athlete_id, status, recorded_by, notes, scan_method)
       VALUES ($1, $2, $3, $4, $5, 'manual')
       ON CONFLICT (session_id, athlete_id)
       DO UPDATE SET
         status      = $3,
         recorded_by = $4,
         notes       = $5,
         scan_method = 'manual'
       RETURNING *`,
      [sessionId, athleteId, status, req.user.id, notes || null]
    );

    if (status === "absent" || status === "late") {
      const info = await query(
        `SELECT u.full_name AS athlete_name, s.title AS session_title
         FROM users u, sessions s
         WHERE u.id = $1 AND s.id = $2`,
        [athleteId, sessionId]
      );
      if (info.rows.length) {
        notifyAbsence({
          athleteId,
          athleteName:  info.rows[0].athlete_name,
          sessionTitle: info.rows[0].session_title,
          status,
        });
      }
    }

    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/attendance/bulk ──────────────────────────────────
// حفظ حضور عدّة رياضيين دفعة واحدة (من نافذة تعديل الحصة).
// يُرسل الإشعار فقط لمن تغيّرت حالته إلى غائب/متأخر.
export const bulkAttendance = async (req, res) => {
  try {
    const { sessionId, records } = req.body;
    if (!sessionId || !Array.isArray(records))
      return badRequest(res, "الحصة وقائمة الحضور مطلوبتان");
    if (records.length > 500) return badRequest(res, "عدد السجلات كبير جداً");

    const validStatuses = ["present", "absent", "late", "excused"];
    for (const r of records) {
      if (!r?.athleteId || !validStatuses.includes(r.status))
        return badRequest(res, "بيانات الحضور غير صحيحة");
    }

    const sessionRes = await query(
      "SELECT id, title FROM sessions WHERE id = $1 AND gym_id = $2",
      [sessionId, req.user.gym_id]
    );
    if (!sessionRes.rows.length || !(await sessionInScope(req.user, sessionId)))
      return notFound(res, "الحصة غير موجودة");
    const sessionTitle = sessionRes.rows[0].title;

    if (!records.length) return ok(res, { saved: 0 });
    if (!(await athletesInScope(req.user, records.map(r => r.athleteId))))
      return badRequest(res, "أحد الرياضيين خارج نطاق صلاحياتك");

    const ids = [...new Set(records.map(r => r.athleteId))];
    const athletes = await query(
      "SELECT id, full_name FROM users WHERE id = ANY($1::uuid[]) AND gym_id = $2",
      [ids, req.user.gym_id]
    );
    if (athletes.rows.length !== ids.length)
      return badRequest(res, "أحد الرياضيين غير موجود في هذه الصالة");
    const names = Object.fromEntries(athletes.rows.map(a => [a.id, a.full_name]));

    const prev = await query(
      "SELECT athlete_id, status FROM attendance WHERE session_id = $1 AND athlete_id = ANY($2::uuid[])",
      [sessionId, ids]
    );
    const prevMap = Object.fromEntries(prev.rows.map(r => [r.athlete_id, r.status]));

    await transaction(async (client) => {
      for (const r of records) {
        await client.query(
          `INSERT INTO attendance (session_id, athlete_id, status, recorded_by, scan_method)
           VALUES ($1, $2, $3, $4, 'manual')
           ON CONFLICT (session_id, athlete_id)
           DO UPDATE SET status = $3, recorded_by = $4, scan_method = 'manual'`,
          [sessionId, r.athleteId, r.status, req.user.id]
        );
      }
    });

    for (const r of records) {
      if ((r.status === "absent" || r.status === "late") && prevMap[r.athleteId] !== r.status) {
        notifyAbsence({
          athleteId: r.athleteId,
          athleteName: names[r.athleteId],
          sessionTitle,
          status: r.status,
        });
      }
    }

    return ok(res, { saved: records.length });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/athlete/:athleteId ─────────────────────
export const getAthleteAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    const conditions = ["a.athlete_id = $1", "u.gym_id = $2"];
    const params = [req.params.athleteId, req.user.gym_id];
    const aScope = athleteScopeSql(req.user, "u", params);
    if (aScope) conditions.push(aScope);
    let p = params.length + 1;

    if (month && year) {
      conditions.push(`EXTRACT(MONTH FROM s.session_date) = $${p}`);
      params.push(month); p++;
      conditions.push(`EXTRACT(YEAR FROM s.session_date) = $${p}`);
      params.push(year); p++;
    }

    const { rows } = await query(
      `SELECT
         a.status, a.scanned_at, a.scan_method,
         s.id AS session_id, s.title, s.session_date, s.start_time, s.end_time,
         r.name AS room_name
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       JOIN users u ON u.id = a.athlete_id
       LEFT JOIN rooms r ON r.id = a.room_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 50`,
      params
    );

    const stats = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return ok(res, { records: rows, stats });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/overview ────────────────────────────────
// إحصائيات عامة شاملة لكل الحصص في الصالة (آخر 30 يوماً افتراضياً)
export const getAttendanceOverview = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const { dateFrom, dateTo } = req.query;

    const from = dateFrom || null;
    const to   = dateTo   || null;
    const oParams = [gymId, from, to];
    const oSes = sessionScopeSql(req.user, "s", oParams);
    const oAth = athleteScopeSql(req.user, "ua", oParams);

    const stats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status='present') AS present,
         COUNT(*) FILTER (WHERE a.status='absent')  AS absent,
         COUNT(*) FILTER (WHERE a.status='late')    AS late,
         COUNT(*) FILTER (WHERE a.status='excused') AS excused,
         COUNT(DISTINCT a.athlete_id)                AS unique_athletes,
         COUNT(DISTINCT s.id)                        AS total_sessions
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       JOIN users ua ON ua.id = a.athlete_id
       WHERE s.gym_id = $1
         AND s.session_date >= COALESCE($2::date, CURRENT_DATE - INTERVAL '30 days')
         AND s.session_date <= COALESCE($3::date, CURRENT_DATE)
         ${oSes ? "AND " + oSes : ""} ${oAth ? "AND " + oAth : ""}`,
      oParams
    );

    const row = stats.rows[0];
    const totalRecords = Number(row.present) + Number(row.absent) + Number(row.late) + Number(row.excused);
    const attendanceRate = totalRecords > 0
      ? Math.round((Number(row.present) / totalRecords) * 100)
      : 0;

    return ok(res, { ...row, attendanceRate });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/trend?period=week|month|year ────────────
// اتجاه الحضور عبر الزمن (نفس منطق dashboard.controller لكن مخصَّص لصفحة الحضور)
export const getAttendanceTrend = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const gymId = req.user.gym_id;

    let interval, dateFormat, truncUnit;
    if (period === "week")  { interval = "6 days";   dateFormat = "YYYY-MM-DD"; truncUnit = "day"; }
    if (period === "month") { interval = "29 days";  dateFormat = "YYYY-MM-DD"; truncUnit = "day"; }
    if (period === "year")  { interval = "11 months";dateFormat = "YYYY-MM";    truncUnit = "month"; }

    const stepInterval = truncUnit === "month" ? "1 month" : "1 day";
    const tP = [gymId];
    const tSes = sessionScopeSql(req.user, "s", tP);
    const tAth = athleteScopeSql(req.user, "ua", tP);

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
        ${tSes ? "AND " + tSes : ""}
      LEFT JOIN attendance a ON a.session_id = s.id
        ${tAth ? `AND EXISTS (SELECT 1 FROM users ua WHERE ua.id = a.athlete_id AND ${tAth})` : ""}
      GROUP BY d.unit ORDER BY d.unit
    `, tP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/leaderboard ──────────────────────────────
// ترتيب الرياضيين حسب نسبة الحضور (آخر 30 يوماً)
export const getAttendanceLeaderboard = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const { order = "best" } = req.query; // best | worst
    const lP = [gymId];
    const lAth = athleteScopeSql(req.user, "u", lP);
    const lSes = sessionScopeSql(req.user, "s", lP);

    const { rows } = await query(`
      SELECT
        u.id, u.full_name, u.age_category, u.group_name,
        COUNT(a.id) FILTER (WHERE a.status='present') AS present,
        COUNT(a.id) FILTER (WHERE a.status='absent')  AS absent,
        COUNT(a.id) FILTER (WHERE a.status='late')    AS late,
        COUNT(a.id)                                    AS total,
        CASE WHEN COUNT(a.id) > 0
          THEN ROUND(COUNT(a.id) FILTER (WHERE a.status='present')::numeric / COUNT(a.id) * 100)
          ELSE 0
        END AS rate
      FROM users u
      JOIN attendance a ON a.athlete_id = u.id
      JOIN sessions s ON s.id = a.session_id
      WHERE u.gym_id = $1 AND u.role='athlete' AND u.is_active=TRUE
        AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
        ${lAth ? "AND " + lAth : ""} ${lSes ? "AND " + lSes : ""}
      GROUP BY u.id, u.full_name, u.age_category, u.group_name
      HAVING COUNT(a.id) >= 1
      ORDER BY rate ${order === "worst" ? "ASC" : "DESC"}, total DESC
      LIMIT 10
    `, lP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/by-category ──────────────────────────────
// توزيع نسب الحضور حسب الفئة العمرية
export const getAttendanceByCategory = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const cP = [gymId];
    const cAth = athleteScopeSql(req.user, "u", cP);
    const cSes = sessionScopeSql(req.user, "s", cP);

    const { rows } = await query(`
      SELECT
        COALESCE(u.age_category::text, 'غير محدد') AS category,
        COUNT(a.id) FILTER (WHERE a.status='present') AS present,
        COUNT(a.id) AS total,
        CASE WHEN COUNT(a.id) > 0
          THEN ROUND(COUNT(a.id) FILTER (WHERE a.status='present')::numeric / COUNT(a.id) * 100)
          ELSE 0
        END AS rate
      FROM attendance a
      JOIN sessions s ON s.id = a.session_id
      JOIN users u ON u.id = a.athlete_id
      WHERE s.gym_id = $1
        AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
        ${cAth ? "AND " + cAth : ""} ${cSes ? "AND " + cSes : ""}
      GROUP BY u.age_category
      ORDER BY rate DESC
    `, cP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/attendance/recent-sessions ──────────────────────────
// آخر الحصص مع ملخص حضورها (للجدول السفلي في الصفحة)
export const getRecentSessionsAttendance = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const rP = [gymId];
    const rSes = sessionScopeSql(req.user, "s", rP);

    const { rows } = await query(`
      SELECT
        s.id, s.title, TO_CHAR(s.session_date,'YYYY-MM-DD') AS session_date,
        s.start_time, r.name AS room_name,
        COUNT(a.id) FILTER (WHERE a.status='present') AS present,
        COUNT(a.id) FILTER (WHERE a.status='absent')  AS absent,
        COUNT(a.id) FILTER (WHERE a.status='late')    AS late,
        COUNT(a.id)                                    AS total
      FROM sessions s
      LEFT JOIN rooms r ON r.id = s.room_id
      LEFT JOIN attendance a ON a.session_id = s.id
      WHERE s.gym_id = $1 AND s.is_cancelled = FALSE
        AND s.session_date <= CURRENT_DATE ${rSes ? "AND " + rSes : ""}
      GROUP BY s.id, s.title, s.session_date, s.start_time, r.name
      ORDER BY s.session_date DESC, s.start_time DESC
      LIMIT 15
    `, rP);

    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};