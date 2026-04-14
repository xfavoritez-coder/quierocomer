"use client";
import { createContext, useContext } from "react";

export interface TimeTheme {
  period: string;
  accent: string;
  icon: string;
}

const defaultTheme: TimeTheme = { period: "dia", accent: "#FFD600", icon: "" };

export const ThemeContext = createContext<TimeTheme>(defaultTheme);

export function useTheme(): TimeTheme {
  return useContext(ThemeContext);
}
