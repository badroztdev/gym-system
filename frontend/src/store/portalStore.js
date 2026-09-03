// src/portal/store/portalStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const usePortalStore = create(
  persist(
    (set) => ({
      selectedAthleteId: null,
      setSelectedAthlete: (id) => set({ selectedAthleteId: id }),

      // ✅ وضع البوابة (فاتح/داكن) — محفوظ ومشترك بين كل صفحات البوابة
      dark: true,
      toggleDark: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: "gym-pro-portal" }
  )
);