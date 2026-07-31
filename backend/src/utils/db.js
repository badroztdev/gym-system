// src/utils/db.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     Number(process.env.DB_PORT) || 5032,
  database: process.env.DB_NAME     || "gym_pro",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "badro45123",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error:", err);
  process.exit(-1);
});

// Helper: run a query with automatic client release
export const query = (text, params) => pool.query(text, params);

// Helper: transactions
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
