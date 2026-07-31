// public/firebase-messaging-sw.js
// هذا الملف يعمل في الخلفية لاستقبال الإشعارات عندما يكون التطبيق مغلقاً

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

const messaging = firebase.messaging();

// استقبال الرسائل في الخلفية وعرضها كـ Push notification
messaging.onBackgroundMessage((payload) => {
  console.log("Background message:", payload);
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "إشعار جديد", {
    body: body || "",
    icon:  "/icon-192.png",
    badge: "/badge-72.png",
    dir:   "rtl",
    lang:  "ar",
    data:  payload.data || {},
  });
});

// عند الضغط على الإشعار — افتح التطبيق
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus();
      } else {
        clients.openWindow("/");
      }
    })
  );
});