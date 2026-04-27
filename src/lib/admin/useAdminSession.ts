"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useSessionContext } from "./SessionContext";

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  qrToken?: string | null;
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

// ── Global store so all components share the same state ──
let _session: AdminSession = {
  role: "OWNER",
  name: "",
  restaurants: [],
  selectedRestaurantId: null,
  isSuper: false,
  loading: true,
  error: false,
};
let _listeners = new Set<() => void>();
let _fetched = false;

function notify() {
  _listeners.forEach((l) => l());
}

function getSnapshot() {
  return _session;
}

function subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

function fetchSession() {
  if (_fetched) return;
  _fetched = true;

  fetch("/api/admin/me")
    .then((r) => {
      if (!r.ok) throw new Error("Not auth");
      return r.json();
    })
    .then((data) => {
      const savedId = typeof window !== "undefined" ? localStorage.getItem(SELECTED_KEY) : null;
      const validSaved = data.restaurants.some((r: AdminRestaurant) => r.id === savedId);
      _session = {
        role: data.role,
        name: data.name,
        restaurants: data.restaurants,
        selectedRestaurantId: validSaved ? savedId : (data.selectedRestaurantId || data.restaurants[0]?.id || null),
        isSuper: data.role === "SUPERADMIN",
        loading: false,
        error: false,
      };
      notify();
    })
    .catch(() => {
      _session = { ..._session, loading: false, error: true };
      notify();
    });
}

export function useAdminSession() {
  // If a SessionContext provider is wrapping us (panel or admin layout), use that
  const ctxSession = useSessionContext();

  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!ctxSession) fetchSession();
  }, [ctxSession]);

  const setSelectedRestaurant = useCallback((id: string) => {
    localStorage.setItem(SELECTED_KEY, id);
    _session = { ..._session, selectedRestaurantId: id };
    notify();
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    sessionStorage.removeItem("admin_session");
    localStorage.removeItem(SELECTED_KEY);
    _fetched = false;
    window.location.href = "/admin/login";
  }, []);

  if (ctxSession) return ctxSession;
  return { ...session, setSelectedRestaurant, logout };
}
