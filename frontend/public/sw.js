// SGMS — service worker بسيط لتثبيت التطبيق (PWA)
// لا يخزّن طلبات الـ API إطلاقاً؛ فقط صفحة الدخول كاحتياط عند انقطاع الإنترنت.
// ملاحظة: لا يتعارض مع firebase-messaging-sw.js (نطاق تسجيل مختلف).
const CACHE = "sgms-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/")).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // فقط تنقّل الصفحات (HTML) — كل شيء آخر يمر مباشرة للشبكة
  if (req.mode !== "navigate") return;
  e.respondWith(
    fetch(req).catch(() => caches.match("/").then((r) => r || Response.error()))
  );
});
