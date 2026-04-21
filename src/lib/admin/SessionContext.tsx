"use client";

import { createContext, useContext } from "react";

export interface SessionData {
  role: "SUPERADMIN" | "OWNER" | string;
  name: string;
  restaurants: { id: string; name: string; slug: string }[];
  selectedRestaurantId: string | null;
  isSuper: boolean;
  loading: boolean;
  error: boolean;
  setSelectedRestaurant: (id: string) => void;
  logout: () => void;
}

export const SessionContext = createContext<SessionData | null>(null);

export function useSessionContext(): SessionData | null {
  return useContext(SessionContext);
}
