// src/services/progress.service.js
import api from "./api";

export const progressService = {
  getList:            (params)  => api.get("/progress/list", { params }).then(r => r.data),
  getAthleteProgress: (id)      => api.get(`/progress/athlete/${id}`).then(r => r.data),
  create:             (data)    => api.post("/progress", data).then(r => r.data),
  update:             (id, d)   => api.patch(`/progress/${id}`, d).then(r => r.data),
  remove:             (id)      => api.delete(`/progress/${id}`),
  changeRank:         (data)    => api.post("/progress/rank-change", data).then(r => r.data),
  getMetricTemplates: (params)  => api.get("/progress/metrics-templates", { params }).then(r => r.data),
  createMetricTemplate:(data)   => api.post("/progress/metrics-templates", data).then(r => r.data),
};