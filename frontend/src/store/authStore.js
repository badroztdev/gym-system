// src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user:  null,
      token: null,

      setAuth: (user, token) => set({ user, token }),
      updateUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null }),

      // Getters
      isOwner:     () => useAuthStore.getState().user?.role === "owner",
      isCoach:     () => useAuthStore.getState().user?.role === "coach",
      isStaff:     () => ["owner","coach","assistant"].includes(useAuthStore.getState().user?.role),
    }),
    { name: "gym-pro-auth" }
  )
);
