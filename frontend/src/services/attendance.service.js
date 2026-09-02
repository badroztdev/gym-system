// src/services/attendance.service.js
import api from "./api";

export const attendanceService = {
  scan:           (data)       => api.post("/attendance/scan", data)                .then(r => r.data),
  getBySession:   (sessionId)  => api.get(`/attendance/session/${sessionId}`)       .then(r => r.data),
  manualRecord:   (data)       => api.post("/attendance/manual", data)              .then(r => r.data),
  getByAthlete:   (id, params) => api.get(`/attendance/athlete/${id}`, { params }) .then(r => r.data),

  getOverview:        (params) => api.get("/attendance/overview", { params })       .then(r => r.data),
  getTrend:           (period) => api.get("/attendance/trend", { params: { period } }).then(r => r.data),
  getLeaderboard:     (order)  => api.get("/attendance/leaderboard", { params: { order } }).then(r => r.data),
  getByCategory:      ()       => api.get("/attendance/by-category")                .then(r => r.data),
  getRecentSessions:  ()       => api.get("/attendance/recent-sessions")            .then(r => r.data),
};