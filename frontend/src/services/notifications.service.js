// src/services/notifications.service.js
import api from "./api";

export const notificationsService = {
  getAll:        ()       => api.get("/notifications").then(r => r.data),
  markRead:      (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:   ()       => api.patch("/notifications/all/read"),
  saveToken:     (token)  => api.post("/notifications/token", { token, platform: "web" }).then(r => r.data),
  sendManual:    (data)   => api.post("/notifications/send", data).then(r => r.data),
  notifyExpiring:()       => api.get("/notifications/notify-expiring").then(r => r.data),
};