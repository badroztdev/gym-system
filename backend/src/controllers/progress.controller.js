// src/controllers/progress.controller.js
import { query, transaction } from "../utils/db.js";
import { ok, created, notFound, badRequest, serverError, paginate } from "../utils/response.js";

// دالة مساعدة: التحقق أن الرياضي/ولي الأمر يملك صلاحية الوصول
async function canAccessAsPortalUser(user, athleteId) {
  if (user.role === "athlete") return user.id === athleteId;
  if (user.role === "guardian") {
    const check = await query(
      "SELECT 1 FROM guardian_athlete WHERE guardian_id=$1 AND athlete_id=$2",
      [user.id, athleteId]
    );
    return check.rows.length > 0;
  }
  return false;
}

// ── GET /api/progress/athlete/:athleteId ───────────────────────
// كل سجلات التقدم لرياضي معيّن (للرسم البياني والجدول)
// يُستخدم من لوحة التحكم (staff) ومن بوابة الرياضي/ولي الأمر
export const getAthleteProgress = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const gymId = req.user.gym_id;
    const isStaff = ["owner","coach","assistant"].includes(req.user.role);

    // إذا لم يكن staff، تحقق من صلاحية portal (رياضي/ولي أمر)
    if (!isStaff) {
      const allowed = await canAccessAsPortalUser(req.user, athleteId);
      if (!allowed) return badRequest(res, "ليس لديك صلاحية الوصول لهذا الرياضي");
    }

    // تحقق أن الرياضي في نفس الصالة
    const athleteCheck = await query(
      "SELECT id, full_name, age_category, rank FROM users WHERE id=$1 AND gym_id=$2",
      [athleteId, gymId]
    );
    if (!athleteCheck.rows.length) return notFound(res, "الرياضي غير موجود");

    const { rows } = await query(
      `SELECT p.id, p.record_date, p.weight_kg, p.body_fat_pct,
              p.performance_score, p.notes, p.custom_metrics, p.created_at,
              c.full_name AS coach_name
       FROM athlete_progress p
       LEFT JOIN users c ON c.id = p.coach_id
       WHERE p.athlete_id = $1
       ORDER BY p.record_date DESC, p.created_at DESC`,
      [athleteId]
    );

    // سجل تغيّر الرتب
    const ranks = await query(
      `SELECT old_rank, new_rank, notes, changed_at,
              u.full_name AS changed_by_name
       FROM rank_history rh
       LEFT JOIN users u ON u.id = rh.changed_by
       WHERE athlete_id = $1
       ORDER BY changed_at DESC`,
      [athleteId]
    );

    return ok(res, {
      athlete: athleteCheck.rows[0],
      records: rows,
      rankHistory: ranks.rows,
    });
  } catch (err) { serverError(res, err); }
};

// ── POST /api/progress ──────────────────────────────────────────
export const createProgress = async (req, res) => {
  try {
    const {
      athleteId, recordDate, weightKg, bodyFatPct,
      performanceScore, notes, customMetrics,
    } = req.body;

    if (!athleteId) return badRequest(res, "الرياضي مطلوب");

    // تحقق من الرياضي بنفس الصالة
    const athlete = await query(
      "SELECT id FROM users WHERE id=$1 AND gym_id=$2",
      [athleteId, req.user.gym_id]
    );
    if (!athlete.rows.length) return badRequest(res, "الرياضي غير موجود");

    const { rows } = await query(
      `INSERT INTO athlete_progress
         (athlete_id, coach_id, record_date, weight_kg, body_fat_pct,
          performance_score, notes, custom_metrics)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        athleteId, req.user.id, recordDate || new Date().toISOString().slice(0,10),
        weightKg || null, bodyFatPct || null,
        performanceScore || null, notes || null,
        JSON.stringify(customMetrics || {}),
      ]
    );

    return created(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── PATCH /api/progress/:id ─────────────────────────────────────
export const updateProgress = async (req, res) => {
  try {
    const { recordDate, weightKg, bodyFatPct, performanceScore, notes, customMetrics } = req.body;

    const { rows } = await query(
      `UPDATE athlete_progress SET
         record_date       = COALESCE($1, record_date),
         weight_kg         = COALESCE($2, weight_kg),
         body_fat_pct      = COALESCE($3, body_fat_pct),
         performance_score = COALESCE($4, performance_score),
         notes             = COALESCE($5, notes),
         custom_metrics    = COALESCE($6, custom_metrics)
       WHERE id = $7
       RETURNING *`,
      [
        recordDate || null, weightKg || null, bodyFatPct || null,
        performanceScore || null, notes || null,
        customMetrics ? JSON.stringify(customMetrics) : null,
        req.params.id,
      ]
    );
    if (!rows.length) return notFound(res, "السجل غير موجود");
    return ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── DELETE /api/progress/:id ────────────────────────────────────
export const deleteProgress = async (req, res) => {
  try {
    const { rowCount } = await query("DELETE FROM athlete_progress WHERE id=$1", [req.params.id]);
    if (!rowCount) return notFound(res, "السجل غير موجود");
    return ok(res, { deleted: true });
  } catch (err) { serverError(res, err); }
};

// ── POST /api/progress/rank-change ──────────────────────────────
// تغيير رتبة الرياضي + تسجيله في سجل التاريخ
export const changeRank = async (req, res) => {
  try {
    const { athleteId, newRank, notes } = req.body;
    if (!athleteId || !newRank) return badRequest(res, "الرياضي والرتبة الجديدة مطلوبان");

    const result = await transaction(async (client) => {
      const current = await client.query("SELECT rank FROM users WHERE id=$1", [athleteId]);
      const oldRank = current.rows[0]?.rank || null;

      await client.query("UPDATE users SET rank=$1, updated_at=NOW() WHERE id=$2", [newRank, athleteId]);

      const { rows } = await client.query(
        `INSERT INTO rank_history (athlete_id, old_rank, new_rank, changed_by, notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [athleteId, oldRank, newRank, req.user.id, notes || null]
      );
      return rows[0];
    });

    return created(res, result);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/progress/metrics-templates ─────────────────────────
// قوالب القياسات المخصصة المحفوظة مسبقاً (لتسهيل الإدخال)
export const getMetricTemplates = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const conditions = ["gym_id = $1"];
    const params = [req.user.gym_id];
    if (categoryId) { conditions.push("category_id = $2"); params.push(categoryId); }

    const { rows } = await query(
      `SELECT * FROM metric_templates WHERE ${conditions.join(" AND ")} ORDER BY metric_label`,
      params
    );
    return ok(res, rows);
  } catch (err) { serverError(res, err); }
};

// ── POST /api/progress/metrics-templates ────────────────────────
export const createMetricTemplate = async (req, res) => {
  try {
    const { categoryId, metricKey, metricLabel, unit } = req.body;
    if (!metricKey || !metricLabel) return badRequest(res, "المفتاح والاسم مطلوبان");

    const { rows } = await query(
      `INSERT INTO metric_templates (gym_id, category_id, metric_key, metric_label, unit)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.gym_id, categoryId || null, metricKey, metricLabel, unit || null]
    );
    return created(res, rows[0]);
  } catch (err) { serverError(res, err); }
};

// ── GET /api/progress/list ───────────────────────────────────────
// قائمة كل الرياضيين مع آخر سجل تقدم لهم (لعرض جدول عام)
export const getProgressList = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, ageCategory } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["u.gym_id = $1", "u.role = 'athlete'", "u.is_active = TRUE"];
    const params = [gymId];
    let p = 2;

    if (search) { conditions.push(`u.full_name ILIKE $${p}`); params.push(`%${search}%`); p++; }
    if (ageCategory) { conditions.push(`u.age_category = $${p}`); params.push(ageCategory); p++; }

    const countRes = await query(`SELECT COUNT(*) FROM users u WHERE ${conditions.join(" AND ")}`, params);
    const total = Number(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT
         u.id, u.full_name, u.avatar_url, u.age_category, u.rank,
         latest.weight_kg, latest.performance_score, latest.record_date,
         (SELECT COUNT(*) FROM athlete_progress WHERE athlete_id = u.id) AS records_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT weight_kg, performance_score, record_date
         FROM athlete_progress WHERE athlete_id = u.id
         ORDER BY record_date DESC LIMIT 1
       ) latest ON TRUE
       WHERE ${conditions.join(" AND ")}
       ORDER BY u.full_name
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, limit, offset]
    );

    return ok(res, rows, { meta: { total, page, limit, pages: Math.ceil(total/limit) } });
  } catch (err) { serverError(res, err); }
};