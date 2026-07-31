// src/portal/store/portalStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const usePortalStore = create(
  persist(
    (set) => ({
      selectedAthleteId: null,
      setSelectedAthlete: (id) => set({ selectedAthleteId: id }),
    }),
    { name: "gym-pro-portal" }
  )
);