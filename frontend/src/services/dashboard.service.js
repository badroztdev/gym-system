
// src/services/dashboard.service.js
import api from "./api";

export const dashboardService = {
  getOverview:      ()          => api.get("/dashboard/overview").then(r => r.data),
  getRevenueChart:  (period)    => api.get("/dashboard/revenue-chart", { params: { period } }).then(r => r.data),
  getAttendanceChart:(period)   => api.get("/dashboard/attendance-chart", { params: { period } }).then(r => r.data),
  getMembersGrowth: (period)    => api.get("/dashboard/members-growth", { params: { period } }).then(r => r.data),
  getTopCoaches:    ()          => api.get("/dashboard/top-coaches").then(r => r.data),
  getAgeDistribution:()         => api.get("/dashboard/age-category-distribution").then(r => r.data),
  getRecentActivity:()          => api.get("/dashboard/recent-activity").then(r => r.data),
};