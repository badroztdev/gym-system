// src/services/superadmin.service.js
import api from "./api";

export const superadminService = {
  getOverview:      ()          => api.get("/superadmin/overview").then(r => r.data),
  getGyms:          (params)    => api.get("/superadmin/gyms", { params }).then(r => r.data),
  getGymDetail:     (id)        => api.get(`/superadmin/gyms/${id}`).then(r => r.data),
  updateGymStatus:  (id, data)  => api.patch(`/superadmin/gyms/${id}/status`, data).then(r => r.data),
  updateGymPlan:    (id, data)  => api.patch(`/superadmin/gyms/${id}/plan`, data).then(r => r.data),
  sendNotification: (data)      => api.post("/superadmin/notify", data).then(r => r.data),
};