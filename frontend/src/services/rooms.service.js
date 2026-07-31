// src/services/rooms.service.js
import api from "./api";

export const roomsService = {
  getAll:       ()        => api.get("/rooms")                       .then(r => r.data),
  create:       (data)    => api.post("/rooms", data)                .then(r => r.data),
  update:       (id, d)   => api.patch(`/rooms/${id}`, d)            .then(r => r.data),
  remove:       (id)      => api.delete(`/rooms/${id}`),
  regenerateQR: (id)      => api.post(`/rooms/${id}/regenerate-qr`)  .then(r => r.data),
};