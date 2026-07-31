// src/services/fcm.service.js
import { readFileSync } from "fs";
import { createSign } from "crypto";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gym-pro-fe5fb";
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

let serviceAccount = null;
let cachedToken = null;
let tokenExpiry = 0;

function getServiceAccount() {
  if (serviceAccount) return serviceAccount;
  try {
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
    serviceAccount = JSON.parse(readFileSync(path, "utf8"));
    return serviceAccount;
  } catch {
    console.warn("⚠️  Firebase Service Account not found — notifications disabled");
    return null;
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const sa = getServiceAccount();
  if (!sa) throw new Error("Firebase Service Account not configured");

  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email, sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${sign.sign(sa.private_key, "base64url")}`;

  const res  = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("FCM auth failed");

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 3500 * 1000;
  return cachedToken;
}

export const sendNotification = async ({ token, title, body, data = {} }) => {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(FCM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          webpush: {
            notification: { title, body, icon: "/icon-192.png", dir: "rtl", lang: "ar" },
            fcm_options: { link: "/" },
          },
        },
      }),
    });
    const result = await res.json();
    if (result.error) return { success: false, error: result.error };
    return { success: true, messageId: result.name };
  } catch (err) {
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