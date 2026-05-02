"use client";
import { useCallback, useEffect, useState } from "react";

export type SortKey = "default" | "views" | "sales" | "price-asc" | "price-desc";

interface Rankings {
  views: Record<string, number>;
  sales: { mode: "today" | "week" | null; byDish: Record<string, number>; total: number };
}

const SORT_STORAGE_PREFIX = "qc_carta_sort:";

/**
 * Sort selector state for the QR carta — persists per restaurant in
 * sessionStorage so the choice survives navigation but resets on a fresh
 * tab. Also fetches the per-dish rankings (views + adaptive sales) on mount.
 */
export function useCartaSort(restaurantId: string) {
  const storageKey = `${SORT_STORAGE_PREFIX}${restaurantId}`;
  const [sortKey, setSortKeyState] = useState<SortKey>("default");
  const [rankings, setRankings] = useState<Rankings | null>(null);

  // Hydrate persisted choice
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved && ["default", "views", "sales", "price-asc", "price-desc"].includes(saved)) {
        setSortKeyState(saved as SortKey);
      }
    } catch {}
  }, [storageKey]);

  const setSortKey = useCallback((key: SortKey) => {
    setSortKeyState(key);
    try {
      if (typeof window !== "undefined") sessionStorage.setItem(storageKey, key);
    } catch {}
  }, [storageKey]);

  // Fetch rankings once per restaurantId (endpoint is cached server-side).
  useEffect(() => {
    if (!restaurantId) return;
    let aborted = false;
    fetch(`/api/qr/dish-rankings?restaurantId=${restaurantId}`)
      .then((r) => r.json())
      .then((d) => { if (!aborted && !d.error) setRankings(d); })
      .catch(() => {});
    return () => { aborted = true; };
  }, [restaurantId]);

  return { sortKey, setSortKey, rankings };
}

/**
 * Apply the chosen sort to a list of dishes. For "default" we return the
 * input untouched so the caller's existing logic (Genio personalization,
 * RECOMMENDED tag, position) keeps working.
 */
export function applyCartaSort<T extends { id: string; price: number }>(
  dishes: T[],
  sortKey: SortKey,
  rankings: Rankings | null,
): T[] {
  if (sortKey === "default") return dishes;

  const score = (d: T): number => {
    if (sortKey === "views") return rankings?.views?.[d.id] ?? 0;
    if (sortKey === "sales") return rankings?.sales?.byDish?.[d.id] ?? 0;
    if (sortKey === "price-asc") return d.price ?? 0;
    if (sortKey === "price-desc") return d.price ?? 0;
    return 0;
  };

  const sorted = [...dishes].sort((a, b) => {
    const aS = score(a);
    const bS = score(b);
    if (sortKey === "price-asc") return aS - bS;
    return bS - aS;
  });
  return sorted;
}
