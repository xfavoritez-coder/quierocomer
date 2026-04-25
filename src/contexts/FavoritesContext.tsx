"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getGuestId } from "@/lib/guestId";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  count: number;
  isFavorite: (dishId: string) => boolean;
  toggleFavorite: (dishId: string, restaurantId: string) => Promise<void>;
  hasNewLikes: boolean;
  clearNewLikes: () => void;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteIds: new Set(),
  count: 0,
  isFavorite: () => false,
  toggleFavorite: async () => {},
  hasNewLikes: false,
  clearNewLikes: () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
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

  const [hasNewLikes, setHasNewLikes] = useState(false);
  const clearNewLikes = useCallback(() => setHasNewLikes(false), []);

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
        await fetch("/api/qr/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dishId, restaurantId }),
        });

        // Feed ingredient preferences from this dish
        setHasNewLikes(true);
        fetch("/api/qr/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId: getGuestId(), dishIds: [dishId], source: "favorite" }),
        }).catch(() => {});

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

  return (
    <FavoritesContext.Provider value={{
      favoriteIds,
      count: favoriteIds.size,
      isFavorite,
      toggleFavorite,
      hasNewLikes,
      clearNewLikes,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
