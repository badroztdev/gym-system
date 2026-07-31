// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            "AIzaSyAe799OC4vtFnwem00kkJDOnw_dlg34xhs",
  authDomain:        "gym-pro-fe5fb.firebaseapp.com",
  projectId:         "gym-pro-fe5fb",
  storageBucket:     "gym-pro-fe5fb.firebasestorage.app",
  messagingSenderId: "112881979310",
  appId:             "1:112881979310:web:16888301414641fafc423f",
};

const VAPID_KEY = "BKOqhlNjzYnTAfze9y4jbXl6xpc4QzeSZK3aRR3cH6pTSrc2rS_GEkSrM0RXf_USj42ODjMnY2H5Y_kQ6QJc0VQ";

let app, messaging;

try {
  app       = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (err) {
  console.warn("Firebase init error:", err.message);
}

export const requestNotificationPermission = async () => {
  try {
    if (!messaging) return null;

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

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log("✅ FCM Token obtained:", token?.slice(0, 20) + "...");
    return token;
  } catch (err) {
    console.error("FCM permission error:", err.message);
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};