// src/controllers/members.controller.js
import bcrypt from "bcrypt";
import { query, transaction } from "../utils/db.js";
import {
  ok, created, noContent,
  notFound, badRequest, serverError,
  paginate,
} from "../utils/response.js";

// ── GET /api/members ──────────────────────────────────────────
export const getMembers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, role, status, ageCategory, group, includeInactive } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["u.gym_id = $1", "u.role IN ('athlete','guardian')"];
    const params = [gymId];
    let p = 2;

    if (includeInactive !== "true") {
      conditions.push("u.is_active = TRUE");
    }

    if (search) {
      conditions.push(`(u.full_name ILIKE $${p} OR u.phone ILIKE $${p})`);
      params.push(`%${search}%`);
      p++;
    }
    if (role) {
      conditions.push(`u.role = $${p}`);
      params.push(role); p++;
    }
    if (ageCategory) {
      conditions.push(`u.age_category = $${p}`);
      params.push(ageCategory); p++;
    }
    if (group) {
      conditions.push(`u.group_name = $${p}`);
      params.push(group); p++;
    }
    if (status === "active") {
      conditions.push(`EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.athlete_id = u.id AND s.status = 'active'
          AND s.end_date >= CURRENT_DATE
      )`);
    } else if (status === "expiring") {
      conditions.push(`EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.athlete_id = u.id AND s.status = 'active'
          AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      )`);
    } else if (status === "expired") {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.athlete_id = u.id AND s.status = 'active'
      )`);
    }

    const where = conditions.join(" AND ");

    const countRes = await query(
      `SELECT COUNT(*) FROM users u WHERE ${where}`,
      params
    );
    const total = Number(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT
         u.id, u.full_name, u.phone, u.email, u.gender,
         u.date_of_birth, u.avatar_url, u.role, u.is_active, u.created_at,
         u.age_category, u.rank, u.weight_kg, u.blood_group, u.group_name,
         sub.status        AS sub_status,
         sub.end_date      AS sub_end_date,
         sp.name           AS plan_name,
         sub.sessions_remaining
       FROM users u
       LEFT JOIN LATERAL (
         SELECT s.status, s.end_date, s.plan_id, s.sessions_remaining
         FROM subscriptions s
         WHERE s.athlete_id = u.id
         ORDER BY s.end_date DESC LIMIT 1
       ) sub ON TRUE
       LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    return ok(res, rows, {
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    serverError(res, err);
  }
};

// ── GET /api/members/:id ──────────────────────────────────────
export const getMember = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.phone, u.email, u.gender,
              u.date_of_birth, u.avatar_url, u.role, u.is_active, u.created_at,
              u.age_category, u.rank, u.weight_kg, u.blood_group, u.group_name
       FROM users u
       WHERE u.id = $1 AND u.gym_id = $2`,
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "العضو غير موجود");

    const subs = await query(
      `SELECT s.id, s.start_date, s.end_date, s.status,
              s.sessions_remaining, sp.name AS plan_name, sp.price
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.athlete_id = $1
       ORDER BY s.created_at DESC`,
      [req.params.id]
    );

    const att = await query(
      `SELECT a.status, a.scanned_at, ses.title, ses.session_date, ses.start_time
       FROM attendance a
       JOIN sessions ses ON ses.id = a.session_id
       WHERE a.athlete_id = $1
       ORDER BY ses.session_date DESC LIMIT 10`,
      [req.params.id]
    );

    const guardian = await query(
      `SELECT g.id, g.full_name, g.phone
       FROM guardian_athlete ga
       JOIN users g ON g.id = ga.guardian_id
       WHERE ga.athlete_id = $1
       LIMIT 1`,
      [req.params.id]
    );

    return ok(res, {
      ...rows[0],
      subscriptions: subs.rows,
      recentAttendance: att.rows,
      currentGuardian: guardian.rows[0] || null,
    });
  } catch (err) {
    serverError(res, err);
  }
};

// ── POST /api/members ─────────────────────────────────────────
export const createMember = async (req, res) => {
  try {
    const {
      fullName, phone, email, gender, dateOfBirth,
      role = "athlete", ageCategory, rank, weightKg, bloodGroup, groupName,
      guardianId,
    } = req.body;

    const phoneRequired = !guardianId;
    if (phoneRequired && !phone)
      return badRequest(res, "رقم الهاتف مطلوب");

    if (phone) {
      const dup = await query(
        "SELECT id FROM users WHERE gym_id = $1 AND phone = $2",
        [req.user.gym_id, phone]
      );
      if (dup.rows.length)
        return badRequest(res, "رقم الهاتف مسجل مسبقاً في هذه الصالة");
    }

    const passwordSeed = phone || fullName;
    const hash = await bcrypt.hash(passwordSeed, 10);

    const { rows } = await query(
      `INSERT INTO users
         (gym_id, full_name, phone, email, gender, date_of_birth,
          role, password_hash, age_category, rank, weight_kg, blood_group, group_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, full_name, phone, email, gender, date_of_birth,
                 role, created_at, age_category, rank, weight_kg, blood_group, group_name`,
      [
        req.user.gym_id, fullName, phone || null, email || null,
        gender || null, dateOfBirth || null, role, hash,
        ageCategory || null, rank || null,
        weightKg || null, bloodGroup || null, groupName || null,
      ]
    );

    const newMember = rows[0];

    if (guardianId) {
      const guardian = await query(
        "SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role = 'guardian'",
        [guardianId, req.user.gym_id]
      );
      if (guardian.rows.length) {
        await query(
          `INSERT INTO guardian_athlete (guardian_id, athlete_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [guardianId, newMember.id]
        );
      }
    }

    return created(res, newMember);
  } catch (err) {
    serverError(res, err);
  }
};

// ── PATCH /api/members/:id ────────────────────────────────────
export const updateMember = async (req, res) => {
  try {
    const {
      fullName, phone, email, gender, dateOfBirth, isActive,
      ageCategory, rank, weightKg, bloodGroup, groupName,
      role,         // ✅ الإصلاح: كان مفقوداً تماماً، فيُتجاهَل تغيير الدور صامتاً
      guardianId,
    } = req.body;

    if (phone) {
      const dup = await query(
        "SELECT id, full_name, role FROM users WHERE gym_id = $1 AND phone = $2 AND id != $3",
        [req.user.gym_id, phone, req.params.id]
      );
      if (dup.rows.length) {
        const ROLE_LABELS = { owner: "المالك", coach: "مدرب", assistant: "مساعد مدرب", athlete: "رياضي", guardian: "ولي أمر" };
        const other = dup.rows[0];
        return badRequest(
          res,
          `رقم الهاتف مستخدم بالفعل من طرف "${other.full_name}" (${ROLE_LABELS[other.role] || other.role})`
        );
      }
    }

    // ✅ إذا تغيّر الدور إلى "رياضي" أو "ولي أمر" تحديداً، تحقق أنه قيمة صحيحة
    if (role && !["athlete", "guardian"].includes(role)) {
      return badRequest(res, "الدور غير صالح");
    }

    const params = [
      fullName     || null,
      phone        || null,
      email        || null,
      gender       || null,
      dateOfBirth  || null,
      isActive     ?? null,
      ageCategory  || null,
      rank         || null,
      weightKg     || null,
      bloodGroup   || null,
      groupName    || null,
      role         || null,   // ✅ أُضيف كوسيط جديد
      req.params.id, req.user.gym_id,
    ];

    const { rows } = await query(
      `UPDATE users SET
         full_name     = COALESCE($1,  full_name),
         phone         = COALESCE($2,  phone),
         email         = COALESCE($3,  email),
         gender        = COALESCE($4,  gender),
         date_of_birth = COALESCE($5,  date_of_birth),
         is_active     = COALESCE($6,  is_active),
         age_category  = COALESCE($7,  age_category),
         rank          = COALESCE($8,  rank),
         weight_kg     = COALESCE($9,  weight_kg),
         blood_group   = COALESCE($10, blood_group),
         group_name    = COALESCE($11, group_name),
         role          = COALESCE($12, role),
         updated_at    = NOW()
       WHERE id = $13 AND gym_id = $14
       RETURNING id, full_name, phone, email, gender, date_of_birth,
                 is_active, age_category, rank, weight_kg, blood_group, group_name, role`,
      params
    );

    if (!rows.length) return notFound(res, "العضو غير موجود");

    // ✅ إذا تغيّر الدور من رياضي إلى ولي أمر، يجب إزالة أي علاقة guardian_athlete
    // كانت تربطه كـ"رياضي" سابقاً (لم يعد رياضياً بعد الآن)
    if (role === "guardian") {
      await query("DELETE FROM guardian_athlete WHERE athlete_id = $1", [req.params.id]);
    }

    if (guardianId !== undefined) {
      await query(
        "DELETE FROM guardian_athlete WHERE athlete_id = $1",
        [req.params.id]
      );

      if (guardianId) {
        const guardian = await query(
          "SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role = 'guardian'",
          [guardianId, req.user.gym_id]
        );
        if (!guardian.rows.length)
          return badRequest(res, "ولي الأمر المحدد غير موجود");

        await query(
          `INSERT INTO guardian_athlete (guardian_id, athlete_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [guardianId, req.params.id]
        );
      }
    }

    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── DELETE /api/members/:id  (soft delete / تعطيل) ─────────────
export const deleteMember = async (req, res) => {
  try {
    const { rows } = await query(
      "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND gym_id = $2 RETURNING id",
      [req.params.id, req.user.gym_id]
    );
    if (!rows.length) return notFound(res, "العضو غير موجود");
    return noContent(res);
  } catch (err) {
    serverError(res, err);
  }
};

// ── DELETE /api/members/:id/permanent  (حذف نهائي حقيقي) ───────
// ✅ يحذف العضو بالكامل من قاعدة البيانات، بما يسمح بإعادة استخدام رقم هاتفه لاحقاً
// بما أننا لا نملك مخطط قاعدة البيانات الثابت، نكتشف ديناميكياً (عبر information_schema)
// كل الجداول التي تحتوي مفتاحاً أجنبياً يشير لـ users.id، ونحذف منها أولاً تلقائياً —
// هذا يعمل بشكل صحيح بغض النظر عن أسماء الجداول الفعلية لديك، ويتجنب أخطاء قيود المفتاح الأجنبي
export const deleteMemberPermanently = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;

    const check = await query(
      "SELECT id FROM users WHERE id = $1 AND gym_id = $2",
      [id, gymId]
    );
    if (!check.rows.length) return notFound(res, "العضو غير موجود");

    await transaction(async (client) => {
      // 1. حالة خاصة معروفة: الدفعات ترتبط بالاشتراك وليس بالعضو مباشرة (تبعية غير مباشرة)
      await client.query(
        `DELETE FROM payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE athlete_id = $1)`,
        [id]
      );

      // 2. اكتشف ديناميكياً كل الجداول/الأعمدة التي تشير كمفتاح أجنبي إلى users.id
      const fkResult = await client.query(`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users' AND ccu.column_name = 'id'
          AND tc.table_name <> 'users'
      `);

      // 3. احذف من كل جدول مُكتشف أي صف يشير لهذا العضو تحديداً
      for (const row of fkResult.rows) {
        await client.query(
          `DELETE FROM "${row.table_name}" WHERE "${row.column_name}" = $1`,
          [id]
        );
      }

      // 4. أخيراً، احذف العضو نفسه
      await client.query("DELETE FROM users WHERE id = $1", [id]);
    });

    return ok(res, { message: "تم حذف العضو وكل بياناته المرتبطة نهائياً" });
  } catch (err) {
    serverError(res, err);
  }
};

// ── POST /api/members/:id/reset-password ─────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    const member = await query(
      "SELECT phone FROM users WHERE id = $1 AND gym_id = $2",
      [req.params.id, req.user.gym_id]
    );
    if (!member.rows.length) return notFound(res, "العضو غير موجود");

    const passwordSeed = newPassword?.trim() || member.rows[0].phone;
    const hash = await bcrypt.hash(passwordSeed, 10);

    await query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hash, req.params.id]
    );

    return ok(res, {
      reset: true,
      message: newPassword
        ? "تم تغيير كلمة المرور بنجاح"
        : `تم إعادة تعيين كلمة المرور إلى رقم الهاتف: ${member.rows[0].phone}`,
    });
  } catch (err) { serverError(res, err); }
};

// ── GET /api/members/stats ────────────────────────────────────
export const getMembersStats = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const { rows } = await query(
      `SELECT
         COUNT(*)                                            AS total,
         COUNT(*) FILTER (WHERE u.is_active)                AS active_users,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.athlete_id = u.id AND s.status = 'active'
               AND s.end_date >= CURRENT_DATE
           )
         )                                                  AS active_subs,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.athlete_id = u.id AND s.status = 'active'
               AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           )
         )                                                  AS expiring_soon,
         COUNT(*) FILTER (
           WHERE u.created_at >= DATE_TRUNC('month', NOW())
         )                                                  AS new_this_month
       FROM users u
       WHERE u.gym_id = $1 AND u.role = 'athlete'`,
      [gymId]
    );
    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};
