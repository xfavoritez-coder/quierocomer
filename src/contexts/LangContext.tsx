"use client";

import { createContext, useContext } from "react";
import type { Lang } from "@/lib/qr/i18n";

const LangContext = createContext<Lang>("es");

export const LangProvider = LangContext.Provider;

export function useLang(): Lang {
  return useContext(LangContext);
}
