// src/services/payments.service.js
import api from "./api";

export const paymentsService = {
  getAll: (params) =>
    api.get("/payments", { params }).then((r) => r.data),

  getStats: () =>
    api.get("/payments/stats").then((r) => r.data),

  create: (data) =>
    api.post("/payments", data).then((r) => r.data),

  remove: (id) =>
    api.delete(`/payments/${id}`),
};