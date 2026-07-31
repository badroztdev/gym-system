// src/services/subscriptions.service.js
import api from "./api";

export const subscriptionsService = {
  getAll: (params) =>
    api.get("/subscriptions", { params }).then((r) => r.data),

  getOne: (id) =>
    api.get(`/subscriptions/${id}`).then((r) => r.data),

  getStats: () =>
    api.get("/subscriptions/stats").then((r) => r.data),

  create: (data) =>
    api.post("/subscriptions", data).then((r) => r.data),

  update: (id, data) =>
    api.patch(`/subscriptions/${id}`, data).then((r) => r.data),
};