// src/utils/response.js

export const ok = (res, data, meta = {}) =>
  res.status(200).json({ success: true, data, ...meta });

export const created = (res, data) =>
  res.status(201).json({ success: true, data });

export const noContent = (res) =>
  res.status(204).send();

export const badRequest = (res, message, errors = []) =>
  res.status(400).json({ success: false, message, errors });

export const unauthorized = (res, message = "غير مصرح") =>
  res.status(401).json({ success: false, message });

export const forbidden = (res, message = "ممنوع الوصول") =>
  res.status(403).json({ success: false, message });

export const notFound = (res, message = "غير موجود") =>
  res.status(404).json({ success: false, message });

export const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ success: false, message: "خطأ في الخادم" });
};

// Pagination helper
export const paginate = (page = 1, limit = 20) => ({
  limit: Math.min(Number(limit) || 20, 100),
  offset: (Math.max(Number(page) || 1, 1) - 1) * Math.min(Number(limit) || 20, 100),
  page: Math.max(Number(page) || 1, 1),
});
