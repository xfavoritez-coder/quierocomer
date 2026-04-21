"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  count: number;
  isFavorite: (dishId: string) => boolean;
  toggleFavorite: (dishId: string, restaurantId: string) => Promise<void>;
  isFirstFavorite: boolean;
  showConversionPrompt: boolean;
  dismissConversion: () => void;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteIds: new Set(),
  count: 0,
  isFavorite: () => false,
  toggleFavorite: async () => {},
  isFirstFavorite: false,
  showConversionPrompt: false,
  dismissConversion: () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isFirstFavorite, setIsFirstFavorite] = useState(false);
  const [showConversionPrompt, setShowConversionPrompt] = useState(false);
  const hasFetchedRef = useRef(false);

  // Load favorites on mount
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetch("/api/qr/favorites")
      .then((r) => r.json())
      .then((d) => {
        if (d.dishIds) setFavoriteIds(new Set(d.dishIds));
      })
      .catch(() => {});
  }, []);

  const isFavorite = useCallback((dishId: string) => favoriteIds.has(dishId), [favoriteIds]);

  const toggleFavorite = useCallback(async (dishId: string, restaurantId: string) => {
    const wasFavorite = favoriteIds.has(dishId);

    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(dishId);
      else next.add(dishId);
      return next;
    });

    try {
      if (wasFavorite) {
        await fetch(`/api/qr/favorites?dishId=${dishId}`, { method: "DELETE" });
      } else {
        const res = await fetch("/api/qr/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dishId, restaurantId }),
        });
        const data = await res.json();

        // First favorite in session — show educational toast
        if (!wasFavorite && !sessionStorage.getItem("qc_favorites_tip_seen")) {
          setIsFirstFavorite(true);
          sessionStorage.setItem("qc_favorites_tip_seen", "1");
          setTimeout(() => setIsFirstFavorite(false), 6000);
        }

        // At 3 favorites and not logged in — show conversion prompt
        if (data.totalFavorites === 3 && !document.cookie.includes("qr_user_id") && !localStorage.getItem("qc_favorites_conversion_shown")) {
          localStorage.setItem("qc_favorites_conversion_shown", "1");
          setShowConversionPrompt(true);
        }
      }
    } catch {
      // Revert optimistic update on error
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(dishId);
        else next.delete(dishId);
        return next;
      });
    }
  }, [favoriteIds]);

  const dismissConversion = useCallback(() => setShowConversionPrompt(false), []);

  return (
    <FavoritesContext.Provider value={{
      favoriteIds,
      count: favoriteIds.size,
      isFavorite,
      toggleFavorite,
      isFirstFavorite,
      showConversionPrompt,
      dismissConversion,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
