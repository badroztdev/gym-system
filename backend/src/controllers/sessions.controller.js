// src/controllers/sessions.controller.js
import { query, transaction } from "../utils/db.js";
import { ok, created, noContent, notFound, badRequest, serverError } from "../utils/response.js";
import { notifyCompetitionResult } from "./notifications.controller.js";

const SESSION_TYPES = ["training", "competition"];
const MEDALS = ["gold", "silver", "bronze"];

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
         s.session_type,
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
      capacity, coachId, roomId, categoryId, ageCategories,
      isRecurring, recurrenceDays, recurrenceEnd, sessionType,
    } = req.body;
    const type = SESSION_TYPES.includes(sessionType) ? sessionType : "training";

    const gymId = req.user.gym_id;
    const ageCats = Array.isArray(ageCategories) && ageCategories.length ? ageCategories : null;

    const coach = await query(
      "SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role IN ('coach','assistant','owner')",
      [coachId, gymId]
    );
    if (!coach.rows.length) return badRequest(res, "المدرب غير موجود");

    if (!isRecurring) {
      const { rows } = await query(
        `INSERT INTO sessions
           (gym_id, coach_id, category_id, room_id, title, description,
            session_date, start_time, end_time, capacity, is_recurring, age_category, session_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,$11,$12)
         RETURNING *`,
        [gymId, coachId, categoryId || null, roomId || null, title, description || null,
         sessionDate, startTime, endTime, capacity || 20, ageCats, type]
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
              is_recurring, recurrence_days, recurrence_end, age_category, session_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11,$12,$13,$14)
           RETURNING id, session_date, title`,
          [gymId, coachId, categoryId || null, roomId || null, title, description || null,
           d, startTime, endTime, capacity || 20,
           recurrenceDays, recurrenceEnd, ageCats, type]
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
      capacity, coachId, roomId, categoryId, ageCategories,
      isCancelled, cancelReason, sessionType
    } = req.body;

    const ageCats = ageCategories === undefined
      ? null
      : (Array.isArray(ageCategories) && ageCategories.length ? ageCategories : []);

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
         age_category = CASE WHEN $10::text[] IS NULL THEN age_category ELSE $10::text[] END,
         is_cancelled = COALESCE($11, is_cancelled),
         cancel_reason= COALESCE($12, cancel_reason),
         session_type = COALESCE($13, session_type),
         updated_at   = NOW()
       WHERE id = $14 AND gym_id = $15
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
        ageCats,
        isCancelled ?? null,
        cancelReason || null,
        SESSION_TYPES.includes(sessionType) ? sessionType : null,
        req.params.id, req.user.gym_id,
      ]
    );
    if (!rows.length) return notFound(res, "الحصة غير موجودة");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/sessions/:id  (إلغاء حصة واحدة فقط - soft) ──────
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

// ── DELETE /api/sessions/:id/series  (حذف نهائي لكل السلسلة المتكررة) ──
// ✅ جديد: يحذف نهائياً كل الحصص القادمة (من اليوم فصاعداً) التي تنتمي لنفس
// سلسلة التكرار (نفس العنوان، المدرب، الوقت، أيام التكرار، وتاريخ الانتهاء) —
// الحصص الماضية وسجلات حضورها التاريخية تبقى محفوظة كما هي دون أي تغيير
export const deleteRecurringSeries = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;

    const sessionRes = await query(
      `SELECT title, coach_id, room_id, category_id, start_time, end_time,
              recurrence_days, recurrence_end, is_recurring
       FROM sessions WHERE id = $1 AND gym_id = $2`,
      [id, gymId]
    );
    if (!sessionRes.rows.length) return notFound(res, "الحصة غير موجودة");
    const s = sessionRes.rows[0];

    // إذا لم تكن الحصة متكررة أصلاً، احذف هذه الحصة فقط نهائياً
    if (!s.is_recurring) {
      await transaction(async (client) => {
        await client.query("DELETE FROM session_results WHERE session_id = $1", [id]);
        await client.query("DELETE FROM attendance WHERE session_id = $1", [id]);
        await client.query("DELETE FROM session_enrollments WHERE session_id = $1", [id]);
        await client.query("DELETE FROM sessions WHERE id = $1", [id]);
      });
      return ok(res, { message: "تم حذف الحصة نهائياً", deletedCount: 1 });
    }

    // ✅ ابحث عن كل حصص نفس السلسلة القادمة فقط (من اليوم فصاعداً)
    const matching = await query(
      `SELECT id FROM sessions
       WHERE gym_id = $1 AND coach_id = $2 AND title = $3
         AND start_time = $4 AND end_time = $5
         AND recurrence_days = $6 AND recurrence_end = $7
         AND is_recurring = TRUE
         AND session_date >= CURRENT_DATE
         AND COALESCE(room_id::text,'')     = COALESCE($8::text,'')
         AND COALESCE(category_id::text,'') = COALESCE($9::text,'')`,
      [gymId, s.coach_id, s.title, s.start_time, s.end_time,
       s.recurrence_days, s.recurrence_end, s.room_id, s.category_id]
    );

    const ids = matching.rows.map(r => r.id);
    if (!ids.length) return notFound(res, "لا توجد حصص قادمة مطابقة لهذه السلسلة");

    await transaction(async (client) => {
      await client.query("DELETE FROM session_results WHERE session_id = ANY($1::uuid[])", [ids]);
      await client.query("DELETE FROM attendance WHERE session_id = ANY($1::uuid[])", [ids]);
      await client.query("DELETE FROM session_enrollments WHERE session_id = ANY($1::uuid[])", [ids]);
      await client.query("DELETE FROM sessions WHERE id = ANY($1::uuid[])", [ids]);
    });

    return ok(res, { message: `تم حذف ${ids.length} حصة نهائياً`, deletedCount: ids.length });
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
         s.capacity, s.is_cancelled, s.session_type,
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

// ── GET /api/sessions/:id/results ──────────────────────────────
// نتائج المنافسة + قائمة رياضيي الصالة النشطين لاختيارهم في القائمة المنسدلة
export const getSessionResults = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;

    const sessionRes = await query(
      "SELECT id FROM sessions WHERE id = $1 AND gym_id = $2",
      [id, gymId]
    );
    if (!sessionRes.rows.length) return notFound(res, "الحصة غير موجودة");

    const results = await query(
      `SELECT r.id, r.athlete_id, u.full_name AS athlete_name,
              r.specialty, r.result, r.rank_position, r.medal
       FROM session_results r
       JOIN users u ON u.id = r.athlete_id
       WHERE r.session_id = $1
       ORDER BY r.sort_order, r.created_at`,
      [id]
    );

    const athletes = await query(
      `SELECT id, full_name FROM users
       WHERE gym_id = $1 AND role = 'athlete' AND is_active = TRUE
       ORDER BY full_name`,
      [gymId]
    );

    return ok(res, { results: results.rows, athletes: athletes.rows });
  } catch (err) { serverError(res, err); }
};

// ── PUT /api/sessions/:id/results ──────────────────────────────
// يستبدل قائمة النتائج كاملةً داخل معاملة واحدة (إضافة/تعديل/حذف دفعة واحدة)
export const saveSessionResults = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;
    const list = req.body?.results;
    if (!Array.isArray(list)) return badRequest(res, "قائمة النتائج مطلوبة");
    if (list.length > 200)    return badRequest(res, "عدد النتائج كبير جداً");

    const sessionRes = await query(
      "SELECT id, title FROM sessions WHERE id = $1 AND gym_id = $2",
      [id, gymId]
    );
    if (!sessionRes.rows.length) return notFound(res, "الحصة غير موجودة");
    const sessionTitle = sessionRes.rows[0].title;

    const clean = [];
    for (const [i, r] of list.entries()) {
      if (!r?.athleteId) return badRequest(res, `الرياضي مطلوب في النتيجة رقم ${i + 1}`);
      const rank = r.rank === "" || r.rank == null ? null : Number(r.rank);
      if (rank !== null && (!Number.isInteger(rank) || rank < 1))
        return badRequest(res, `الترتيب غير صحيح في النتيجة رقم ${i + 1}`);
      const medal = r.medal ? String(r.medal) : null;
      if (medal && !MEDALS.includes(medal))
        return badRequest(res, `الميدالية غير صحيحة في النتيجة رقم ${i + 1}`);
      clean.push({
        athleteId: r.athleteId,
        specialty: (r.specialty || "").trim().slice(0, 150) || null,
        result:    (r.result || "").trim().slice(0, 150) || null,
        rank, medal,
      });
    }

    // كل الرياضيين يجب أن ينتموا لنفس الصالة
    if (clean.length) {
      const ids = [...new Set(clean.map(c => c.athleteId))];
      const valid = await query(
        "SELECT id FROM users WHERE id = ANY($1::uuid[]) AND gym_id = $2 AND role = 'athlete'",
        [ids, gymId]
      );
      if (valid.rows.length !== ids.length) return badRequest(res, "أحد الرياضيين غير موجود في هذه الصالة");
    }

    // النتائج السابقة — لمعرفة من تغيّرت نتيجته فنُشعره (دون تكرار إشعار نتيجة لم تتغير)
    const prevRes = await query(
      "SELECT athlete_id, specialty, result, rank_position, medal FROM session_results WHERE session_id = $1",
      [id]
    );
    const sig = (a) => [a.specialty || "", a.result || "", a.rank ?? "", a.medal || ""].join("|");
    const prevSigs = new Set(prevRes.rows.map(r =>
      `${r.athlete_id}#${sig({ specialty: r.specialty, result: r.result, rank: r.rank_position, medal: r.medal })}`));

    await transaction(async (client) => {
      await client.query("DELETE FROM session_results WHERE session_id = $1", [id]);
      for (const [i, c] of clean.entries()) {
        await client.query(
          `INSERT INTO session_results
             (session_id, athlete_id, specialty, result, rank_position, medal, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, c.athleteId, c.specialty, c.result, c.rank, c.medal, i]
        );
      }
    });

    // إشعار الرياضيين الذين أُضيفت/تغيّرت نتيجتهم (بعد نجاح الحفظ، ولا يُفشل الطلب إن تعذّر)
    const changed = new Map();
    for (const c of clean) {
      if (prevSigs.has(`${c.athleteId}#${sig(c)}`)) continue;
      if (!c.result && !c.rank && !c.medal) continue;
      if (!changed.has(c.athleteId)) changed.set(c.athleteId, []);
      changed.get(c.athleteId).push(c);
    }
    if (changed.size) {
      const names = await query(
        "SELECT id, full_name FROM users WHERE id = ANY($1::uuid[])", [[...changed.keys()]]
      );
      const nameOf = Object.fromEntries(names.rows.map(u => [u.id, u.full_name]));
      for (const [athleteId, items] of changed) {
        await notifyCompetitionResult({
          athleteId, athleteName: nameOf[athleteId] || "",
          sessionId: id, sessionTitle, results: items,
        });
      }
    }

    return ok(res, { message: "تم حفظ النتائج", count: clean.length, notified: changed.size });
  } catch (err) { serverError(res, err); }
};