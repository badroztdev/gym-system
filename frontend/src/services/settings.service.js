// src/services/settings.service.js
import api from "./api";

export const settingsService = {
  getGym:            ()      => api.get("/settings/gym").then(r => r.data),
  updateGym:         (data)  => api.patch("/settings/gym", data).then(r => r.data),
  updatePreferences: (data)  => api.patch("/settings/gym/preferences", data).then(r => r.data),
  getProfile:        ()      => api.get("/settings/profile").then(r => r.data),
  updateProfile:     (data)  => api.patch("/settings/profile", data).then(r => r.data),
  changePassword:    (data)  => api.post("/settings/change-password", data).then(r => r.data),
};