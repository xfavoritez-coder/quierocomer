"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type CartaView = "premium" | "lista" | "viaje" | "feed";

const STORAGE_KEY = "quierocomer_carta_view";
const FALLBACK_VIEW: CartaView = "premium";
const VALID_VIEWS: CartaView[] = ["premium", "lista", "viaje", "feed"];

function isValidView(v: string | null): v is CartaView {
  return v !== null && VALID_VIEWS.includes(v as CartaView);
}

export function useCartaView(restaurantDefaultView?: string | null, serverView?: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve initial view synchronously to avoid flash:
  // If serverView is provided (from SSR), use it immediately.
  // Then on client, localStorage may override it.
  const initialView: CartaView = isValidView(serverView ?? null)
    ? (serverView as CartaView)
    : isValidView(restaurantDefaultView ?? null)
      ? (restaurantDefaultView as CartaView)
      : FALLBACK_VIEW;

  const [view, setViewState] = useState<CartaView>(initialView);
  // Start ready immediately when serverView is provided
  const [isReady, setIsReady] = useState(!!serverView);

  useEffect(() => {
    // URL param ?vista= wins (for previewing)
    const urlView = searchParams.get("vista");
    if (isValidView(urlView)) {
      setViewState(urlView);
      setIsReady(true);
      return;
    }
    // Otherwise use restaurant default
    if (isValidView(restaurantDefaultView ?? null)) {
      setViewState(restaurantDefaultView as CartaView);
    }
    setIsReady(true);
  }, [searchParams, restaurantDefaultView]);

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
