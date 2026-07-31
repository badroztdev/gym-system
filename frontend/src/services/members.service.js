// src/services/members.service.js
import api from "./api";

export const membersService = {
  getAll: (params) =>
    api.get("/members", { params }).then((r) => r.data),

  getOne: (id) =>
    api.get(`/members/${id}`).then((r) => r.data),

  getStats: () =>
    api.get("/members/stats").then((r) => r.data),

  create: (data) =>
    api.post("/members", data).then((r) => r.data),

  update: (id, data) =>
    api.patch(`/members/${id}`, data).then((r) => r.data),

  remove: (id) =>
    api.delete(`/members/${id}`),

  resetPassword: (id, newPassword) =>
    api.post(`/members/${id}/reset-password`, { newPassword }).then((r) => r.data),
};