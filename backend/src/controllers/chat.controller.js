// src/controllers/chat.controller.js
// رسائل بين الرياضي/ولي الأمر (البوابة) والمدرب (لوحة التحكم)
import { query, transaction } from "../utils/db.js";
import { ok, created, notFound, badRequest, serverError } from "../utils/response.js";
import { sendMulticast } from "../services/fcm.service.js";

const MAX_LEN = 2000;

// ── مساعدات ────────────────────────────────────────────────────
async function canAccessAthlete(user, athleteId) {
  if (user.role === "athlete") return user.id === athleteId;
  if (user.role === "guardian") {
    const r = await query(
      "SELECT 1 FROM guardian_athlete WHERE guardian_id = $1 AND athlete_id = $2",
      [user.id, athleteId]
    );
    return r.rows.length > 0;
  }
  return false;
}

// الرياضيون الذين يحق لمستخدم البوابة مراسلة المدرب باسمهم
async function accessibleAthleteIds(user) {
  if (user.role === "athlete") return [user.id];
  if (user.role === "guardian") {
    const r = await query("SELECT athlete_id FROM guardian_athlete WHERE guardian_id = $1", [user.id]);
    return r.rows.map(x => x.athlete_id);
  }
  return [];
}

// من يستطيع الرياضي مراسلته: مدربو حصصه (حسب الفئة العمرية أو الحضور أو التسجيل) + المالك
async function allowedRecipients(athlete) {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.role
     FROM users u
     WHERE u.gym_id = $1 AND u.is_active = TRUE
       AND u.role IN ('coach','assistant','owner')
       AND (
         u.role = 'owner'
         OR EXISTS (
           SELECT 1 FROM sessions s
           WHERE s.coach_id = u.id AND s.is_cancelled = FALSE
             AND (
               ($2::text IS NOT NULL AND $2::text = ANY(s.age_category))
               OR EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id AND a.athlete_id = $3)
               OR EXISTS (SELECT 1 FROM session_enrollments se WHERE se.session_id = s.id AND se.athlete_id = $3)
             )
         )
       )
     ORDER BY (u.role = 'owner'), u.full_name`,
    [athlete.gym_id, athlete.age_category, athlete.id]
  );
  return rows;
}

async function loadAthlete(id) {
  const r = await query(
    "SELECT id, gym_id, full_name, age_category::text AS age_category FROM users WHERE id = $1 AND role = 'athlete'",
    [id]
  );
  return r.rows[0] || null;
}

const cleanBody = (v) => (typeof v === "string" ? v.trim() : "");
const preview = (s) => (s.length > 120 ? s.slice(0, 117) + "…" : s);

// إشعار داخل التطبيق + Push — لا يُفشل الطلب أبداً
async function notifyUsers(userIds, title, body, metadata) {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return;
    for (const id of ids) {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, metadata) VALUES ($1,$2,$3,'general',$4)`,
        [id, title, body, JSON.stringify({ kind: "chat", ...metadata })]
      );
    }
    const tokens = await query(
      `SELECT token FROM user_fcm_tokens WHERE user_id = ANY($1::uuid[]) AND is_active = TRUE`,
      [ids]
    );
    if (tokens.rows.length) await sendMulticast({ tokens: tokens.rows.map(r => r.token), title, body });
  } catch (err) { console.error("chat notify:", err.message); }
}

const MESSAGES_SQL = `
  SELECT * FROM (
    SELECT m.id, m.sender_id, m.sender_side, m.body, m.created_at,
           u.full_name AS sender_name, u.role AS sender_role
    FROM chat_messages m JOIN users u ON u.id = m.sender_id
    WHERE m.thread_id = $1
    ORDER BY m.created_at DESC LIMIT 300
  ) x ORDER BY created_at ASC`;

// ════════════════════════════════════════════════════════════
//  البوابة (رياضي / ولي أمر)
// ════════════════════════════════════════════════════════════

// GET /api/portal/chat/:athleteId/recipients
export const getPortalRecipients = async (req, res) => {
  try {
    const { athleteId } = req.params;
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");
    const athlete = await loadAthlete(athleteId);
    if (!athlete) return notFound(res, "الرياضي غير موجود");
    return ok(res, await allowedRecipients(athlete));
  } catch (err) { serverError(res, err); }
};

// GET /api/portal/chat/:athleteId/threads
export const getPortalThreads = async (req, res) => {
  try {
    const { athleteId } = req.params;
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");
    const { rows } = await query(
      `SELECT t.id, t.staff_id, st.full_name AS staff_name, st.role AS staff_role,
              t.last_message_at, t.last_message_preview,
              (SELECT COUNT(*)::int FROM chat_messages m
               WHERE m.thread_id = t.id AND m.sender_side = 'staff' AND m.read_at IS NULL) AS unread
       FROM chat_threads t JOIN users st ON st.id = t.staff_id
       WHERE t.athlete_id = $1
       ORDER BY t.last_message_at DESC`,
      [athleteId]
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// GET /api/portal/chat/unread
export const getPortalUnread = async (req, res) => {
  try {
    const ids = await accessibleAthleteIds(req.user);
    if (!ids.length) return ok(res, { count: 0 });
    const r = await query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
       WHERE t.athlete_id = ANY($1::uuid[]) AND m.sender_side = 'staff' AND m.read_at IS NULL`,
      [ids]
    );
    return ok(res, { count: r.rows[0].count });
  } catch (err) { serverError(res, err); }
};

// GET /api/portal/chat/threads/:threadId/messages
export const getPortalMessages = async (req, res) => {
  try {
    const t = await query("SELECT id, athlete_id FROM chat_threads WHERE id = $1", [req.params.threadId]);
    if (!t.rows.length) return notFound(res, "المحادثة غير موجودة");
    if (!(await canAccessAthlete(req.user, t.rows[0].athlete_id)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذه المحادثة");

    await query(
      "UPDATE chat_messages SET read_at = NOW() WHERE thread_id = $1 AND sender_side = 'staff' AND read_at IS NULL",
      [t.rows[0].id]
    );
    const { rows } = await query(MESSAGES_SQL, [t.rows[0].id]);
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// POST /api/portal/chat/:athleteId/messages   { staffId, body }
export const sendPortalMessage = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const staffId = req.body.staffId;
    const body = cleanBody(req.body.body);
    if (!body) return badRequest(res, "نص الرسالة مطلوب");
    if (body.length > MAX_LEN) return badRequest(res, `الرسالة طويلة جداً (الحد ${MAX_LEN} حرف)`);
    if (!staffId) return badRequest(res, "المستلم مطلوب");
    if (!(await canAccessAthlete(req.user, athleteId)))
      return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");

    const athlete = await loadAthlete(athleteId);
    if (!athlete) return notFound(res, "الرياضي غير موجود");

    const existing = await query(
      "SELECT id FROM chat_threads WHERE athlete_id = $1 AND staff_id = $2",
      [athleteId, staffId]
    );
    if (!existing.rows.length) {
      const allowed = await allowedRecipients(athlete);
      if (!allowed.some(r => r.id === staffId)) return badRequest(res, "لا يمكنك مراسلة هذا الشخص");
    }

    const result = await transaction(async (client) => {
      const th = await client.query(
        `INSERT INTO chat_threads (gym_id, athlete_id, staff_id, last_message_at, last_message_preview)
         VALUES ($1,$2,$3,NOW(),$4)
         ON CONFLICT (athlete_id, staff_id)
         DO UPDATE SET last_message_at = NOW(), last_message_preview = $4
         RETURNING id`,
        [athlete.gym_id, athleteId, staffId, preview(body)]
      );
      const msg = await client.query(
        `INSERT INTO chat_messages (thread_id, sender_id, sender_side, body)
         VALUES ($1,$2,'portal',$3) RETURNING id, sender_id, sender_side, body, created_at`,
        [th.rows[0].id, req.user.id, body]
      );
      return { threadId: th.rows[0].id, message: msg.rows[0] };
    });

    notifyUsers([staffId], `💬 رسالة من ${athlete.full_name}`, preview(body),
      { threadId: result.threadId, athleteId });

    return created(res, { thread_id: result.threadId, message: result.message });
  } catch (err) { serverError(res, err); }
};

// ════════════════════════════════════════════════════════════
//  لوحة التحكم (مدرب / مساعد / مالك)
//  المالك يرى كل محادثات الصالة، والمدرب يرى المحادثات الموجّهة إليه فقط
// ════════════════════════════════════════════════════════════
const isOwner = (u) => u.role === "owner";

async function loadStaffThread(req) {
  const r = await query(
    "SELECT id, athlete_id, staff_id, gym_id FROM chat_threads WHERE id = $1 AND gym_id = $2",
    [req.params.threadId, req.user.gym_id]
  );
  const t = r.rows[0];
  if (!t) return null;
  if (!isOwner(req.user) && t.staff_id !== req.user.id) return null;
  return t;
}

// GET /api/chat/threads?search=
export const getStaffThreads = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const params = [req.user.gym_id, req.user.id, isOwner(req.user)];
    let where = "t.gym_id = $1 AND ($3::boolean OR t.staff_id = $2)";
    if (search) { params.push(`%${search}%`); where += ` AND a.full_name ILIKE $${params.length}`; }

    const { rows } = await query(
      `SELECT t.id, t.athlete_id, a.full_name AS athlete_name, a.age_category::text AS age_category,
              t.staff_id, st.full_name AS staff_name,
              t.last_message_at, t.last_message_preview,
              CASE WHEN t.staff_id = $2 THEN
                (SELECT COUNT(*)::int FROM chat_messages m
                 WHERE m.thread_id = t.id AND m.sender_side = 'portal' AND m.read_at IS NULL)
              ELSE 0 END AS unread
       FROM chat_threads t
       JOIN users a  ON a.id  = t.athlete_id
       JOIN users st ON st.id = t.staff_id
       WHERE ${where}
       ORDER BY t.last_message_at DESC
       LIMIT 100`,
      params
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// GET /api/chat/unread
export const getStaffUnread = async (req, res) => {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
       WHERE t.gym_id = $1 AND t.staff_id = $2 AND m.sender_side = 'portal' AND m.read_at IS NULL`,
      [req.user.gym_id, req.user.id]
    );
    return ok(res, { count: r.rows[0].count });
  } catch (err) { serverError(res, err); }
};

// GET /api/chat/threads/:threadId/messages
export const getStaffMessages = async (req, res) => {
  try {
    const t = await loadStaffThread(req);
    if (!t) return notFound(res, "المحادثة غير موجودة");
    // القراءة تُحتسب فقط لصاحب المحادثة — اطّلاع المالك على محادثة مدرب لا يمسح تنبيه المدرب
    if (t.staff_id === req.user.id) {
      await query(
        "UPDATE chat_messages SET read_at = NOW() WHERE thread_id = $1 AND sender_side = 'portal' AND read_at IS NULL",
        [t.id]
      );
    }
    const { rows } = await query(MESSAGES_SQL, [t.id]);
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// POST /api/chat/threads/:threadId/messages   { body }
export const sendStaffMessage = async (req, res) => {
  try {
    const body = cleanBody(req.body.body);
    if (!body) return badRequest(res, "نص الرسالة مطلوب");
    if (body.length > MAX_LEN) return badRequest(res, `الرسالة طويلة جداً (الحد ${MAX_LEN} حرف)`);

    const t = await loadStaffThread(req);
    if (!t) return notFound(res, "المحادثة غير موجودة");

    const msg = await transaction(async (client) => {
      const m = await client.query(
        `INSERT INTO chat_messages (thread_id, sender_id, sender_side, body)
         VALUES ($1,$2,'staff',$3) RETURNING id, sender_id, sender_side, body, created_at`,
        [t.id, req.user.id, body]
      );
      await client.query(
        "UPDATE chat_threads SET last_message_at = NOW(), last_message_preview = $2 WHERE id = $1",
        [t.id, preview(body)]
      );
      return m.rows[0];
    });

    // إشعار الرياضي وأولياء أمره
    const rec = await query(
      `SELECT $1::uuid AS id UNION SELECT guardian_id FROM guardian_athlete WHERE athlete_id = $1`,
      [t.athlete_id]
    );
    notifyUsers(rec.rows.map(r => r.id), `💬 رسالة من ${req.user.full_name || "المدرب"}`, preview(body),
      { threadId: t.id, athleteId: t.athlete_id });

    return created(res, msg);
  } catch (err) { serverError(res, err); }
};