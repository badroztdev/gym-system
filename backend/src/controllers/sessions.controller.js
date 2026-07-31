// src/controllers/sessions.controller.js
import { query, transaction } from "../utils/db.js";
import { ok, created, noContent, notFound, badRequest, serverError } from "../utils/response.js";

function generateRecurringDates(startDate, endDate, days) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    if (days.includes(current.getDay())) {
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ── GET /api/sessions ──────────────────────────────────────────
export const getSessions = async (req, res) => {
  try {
    const { dateFrom, dateTo, coachId, roomId, categoryId, date } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["s.gym_id = $1", "s.is_cancelled = FALSE"];
    const params = [gymId];
    let p = 2;

    if (date) {
      conditions.push(`s.session_date = $${p}`); params.push(date); p++;
    } else {
      if (dateFrom) { conditions.push(`s.session_date >= $${p}`); params.push(dateFrom); p++; }
      if (dateTo)   { conditions.push(`s.session_date <= $${p}`); params.push(dateTo);   p++; }
    }
    if (coachId)    { conditions.push(`s.coach_id = $${p}`);    params.push(coachId);    p++; }
    if (roomId)     { conditions.push(`s.room_id = $${p}`);     params.push(roomId);     p++; }
    if (categoryId) { conditions.push(`s.category_id = $${p}`); params.push(categoryId); p++; }

    const { rows } = await query(
      `SELECT
         s.id, s.title, s.description, s.age_category,
         TO_CHAR(s.session_date, 'YYYY-MM-DD') AS session_date,
         s.start_time, s.end_time,
         s.capacity, s.is_recurring, s.recurrence_days, s.recurrence_end, s.is_cancelled,
         u.id AS coach_id, u.full_name AS coach_name,
         r.id AS room_id, r.name AS room_name,
         c.id AS category_id, c.name AS category_name, c.color AS category_color,
         (SELECT COUNT(*) FROM session_enrollments se
          WHERE se.session_id = s.id AND se.status = 'enrolled') AS enrolled_count,
         (SELECT COUNT(*) FROM attendance a
          WHERE a.session_id = s.id AND a.status = 'present') AS present_count
       FROM sessions s
       JOIN users u ON u.id = s.coach_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN sport_categories c ON c.id = s.category_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.session_date, s.start_time`,
      params
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/sessions/:id ──────────────────────────────────────
export const getSession = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, s.age_category,
              TO_CHAR(s.session_date, 'YYYY-MM-DD') AS session_date,
              u.full_name AS coach_name,
              r.name AS room_name, r.qr_code AS room_qr,
              c.name AS category_name, c.color AS category_color
       FROM sessions s
       JOIN users u ON u.id = s.coach_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN sport_categories c ON c.id = s.category_id
       WHERE s.id = $1 AND s.gym_id = $2`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الحصة غير موجودة");

    const attendance = await query(
      `SELECT a.id, a.status, a.scanned_at, a.scan_method,
              u.id AS athlete_id, u.full_name AS athlete_name, u.phone AS athlete_phone
       FROM attendance a
       JOIN users u ON u.id = a.athlete_id
       WHERE a.session_id = $1
       ORDER BY a.status, u.full_name`,
      [req.params.id]
    );

    return ok(res, { ...rows[0], attendance: attendance.rows });
  } catch (err) { serverError(res, err); }
};

// ── POST /api/sessions ─────────────────────────────────────────
export const createSession = async (req, res) => {
  try {
    const {
      title, description, sessionDate, startTime, endTime,
      capacity, coachId, roomId, categoryId, ageCategory,
      isRecurring, recurrenceDays, recurrenceEnd,
    } = req.body;

    const gymId = req.user.gym_id;

    const coach = await query(
      "SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role IN ('coach','assistant','owner')",
      [coachId, gymId]
    );
    if (!coach.rows.length) return badRequest(res, "المدرب غير موجود");

    if (!isRecurring) {
      const { rows } = await query(
        `INSERT INTO sessions
           (gym_id, coach_id, category_id, room_id, title, description,
            session_date, start_time, end_time, capacity, is_recurring, age_category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,$11)
         RETURNING *`,
        [gymId, coachId, categoryId || null, roomId || null, title, description || null,
         sessionDate, startTime, endTime, capacity || 20, ageCategory || null]
      );
      return created(res, rows[0]);
    }

    if (!recurrenceDays?.length) return badRequest(res, "أيام التكرار مطلوبة");
    if (!recurrenceEnd)           return badRequest(res, "تاريخ انتهاء التكرار مطلوب");

    const dates = generateRecurringDates(sessionDate, recurrenceEnd, recurrenceDays);
    if (!dates.length) return badRequest(res, "لا توجد تواريخ مطابقة للأيام المحددة");

    const insertedSessions = await transaction(async (client) => {
      const results = [];
      for (const d of dates) {
        const { rows } = await client.query(
          `INSERT INTO sessions
             (gym_id, coach_id, category_id, room_id, title, description,
              session_date, start_time, end_time, capacity,
              is_recurring, recurrence_days, recurrence_end, age_category)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,$12,$13)
           RETURNING id, session_date, title`,
          [gymId, coachId, categoryId || null, roomId || null, title, description || null,
           d, startTime, endTime, capacity || 20,
           recurrenceDays, recurrenceEnd, ageCategory || null]
        );
        results.push(rows[0]);
      }
      return results;
    });

    return created(res, {
      message: `تم إنشاء ${insertedSessions.length} حصة بنجاح`,
      sessions: insertedSessions,
    });
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/sessions/:id ────────────────────────────────────
export const updateSession = async (req, res) => {
  try {
    const {
      title, description, sessionDate, startTime, endTime,
      capacity, coachId, roomId, categoryId, ageCategory,
      isCancelled, cancelReason
    } = req.body;

    const { rows } = await query(
      `UPDATE sessions SET
         title        = COALESCE($1,  title),
         description  = COALESCE($2,  description),
         session_date = COALESCE($3,  session_date),
         start_time   = COALESCE($4,  start_time),
         end_time     = COALESCE($5,  end_time),
         capacity     = COALESCE($6,  capacity),
         coach_id     = COALESCE($7,  coach_id),
         room_id      = COALESCE($8,  room_id),
         category_id  = COALESCE($9,  category_id),
         age_category = COALESCE($10, age_category),
         is_cancelled = COALESCE($11, is_cancelled),
         cancel_reason= COALESCE($12, cancel_reason),
         updated_at   = NOW()
       WHERE id = $13 AND gym_id = $14
       RETURNING *`,
      [
        title       || null,
        description || null,
        sessionDate || null,
        startTime   || null,
        endTime     || null,
        capacity    || null,
        coachId     || null,
        roomId      || null,
        categoryId  || null,
        ageCategory || null,
        isCancelled ?? null,
        cancelReason || null,
        req.params.id, req.user.gym_id,
      ]
    );
    if (!rows.length) return notFound(res, "الحصة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/sessions/:id ───────────────────────────────────
export const cancelSession = async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE sessions SET is_cancelled = TRUE, cancel_reason = $1, updated_at = NOW()
       WHERE id = $2 AND gym_id = $3 RETURNING id`,
      [req.body.reason || "ألغيت من الإدارة", req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "الحصة غير موجودة");
    return noContent(res);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/sessions/today ────────────────────────────────────
export const getTodaySessions = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         s.id, s.title, s.age_category,
         TO_CHAR(s.session_date, 'YYYY-MM-DD') AS session_date,
         s.start_time, s.end_time,
         s.capacity, s.is_cancelled,
         u.full_name AS coach_name,
         r.name AS room_name,
         c.color AS category_color,
         (SELECT COUNT(*) FROM attendance a
          WHERE a.session_id = s.id AND a.status = 'present') AS present_count
       FROM sessions s
       JOIN users u ON u.id = s.coach_id
       LEFT JOIN rooms r ON r.id = s.room_id
       LEFT JOIN sport_categories c ON c.id = s.category_id
       WHERE s.gym_id = $1
         AND s.session_date = CURRENT_DATE
         AND s.is_cancelled = FALSE
       ORDER BY s.start_time`,
      [req.user.gym_id]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};