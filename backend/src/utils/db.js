// src/utils/db.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

// ✅ تحصين: رُفع max من 20 إلى 40 اتصالاً متزامناً
// السبب: كل طلب تسجيل دخول يستهلك اتصالاً واحداً لبضعة أجزاء من الثانية.
// مع 35+ رياضياً يحاولون الدخول معاً، كان الحد القديم (20) يُستنفَد بسرعة،
// فتنتظر الطلبات الزائدة في طابور حتى يتحرر اتصال، مسبِّبة بطئاً أو انتهاء مهلة (timeout)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 40,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // رُفعت من 5000 إلى 10000 لإعطاء مهلة أطول تحت الحِمل
    })
  : new Pool({
      host:     process.env.DB_HOST     || "localhost",
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || "gym_pro",
      user:     process.env.DB_USER     || "postgres",
      password: process.env.DB_PASSWORD || "",
      max: 40,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error:", err);
});

export const query = (text, params) => pool.query(text, params);

export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default pool;