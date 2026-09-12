// src/services/fcm.service.js
// ✅ تحويل كامل لاستخدام مكتبة Firebase الرسمية (firebase-admin) بدل إعادة
// تطبيق بروتوكول OAuth/JWT يدوياً — يُزيل أي احتمال لخطأ خفي في التطبيق اليدوي
// السابق، ويعتمد كلياً على الكود المُختبَر رسمياً من جوجل نفسها
import { readFileSync } from "fs";
import admin from "firebase-admin";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gym-pro-fe5fb";

// ✅ يُطبَع فور تحميل هذا الملف من قِبَل Node.js — إذا لم يظهر هذا السطر
// إطلاقاً في السجلات عند بدء تشغيل الخادم، فهذا يعني أن الملف الجديد لم
// يُنشَر فعلياً على الخادم (رغم كل تأكيداتنا السابقة)
console.log("📦 [FCM] fcm.service.js module loaded");

let initialized = false;

function ensureInitialized() {
  console.log("🔧 [FCM] ensureInitialized() called — initialized so far:", initialized);
  if (initialized) return;

  let serviceAccount;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
      serviceAccount = JSON.parse(readFileSync(path, "utf8"));
    }
  } catch (err) {
    console.warn("⚠️  Firebase Service Account not found — notifications disabled:", err.message);
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
    initialized = true;
    console.log("✅ [FCM] Firebase Admin SDK initialized");
  } catch (err) {
    // ✅ إذا كان التطبيق مُهيَّأً مسبقاً (نادراً)، اعتبره ناجحاً بدل الفشل
    if (err.code === "app/duplicate-app") {
      initialized = true;
      console.log("✅ [FCM] Firebase Admin SDK already initialized (reused)");
    } else {
      console.error("❌ [FCM] initializeApp failed:", err.message);
    }
  }
}

export const sendNotification = async ({ token, title, body, data = {} }) => {
  ensureInitialized();
  if (!initialized) return { success: false, error: "Firebase Service Account not configured" };

  try {
    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: {
        notification: { title, body, icon: "/icon-192.png" },
        fcmOptions: { link: "/" },
      },
    });
    return { success: true, messageId };
  } catch (err) {
    // ✅ رسالة الخطأ الآن تأتي مباشرة من مكتبة Google الرسمية — أكثر دقة ووضوحاً
    console.error("❌ [FCM] send error:", err.code || err.message, "—", err.message);
    return { success: false, error: err.message };
  }
};

export const sendMulticast = async ({ tokens, title, body, data = {} }) => {
  if (!tokens?.length) return { success: true, sent: 0, failed: 0 };
  const results = await Promise.allSettled(
    tokens.map(token => sendNotification({ token, title, body, data }))
  );
  const sent = results.filter(r => r.status === "fulfilled" && r.value?.success).length;
  return { success: true, sent, failed: results.length - sent };
};

export const NotificationTemplates = {
  absence:               (name, session) => ({ title: `غياب — ${name}`, body: `لم يحضر ${name} حصة "${session}" اليوم` }),
  late:                  (name, session) => ({ title: `تأخر — ${name}`, body: `تأخر ${name} عن حصة "${session}"` }),
  attendanceConfirmed:   (name, session) => ({ title: "تم تسجيل الحضور ✅", body: `حضر ${name} حصة "${session}" بنجاح` }),
  subscriptionExpiring:  (name, days)    => ({ title: "اشتراك ينتهي قريباً ⚠️", body: `اشتراك ${name} ينتهي خلال ${days} أيام` }),
  subscriptionExpired:   (name)          => ({ title: "انتهى الاشتراك", body: `انتهى اشتراك ${name}. يرجى التجديد` }),
  paymentReceived:       (name, amount)  => ({ title: "تم استلام الدفعة 💰", body: `تم تسجيل دفعة ${amount} دج لـ ${name}` }),
};
