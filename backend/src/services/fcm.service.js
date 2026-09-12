// src/services/fcm.service.js
// ✅ الإصلاح الجوهري النهائي: firebase-admin v14+ يتطلب "الاستيراد المُجزَّأ"
// (Modular API) بدل النمط القديم (import admin from "firebase-admin" ثم
// admin.credential.cert(...)) — النمط القديم كان يجعل admin.credential غير
// معرَّف إطلاقاً (undefined) في هذا الإصدار، مسبِّباً فشل التهيئة صامتاً
// من نوع "Cannot read properties of undefined (reading 'cert')"
import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gym-pro-fe5fb";

console.log("📦 [FCM] fcm.service.js module loaded");

let messagingInstance = null;

function ensureInitialized() {
  if (messagingInstance) return messagingInstance;

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
    return null;
  }

  try {
    // ✅ تجنّب تهيئة مضاعفة إن استُدعيت هذه الدالة أكثر من مرة
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });

    messagingInstance = getMessaging(app);
    console.log("✅ [FCM] Firebase Admin SDK initialized (modular API)");
    return messagingInstance;
  } catch (err) {
    console.error("❌ [FCM] initializeApp failed:", err.message);
    return null;
  }
}

export const sendNotification = async ({ token, title, body, data = {} }) => {
  const messaging = ensureInitialized();
  if (!messaging) return { success: false, error: "Firebase Service Account not configured" };

  try {
    const messageId = await messaging.send({
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
