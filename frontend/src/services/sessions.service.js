// src/services/sessions.service.js
import api from "./api";

export const sessionsService = {
  getAll:  (params) => api.get("/sessions",       { params }).then(r => r.data),
  getToday:()       => api.get("/sessions/today")            .then(r => r.data),
  getOne:  (id)     => api.get(`/sessions/${id}`)            .then(r => r.data),
  create:  (data)   => api.post("/sessions", data)           .then(r => r.data),
  update:  (id, d)  => api.patch(`/sessions/${id}`, d)       .then(r => r.data),
  cancel:  (id, reason) => api.delete(`/sessions/${id}`, { data: { reason } }),
};