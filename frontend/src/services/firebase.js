// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAe799OC4vtFnwem00kkJDOnw_dlg34xhs",
  authDomain: "gym-pro-fe5fb.firebaseapp.com",
  projectId: "gym-pro-fe5fb",
  storageBucket: "gym-pro-fe5fb.firebasestorage.app",
  messagingSenderId: "112881979310",
  appId: "1:112881979310:web:16888301414641fafc423f",
  measurementId: "G-G44TQPLBHX"
};

const VAPID_KEY = "BK0qhlNjzYnTAfze9y4jbXl6xpc4QzeSZK3aRR3cH6pTSrc2rS_GEkSrM0RXf_USj42ODjMnY2H5Y_kQ6QJc0VQ";

let app, messaging;

try {
  app       = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (err) {
  console.warn("Firebase init error:", err.message);
}

// آخر خطأ في تسجيل الجهاز (يُعرض في لوحة الإشعارات للتشخيص)
let lastFcmError = "";
export const getLastFcmError = () => lastFcmError;

export const requestNotificationPermission = async () => {
  lastFcmError = "";
  try {
    if (!messaging) { lastFcmError = "Firebase init failed"; return null; }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return null;
    }

    // تسجيل Service Worker
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    const fetchToken = (reg) => getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    let token;
    try {
      token = await fetchToken(registration);
    } catch (e1) {
      // بيانات تسجيل قديمة/تالفة في المتصفح: نمسحها ونعيد المحاولة مرة واحدة
      console.warn("FCM retry after clearing stale data:", e1.code || e1.message);
      try {
        await registration.pushManager.getSubscription().then(sub => sub && sub.unsubscribe());
      } catch { /* تجاهل */ }
      await Promise.all(["firebase-installations-database", "firebase-messaging-database", "firebase-heartbeat-database"].map(
        (name) => new Promise((res) => { try { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch { res(); } })
      ));
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(r => r.active && r.active.scriptURL.includes("firebase-messaging-sw")).map(r => r.unregister()));
      const fresh = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      token = await fetchToken(fresh);
    }

    console.log("✅ FCM Token obtained:", token?.slice(0, 20) + "...");
    return token;
  } catch (err) {
    console.error("FCM permission error:", err.message);
    lastFcmError = err.code ? `${err.code}: ${err.message}` : err.message;
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};