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
};