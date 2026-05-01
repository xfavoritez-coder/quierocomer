"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

interface PanelRestaurant {
  id: string;
  name: string;
  slug: string;
  qrToken?: string | null;
  plan?: string;
}

export interface PanelSession {
  role: string;
  name: string;
  restaurants: PanelRestaurant[];
  selectedRestaurantId: string | null;
  loading: boolean;
  error: boolean;
  mustChangePassword: boolean;
}

const SELECTED_KEY = "panel_selected_restaurant";

// ── Global store for panel (separate from admin) ──
let _session: PanelSession = {
  role: "OWNER",
  name: "",
  restaurants: [],
  selectedRestaurantId: null,
  loading: true,
  error: false,
  mustChangePassword: false,
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

  fetch("/api/panel/me")
    .then((r) => {
      if (!r.ok) throw new Error("Not auth");
      return r.json();
    })
    .then((data) => {
      const savedId = typeof window !== "undefined" ? localStorage.getItem(SELECTED_KEY) : null;
      const validSaved = data.restaurants.some((r: PanelRestaurant) => r.id === savedId);
      _session = {
        role: data.role,
        name: data.name,
        restaurants: data.restaurants,
        selectedRestaurantId: validSaved ? savedId : (data.selectedRestaurantId || data.restaurants[0]?.id || null),
        loading: false,
        error: false,
        mustChangePassword: data.mustChangePassword || false,
      };
      notify();
    })
    .catch(() => {
      _session = { ..._session, loading: false, error: true };
      notify();
    });
}

/** Call before navigating to /panel after login to ensure fresh fetch */
export function resetPanelSession() {
  _fetched = false;
  _session = {
    role: "OWNER",
    name: "",
    restaurants: [],
    selectedRestaurantId: null,
    loading: true,
    error: false,
    mustChangePassword: false,
  };
  notify();
}

export function usePanelSession() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    fetchSession();
  }, []);

  const setSelectedRestaurant = useCallback((id: string) => {
    localStorage.setItem(SELECTED_KEY, id);
    _session = { ..._session, selectedRestaurantId: id };
    notify();
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/panel/logout", { method: "POST" });
    sessionStorage.removeItem("panel_session");
    localStorage.removeItem(SELECTED_KEY);
    _fetched = false;
    _session = {
      role: "OWNER",
      name: "",
      restaurants: [],
      selectedRestaurantId: null,
      loading: true,
      error: false,
      mustChangePassword: false,
    };
    window.location.href = "/panel/login";
  }, []);

  const clearMustChangePassword = useCallback(() => {
    _session = { ..._session, mustChangePassword: false };
    notify();
  }, []);

  const activePlan = session.restaurants.find(r => r.id === session.selectedRestaurantId)?.plan || "FREE";

  return { ...session, setSelectedRestaurant, logout, clearMustChangePassword, activePlan };
}
