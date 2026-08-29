// src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import pool from "./utils/db.js";
import { startCronJobs } from "./services/cron.service.js";

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security & utilities ─────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── CORS ─────────────────────────────────────────────────────
// يقبل قائمة نطاقات مفصولة بفواصل في CLIENT_URL، بالإضافة لنطاقات ثابتة معروفة
const envOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...envOrigins,
  "https://www.sgms.site",
  "https://sgms.site",
  "https://gym-system-two-wheat.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "محاولات كثيرة، يرجى الانتظار" },
}));

app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

// ── Body parser ───────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));

// ── Routes ────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "المسار غير موجود" }));

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "خطأ داخلي في الخادم" });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log(`✅ قاعدة البيانات متصلة`);
  } catch {
    console.error("❌ فشل الاتصال بقاعدة البيانات");
  }
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT} — ${process.env.NODE_ENV}`);

  startCronJobs();
});