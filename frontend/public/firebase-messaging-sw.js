// public/firebase-messaging-sw.js
// يعمل في الخلفية: يعرض إشعار SGMS في شريط الهاتف العلوي حتى والموقع مغلق

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyAe799OC4vtFnwem00kkJDOnw_dlg34xhs",
  authDomain:        "gym-pro-fe5fb.firebaseapp.com",
  projectId:         "gym-pro-fe5fb",
  storageBucket:     "gym-pro-fe5fb.firebasestorage.app",
  messagingSenderId: "112881979310",
  appId:             "1:112881979310:web:16888301414641fafc423f",
});

// تسجيل وقت وصول أي رسالة دفع إلى الجهاز (للتشخيص: هل وصلت الرسالة أصلاً؟ تظهر في لوحة الإشعارات)
self.addEventListener("push", (event) => {
  event.waitUntil(
    caches.open("sgms-push").then((c) => c.put("/__last-push", new Response(String(Date.now())))).catch(() => {})
  );
});

const messaging = firebase.messaging();

// الرسائل التي تحمل حقل notification يعرضها Firebase تلقائياً (بالأيقونة والشارة المرسلتين من الخادم).
// نعرض هنا فقط الرسائل "data-only" لتفادي ظهور الإشعار مرتين.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const d = payload.data || {};
  if (!d.title && !d.body) return;
  return self.registration.showNotification(d.title || "SGMS", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: d.tag || undefined,
    dir: "auto",
    vibrate: [120, 60, 120],
    data: d,
  });
});

// عند الضغط على الإشعار: ركّز النافذة المفتوحة أو افتح الموقع
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = (data.FCM_MSG && data.FCM_MSG.notification && data.FCM_MSG.notification.click_action) || data.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
