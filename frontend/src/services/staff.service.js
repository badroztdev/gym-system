// src/services/staff.service.js
import api from "./api";

export const staffService = {
  getAll:  (params) => api.get("/staff", { params }).then(r => r.data),
  getOne:  (id)     => api.get(`/staff/${id}`).then(r => r.data),
  create:  (data)   => api.post("/staff", data).then(r => r.data),
  update:  (id, d)  => api.patch(`/staff/${id}`, d).then(r => r.data),
  remove:  (id)     => api.delete(`/staff/${id}`),
};