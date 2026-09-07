// src/store/themeStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

// مخزن مستقل لوضع لوحة التحكم (فاتح/داكن) — محفوظ دائماً عبر إعادة التحميل
export const useThemeStore = create(
  persist(
    (set) => ({
      dark: true,
      toggleDark: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: "gym-pro-dashboard-theme" }
  )
);