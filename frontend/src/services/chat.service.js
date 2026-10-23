// src/services/chat.service.js — رسائل الرياضيين (لوحة التحكم: مدرب/مساعد/مالك)
import api from "./api";

export const chatService = {
  getThreads:  (search = "") => api.get("/chat/threads", { params: search ? { search } : {} }).then(r => r.data),
  getMessages: (threadId)    => api.get(`/chat/threads/${threadId}/messages`).then(r => r.data),
  send:        (threadId, body) => api.post(`/chat/threads/${threadId}/messages`, { body }).then(r => r.data),
  getUnread:   ()            => api.get("/chat/unread").then(r => r.data),
};