// src/services/sessionExtras.service.js
// نتائج المنافسات + حفظ الحضور الجماعي (نافذة تعديل الحصة)
import api from "./api";

export const sessionExtrasService = {
  // { data: { results: [...], athletes: [{id, full_name}] } }
  getResults:     (sessionId) => api.get(`/sessions/${sessionId}/results`).then(r => r.data),
  saveResults:    (sessionId, results) => api.put(`/sessions/${sessionId}/results`, { results }).then(r => r.data),
  // records: [{ athleteId, status }]
  saveAttendance: (sessionId, records) => api.post("/attendance/bulk", { sessionId, records }).then(r => r.data),
};