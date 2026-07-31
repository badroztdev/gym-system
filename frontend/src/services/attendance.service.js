// src/services/attendance.service.js
import api from "./api";

export const attendanceService = {
  scan:           (data)       => api.post("/attendance/scan", data)                .then(r => r.data),
  getBySession:   (sessionId)  => api.get(`/attendance/session/${sessionId}`)       .then(r => r.data),
  manualRecord:   (data)       => api.post("/attendance/manual", data)              .then(r => r.data),
  getByAthlete:   (id, params) => api.get(`/attendance/athlete/${id}`, { params }) .then(r => r.data),
};