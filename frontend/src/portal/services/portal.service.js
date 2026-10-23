// src/portal/services/portal.service.js
import api from "@/services/api";

export const portalService = {
  getMyAthletes:       ()              => api.get("/portal/my-athletes").then(r => r.data),
  getDashboard:        (athleteId)     => api.get(`/portal/dashboard/${athleteId}`).then(r => r.data),
  getSchedule:         (athleteId, p)  => api.get(`/portal/schedule/${athleteId}`, { params: p }).then(r => r.data),
  getAttendance:       (athleteId)     => api.get(`/portal/attendance/${athleteId}`).then(r => r.data),
  getSubscription:     (athleteId)     => api.get(`/portal/subscription/${athleteId}`).then(r => r.data),
  scan:                (data)          => api.post("/portal/scan", data).then(r => r.data),
  getProgress:         (athleteId)     => api.get(`/progress/athlete/${athleteId}`).then(r => r.data),

  // ── الرسائل مع المدرب ──────────────────────────────────────
  getChatRecipients:   (athleteId)     => api.get(`/portal/chat/${athleteId}/recipients`).then(r => r.data),
  getChatThreads:      (athleteId)     => api.get(`/portal/chat/${athleteId}/threads`).then(r => r.data),
  getChatMessages:     (threadId)      => api.get(`/portal/chat/threads/${threadId}/messages`).then(r => r.data),
  sendChatMessage:     (athleteId, staffId, body) =>
                         api.post(`/portal/chat/${athleteId}/messages`, { staffId, body }).then(r => r.data),
  getChatUnread:       ()              => api.get("/portal/chat/unread").then(r => r.data),
};