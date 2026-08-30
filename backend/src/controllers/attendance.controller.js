// src/controllers/attendance.controller.js
import { query } from "../utils/db.js";
import { ok, created, notFound, badRequest, serverError } from "../utils/response.js";
import { notifyAbsence } from "./notifications.controller.js";

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
      "SELECT id, gym_id, age_category FROM sessions WHERE id = $1 AND gym_id = $2",
      [sessionId, req.user.gym_id]
    );
    if (!sessionCheck.rows.length) return notFound(res, "الحصة غير موجودة");
    const session = sessionCheck.rows[0];

    // كل الرياضيين النشطين المؤهلين لهذه الحصة (بنفس فئتها العمرية، أو الجميع إذا لم تُحدَّد فئة)
    // مع حالة حضورهم إن وُجدت (LEFT JOIN)، وافتراضياً 'لم يُسجَّل بعد' إن لم توجد
    const conditions = ["u.gym_id = $1", "u.role = 'athlete'", "u.is_active = TRUE"];
    const params = [session.gym_id];
    let p = 2;

    if (session.age_category) {
      conditions.push(`u.age_category = $${p}`);
      params.push(session.age_category);
      p++;
    }

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

// ── GET /api/attendance/athlete/:athleteId ─────────────────────
export const getAthleteAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    const conditions = ["a.athlete_id = $1", "u.gym_id = $2"];
    const params = [req.params.athleteId, req.user.gym_id];
    let p = 3;

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