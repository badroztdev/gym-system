// src/services/plans.service.js
import api from "./api";

export const plansService = {
  getAll: (params) =>
    api.get("/plans", { params }).then((r) => r.data),

  create: (data) =>
    api.post("/plans", data).then((r) => r.data),

  update: (id, data) =>
    api.patch(`/plans/${id}`, data).then((r) => r.data),

  remove: (id) =>
    api.delete(`/plans/${id}`),
};