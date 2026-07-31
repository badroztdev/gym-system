// src/services/categories.service.js
import api from "./api";

export const categoriesService = {
  getAll:  (params) => api.get("/categories", { params }).then(r => r.data),
  create:  (data)   => api.post("/categories", data).then(r => r.data),
  update:  (id, d)  => api.patch(`/categories/${id}`, d).then(r => r.data),
  remove:  (id)     => api.delete(`/categories/${id}`),
};