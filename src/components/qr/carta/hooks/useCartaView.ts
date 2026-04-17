"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type CartaView = "premium" | "lista" | "viaje";

const STORAGE_KEY = "quierocomer_carta_view";
const DEFAULT_VIEW: CartaView = "premium";
const VALID_VIEWS: CartaView[] = ["premium", "lista", "viaje"];

function isValidView(v: string | null): v is CartaView {
  return v !== null && VALID_VIEWS.includes(v as CartaView);
}

export function useCartaView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<CartaView>(DEFAULT_VIEW);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const urlView = searchParams.get("vista");
    if (isValidView(urlView)) {
      setViewState(urlView);
      setIsReady(true);
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (isValidView(stored)) {
      setViewState(stored);
    }
    setIsReady(true);
  }, [searchParams]);

  const setView = useCallback(
    (next: CartaView) => {
      setViewState(next);
      localStorage.setItem(STORAGE_KEY, next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("vista", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { view, setView, isReady };
}
