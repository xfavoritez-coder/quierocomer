"use client";

import { useState, useEffect, useCallback } from "react";

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
}

export interface AdminSession {
  role: "SUPERADMIN" | "OWNER";
  name: string;
  restaurants: AdminRestaurant[];
  selectedRestaurantId: string | null;
  isSuper: boolean;
  loading: boolean;
  error: boolean;
}

const SELECTED_KEY = "admin_selected_restaurant";

export function useAdminSession(): AdminSession & { setSelectedRestaurant: (id: string) => void; logout: () => Promise<void> } {
  const [session, setSession] = useState<AdminSession>({
    role: "OWNER",
    name: "",
    restaurants: [],
    selectedRestaurantId: null,
    isSuper: false,
    loading: true,
    error: false,
  });

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not auth");
        return r.json();
      })
      .then((data) => {
        const savedId = localStorage.getItem(SELECTED_KEY);
        const validSaved = data.restaurants.some((r: AdminRestaurant) => r.id === savedId);
        setSession({
          role: data.role,
          name: data.name,
          restaurants: data.restaurants,
          selectedRestaurantId: validSaved ? savedId : (data.selectedRestaurantId || data.restaurants[0]?.id || null),
          isSuper: data.role === "SUPERADMIN",
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        setSession((s) => ({ ...s, loading: false, error: true }));
      });
  }, []);

  const setSelectedRestaurant = useCallback((id: string) => {
    localStorage.setItem(SELECTED_KEY, id);
    setSession((s) => ({ ...s, selectedRestaurantId: id }));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    sessionStorage.removeItem("admin_session"); // clear legacy too
    localStorage.removeItem(SELECTED_KEY);
    window.location.href = "/admin/login";
  }, []);

  return { ...session, setSelectedRestaurant, logout };
}
