// src/utils/db.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

// Railway (وأي استضافة سحابية) يوفّر DATABASE_URL تلقائياً — نستخدمه أولاً إن وُجد
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // مطلوب على Railway
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      // إعدادات محلية (جهازك الشخصي فقط)
      host:     process.env.DB_HOST     || "localhost",
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || "gym_pro",
      user:     process.env.DB_USER     || "postgres",
      password: process.env.DB_PASSWORD || "",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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