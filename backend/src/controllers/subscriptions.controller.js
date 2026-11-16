// src/controllers/subscriptions.controller.js
import bcrypt from "bcrypt";
import crypto from "crypto";
import { query, transaction } from "../utils/db.js";
import { athleteScopeSql, athleteInScope, subscriptionInScope, hasPermission } from "../utils/access.js";

const METHODS = ["cash", "card", "bank_transfer", "online"];

// المبالغ (المدفوع/المتبقي/الدفعات/الإيرادات) لا تُرسل إلا لمن يملك payments.view
const canSeePayments = (user) => hasPermission(user, "payments.view");
// من يستطيع تسجيل دفعة (زر «دفعة») يحتاج مبلغ الاشتراك المتبقي لاشتراكه فقط (لا إجماليات ولا سجل مدفوعات)
const canRecordPay = (user) => hasPermission(user, "payments.add") || hasPermission(user, "subscriptions.add");
const stripMoney = (row) => { delete row.total_paid; delete row.remaining; return row; };
import {
  ok, created, notFound, badRequest, serverError, paginate,
} from "../utils/response.js";

// ── GET /api/subscriptions ─────────────────────────────────────
export const getSubscriptions = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, status, paymentStatus, athleteId } = req.query;
    const gymId = req.user.gym_id;

    const conditions = ["u.gym_id = $1"];
    const params = [gymId];
    const scopeSql = athleteScopeSql(req.user, "u", params);
    if (scopeSql) conditions.push(scopeSql);
    let p = params.length + 1;

    if (athleteId) {
      conditions.push(`s.athlete_id = $${p}`);
      params.push(athleteId); p++;
    }
    if (search) {
      conditions.push(`(u.full_name ILIKE $${p} OR u.phone ILIKE $${p} OR s.visitor_name ILIKE $${p} OR s.visitor_phone ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (status === "active") {
      // الحالي فقط: بدأ فعلاً ولم ينتهِ (الاشتراك القادم لا يُحسب نشطاً الآن)
      conditions.push(`s.status = 'active' AND s.start_date <= CURRENT_DATE AND s.end_date >= CURRENT_DATE`);
    } else if (status === "upcoming") {
      conditions.push(`s.status = 'active' AND s.start_date > CURRENT_DATE`);
    } else if (status === "expiring") {
      // تنتهي قريباً ولم يُجدَّد بعد (لا يوجد اشتراك لاحق له)
      conditions.push(`s.status = 'active' AND s.start_date <= CURRENT_DATE AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND NOT EXISTS (SELECT 1 FROM subscriptions n WHERE n.athlete_id = s.athlete_id AND n.id <> s.id AND n.status = 'active' AND n.end_date > s.end_date)`);
    } else if (status === "expired") {
      conditions.push(`(s.status = 'expired' OR (s.status = 'active' AND s.end_date < CURRENT_DATE))`);
    } else if (status === "cancelled") {
      conditions.push(`s.status = 'cancelled'`);
    } else if (status === "suspended") {
      conditions.push(`s.status = 'suspended'`);
    }

    const where = conditions.join(" AND ");

    let paymentFilter = "";
    const canPay = canSeePayments(req.user);
    if (!canPay) { /* لا فلترة بحالة الدفع لمن لا يرى المدفوعات */ }
    else if (paymentStatus === "paid")    paymentFilter = "WHERE x.remaining <= 0";
    if (paymentStatus === "partial") paymentFilter = "WHERE x.remaining > 0 AND x.total_paid > 0";
    if (paymentStatus === "unpaid")  paymentFilter = "WHERE x.total_paid = 0";

    const baseQuery = `
      SELECT
        s.id, s.athlete_id, COALESCE(s.visitor_name, u.full_name) AS athlete_name, COALESCE(s.visitor_phone, u.phone) AS athlete_phone,
        s.visitor_name IS NOT NULL AS is_drop_in,
        s.plan_id, COALESCE(s.session_label, sp.name) AS plan_name,
        s.start_date, s.end_date, s.status, s.sessions_remaining,
        sp.sessions_limit, s.price, s.notes, s.created_at,
        EXISTS (
          SELECT 1 FROM subscriptions n
          WHERE n.athlete_id = s.athlete_id AND n.id <> s.id
            AND n.status = 'active' AND n.end_date > s.end_date
        ) AS has_next,
        COALESCE(pay.total_paid, 0) AS total_paid,
        (s.price - COALESCE(pay.total_paid, 0)) AS remaining
      FROM subscriptions s
      JOIN users u ON u.id = s.athlete_id
      JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS total_paid
        FROM payments
        WHERE subscription_id = s.id AND status = 'paid'
      ) pay ON TRUE
      WHERE ${where}
    `;

    const countRes = await query(
      `SELECT COUNT(*) FROM (${baseQuery}) x ${paymentFilter}`,
      params
    );
    const total = Number(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT * FROM (${baseQuery}) x ${paymentFilter}
       ORDER BY x.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    return ok(res, canPay || canRecordPay(req.user) ? rows : rows.map(stripMoney), {
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    serverError(res, err);
  }
};

// ── GET /api/subscriptions/:id ─────────────────────────────────
export const getSubscription = async (req, res) => {
  try {
    const gParams = [req.params.id, req.user.gym_id];
    const gScope = athleteScopeSql(req.user, "u", gParams);
    const { rows } = await query(
      `SELECT
         s.*, COALESCE(s.visitor_name, u.full_name) AS athlete_name, COALESCE(s.visitor_phone, u.phone) AS athlete_phone,
         s.visitor_name IS NOT NULL AS is_drop_in,
         COALESCE(s.session_label, sp.name) AS plan_name, sp.sessions_limit,
         COALESCE(pay.total_paid, 0) AS total_paid,
         (s.price - COALESCE(pay.total_paid, 0)) AS remaining
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN LATERAL (
         SELECT SUM(amount) AS total_paid FROM payments
         WHERE subscription_id = s.id AND status = 'paid'
       ) pay ON TRUE
       WHERE s.id = $1 AND u.gym_id = $2 ${gScope ? "AND " + gScope : ""}`,
      gParams
    );
    if (!rows.length) return notFound(res, "الاشتراك غير موجود");

    if (!canSeePayments(req.user))
      return ok(res, { ...(canRecordPay(req.user) ? rows[0] : stripMoney(rows[0])), payments: [], payments_hidden: true });

    const payments = await query(
      `SELECT id, amount, method, status, notes, paid_at, created_at
       FROM payments WHERE subscription_id = $1
       ORDER BY paid_at DESC NULLS LAST, created_at DESC`,
      [req.params.id]
    );

    return ok(res, { ...rows[0], payments: payments.rows });
  } catch (err) {
    serverError(res, err);
  }
};

// ── POST /api/subscriptions ────────────────────────────────────
export const createSubscription = async (req, res) => {
  try {
    if (req.body?.dropIn) return createDropIn(req, res);
    const { athleteId, planId, startDate, price, notes } = req.body;
    const gymId = req.user.gym_id;
    // ✅ دفعة أولى اختيارية عند إنشاء الاشتراك: متاحة لكل من يملك subscriptions.add
    // (لا تتطلب أي صلاحية على المدفوعات ولا تكشف الإيرادات)
    const method = METHODS.includes(req.body.method) ? req.body.method : "cash";
    const paid = req.body.paidAmount === undefined || req.body.paidAmount === "" || req.body.paidAmount === null
      ? 0 : Number(req.body.paidAmount);
    if (!Number.isFinite(paid) || paid < 0) return badRequest(res, "المبلغ المدفوع غير صحيح");

    const athlete = await query(
      "SELECT id FROM users WHERE id = $1 AND gym_id = $2",
      [athleteId, gymId]
    );
    if (!athlete.rows.length) return badRequest(res, "الرياضي غير موجود");
    if (!(await athleteInScope(req.user, athleteId)))
      return badRequest(res, "هذا الرياضي خارج نطاق صلاحياتك");

    const plan = await query(
      "SELECT * FROM subscription_plans WHERE id = $1 AND gym_id = $2 AND is_active = TRUE",
      [planId, gymId]
    );
    if (!plan.rows.length) return badRequest(res, "الخطة غير موجودة أو معطّلة");

    const p = plan.rows[0];
    const finalPrice = price !== undefined && price !== null && price !== "" ? price : p.price;
    // ✅ تجديد مسبق: إن لم يُحدَّد تاريخ بداية، يبدأ الاشتراك الجديد في اليوم التالي لانتهاء الحالي
    // (بدل أن يبدأ اليوم ويتداخل معه فيضيع على الرياضي ما تبقى من اشتراكه)
    let start = startDate;
    if (!start) {
      const cur = await query(
        `SELECT to_char(MAX(end_date) + 1, 'YYYY-MM-DD') AS d
         FROM subscriptions
         WHERE athlete_id = $1 AND status = 'active' AND end_date >= CURRENT_DATE`,
        [athleteId]
      );
      start = cur.rows[0]?.d || new Date().toISOString().slice(0, 10);
    }

    if (paid > Number(finalPrice) + 0.01) return badRequest(res, "المبلغ المدفوع أكبر من السعر");

    const row = await transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO subscriptions
           (athlete_id, plan_id, start_date, end_date, status,
            sessions_remaining, price, notes, created_by)
         VALUES (
           $1, $2, $3::date,
           ($3::date + ($4 || ' days')::interval)::date,
           'active', $5, $6, $7, $8
         )
         RETURNING *`,
        [athleteId, planId, start, p.duration_days, p.sessions_limit, finalPrice, notes || null, req.user.id]
      );
      if (paid > 0) {
        await client.query(
          `INSERT INTO payments (subscription_id, amount, method, status, notes, recorded_by, paid_at)
           VALUES ($1, $2, $3, 'paid', NULL, $4, NOW())`,
          [ins.rows[0].id, paid, method, req.user.id]
        );
      }
      return ins.rows[0];
    });

    return created(res, row);
  } catch (err) {
    serverError(res, err);
  }
};

// ── PATCH /api/subscriptions/:id ───────────────────────────────
export const updateSubscription = async (req, res) => {
  try {
    const { status, endDate, price, notes, sessionsRemaining } = req.body;

    if (!(await subscriptionInScope(req.user, req.params.id)))
      return notFound(res, "الاشتراك غير موجود");

    const { rows } = await query(
      `UPDATE subscriptions s SET
         status             = COALESCE($1, s.status),
         end_date           = COALESCE($2, s.end_date),
         price              = COALESCE($3, s.price),
         notes              = COALESCE($4, s.notes),
         sessions_remaining = COALESCE($5, s.sessions_remaining),
         updated_at         = NOW()
       WHERE s.id = $6
         AND s.athlete_id IN (SELECT id FROM users WHERE gym_id = $7)
       RETURNING s.*`,
      [
        status || null, endDate || null, price ?? null,
        notes || null, sessionsRemaining ?? null,
        req.params.id, req.user.gym_id,
      ]
    );

    if (!rows.length) return notFound(res, "الاشتراك غير موجود");
    return ok(res, rows[0]);
  } catch (err) {
    serverError(res, err);
  }
};

// ── DELETE /api/subscriptions/:id ──────────────────────────────
// ✅ حذف نهائي حقيقي — يُستخدم لتصحيح أخطاء إدخال البيانات (مثل تاريخ خاطئ)
// وليس لإنهاء اشتراك صحيح (لذلك استخدام PATCH status=cancelled)
// يحذف أولاً كل الدفعات المرتبطة بهذا الاشتراك تحديداً (لتفادي سجلات "يتيمة"
// أو خطأ قيد المفتاح الأجنبي)، ثم يحذف الاشتراك نفسه — كل ذلك ضمن معاملة واحدة (Transaction)
export const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const gymId = req.user.gym_id;

    // تحقق أولاً أن الاشتراك موجود فعلاً ويخص هذه الصالة (وضمن نطاق المدرب)
    const dParams = [id, gymId];
    const dScope = athleteScopeSql(req.user, "u", dParams);
    const check = await query(
      `SELECT s.id FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       WHERE s.id = $1 AND u.gym_id = $2 ${dScope ? "AND " + dScope : ""}`,
      dParams
    );
    if (!check.rows.length) return notFound(res, "الاشتراك غير موجود");

    await transaction(async (client) => {
      await client.query("DELETE FROM payments WHERE subscription_id = $1", [id]);
      await client.query("DELETE FROM subscriptions WHERE id = $1", [id]);
    });

    return ok(res, { message: "تم حذف الاشتراك وكل دفعاته المرتبطة نهائياً" });
  } catch (err) {
    serverError(res, err);
  }
};

// ── GET /api/subscriptions/stats ───────────────────────────────
export const getSubscriptionStats = async (req, res) => {
  try {
    const gymId = req.user.gym_id;
    const stParams = [gymId];
    const stScope = athleteScopeSql(req.user, "u", stParams);
    const stSql = stScope ? "AND " + stScope : "";

    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE s.status = 'active' AND s.visitor_name IS NULL AND s.start_date <= CURRENT_DATE AND s.end_date >= CURRENT_DATE) AS active_count,
         COUNT(*) FILTER (WHERE s.status = 'active' AND s.visitor_name IS NULL AND s.start_date <= CURRENT_DATE AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           AND NOT EXISTS (SELECT 1 FROM subscriptions n WHERE n.athlete_id = s.athlete_id AND n.id <> s.id AND n.status = 'active' AND n.end_date > s.end_date)) AS expiring_count,
         COUNT(*) FILTER (WHERE s.status = 'active' AND s.visitor_name IS NULL AND s.end_date < CURRENT_DATE) AS expired_count,
         COALESCE(SUM(s.price) FILTER (WHERE s.status = 'active' AND s.visitor_name IS NULL), 0) AS active_revenue_expected,
         COALESCE(SUM(s.price - COALESCE(pay.total_paid,0)) FILTER (WHERE s.status = 'active'), 0) AS total_due
       FROM subscriptions s
       JOIN users u ON u.id = s.athlete_id
       LEFT JOIN LATERAL (
         SELECT SUM(amount) AS total_paid FROM payments
         WHERE subscription_id = s.id AND status = 'paid'
       ) pay ON TRUE
       WHERE u.gym_id = $1 ${stSql}`,
      stParams
    );

    const revenue = await query(
      `SELECT COALESCE(SUM(p.amount), 0) AS revenue_this_month
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       JOIN users u ON u.id = s.athlete_id
       WHERE u.gym_id = $1 AND p.status = 'paid'
         AND p.paid_at >= DATE_TRUNC('month', NOW()) ${stSql}`,
      stParams
    );

    if (!canSeePayments(req.user)) {
      const { active_revenue_expected, total_due, ...counts } = rows[0];
      return ok(res, counts);
    }
    return ok(res, { ...rows[0], ...revenue.rows[0] });
  } catch (err) {
    serverError(res, err);
  }
};

// ── POST /api/subscriptions  { dropIn: true, ... } ─────────────
// ✅ حصة واحدة لزائر غير مسجَّل/منخرط: تُسجَّل كاشتراك + دفعة ضمن نفس جداول الاشتراكات والمدفوعات
// فتدخل في الإيرادات تلقائياً. بيانات الزائر (الاسم/الهاتف/اسم الحصة) تُحفظ على الاشتراك نفسه،
// ويرتبط بحساب داخلي واحد معطَّل لكل صالة (phone = '__visitor__') لا يظهر في الأعضاء ولا يمكنه الدخول.
const GUEST_PHONE = "__visitor__";
const GUEST_PLAN  = "حصة واحدة (زائر)";

async function createDropIn(req, res) {
  try {
    const gymId = req.user.gym_id;
    const b = req.body;
    const name  = String(b.visitorName || "").trim().slice(0, 120);
    const phone = String(b.visitorPhone || "").trim().slice(0, 30) || null;
    const label = String(b.sessionLabel || "").trim().slice(0, 150);
    const price = Number(b.price);
    const method = METHODS.includes(b.method) ? b.method : "cash";
    const notes = String(b.notes || "").trim().slice(0, 500) || null;
    const date  = /^\d{4}-\d{2}-\d{2}$/.test(String(b.sessionDate || "")) ? b.sessionDate : null;

    if (name.length < 2)  return badRequest(res, "اسم الزائر مطلوب");
    if (!label)           return badRequest(res, "اسم الحصة مطلوب");
    if (!Number.isFinite(price) || price < 0) return badRequest(res, "السعر غير صحيح");

    // المبلغ المدفوع: متاح لكل من يملك subscriptions.add (لا يكشف الإيرادات)
    let paid = b.paidAmount !== undefined && b.paidAmount !== "" && b.paidAmount !== null ? Number(b.paidAmount) : 0;
    if (!Number.isFinite(paid) || paid < 0) return badRequest(res, "المبلغ المدفوع غير صحيح");
    if (paid > price + 0.01) return badRequest(res, "المبلغ المدفوع أكبر من السعر");

    const result = await transaction(async (client) => {
      // الحساب الداخلي للزوار (يُنشأ مرة واحدة لكل صالة)
      let g = await client.query("SELECT id FROM users WHERE gym_id = $1 AND phone = $2", [gymId, GUEST_PHONE]);
      if (!g.rows.length) {
        const hash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
        g = await client.query(
          `INSERT INTO users (gym_id, full_name, phone, role, password_hash, is_active)
           VALUES ($1, 'زائر (حصة واحدة)', $2, 'athlete', $3, FALSE) RETURNING id`,
          [gymId, GUEST_PHONE, hash]
        );
      }
      const guestId = g.rows[0].id;

      // خطة داخلية معطَّلة (لا تظهر عند إنشاء اشتراك عادي)
      let pl = await client.query("SELECT id FROM subscription_plans WHERE gym_id = $1 AND name = $2", [gymId, GUEST_PLAN]);
      if (!pl.rows.length) {
        pl = await client.query(
          `INSERT INTO subscription_plans (gym_id, name, duration_days, price, sessions_limit, is_active)
           VALUES ($1, $2, 1, 0, 1, FALSE) RETURNING id`,
          [gymId, GUEST_PLAN]
        );
      }

      const sub = await client.query(
        `INSERT INTO subscriptions
           (athlete_id, plan_id, start_date, end_date, status, sessions_remaining, price, notes, created_by,
            visitor_name, visitor_phone, session_label)
         VALUES ($1, $2, COALESCE($3::date, (NOW() AT TIME ZONE 'Africa/Algiers')::date),
                 COALESCE($3::date, (NOW() AT TIME ZONE 'Africa/Algiers')::date),
                 'active', NULL, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [guestId, pl.rows[0].id, date, price, notes, req.user.id, name, phone, label]
      );

      if (paid > 0) {
        await client.query(
          `INSERT INTO payments (subscription_id, amount, method, status, notes, recorded_by, paid_at)
           VALUES ($1, $2, $3, 'paid', $4, $5, NOW())`,
          [sub.rows[0].id, paid, method, notes, req.user.id]
        );
      }
      return sub.rows[0];
    });

    return created(res, result);
  } catch (err) {
    serverError(res, err);
  }
}
