"use client";

import { useEffect, useRef } from "react";
import { useCartaView } from "./hooks/useCartaView";
import CartaPremium from "./CartaPremium";
import CartaLista from "./CartaLista";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";

interface Review {
  id: string;
  dishId: string;
  rating: number;
  customerId: string;
  createdAt: Date;
}

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  promotions: RestaurantPromotion[];
  ratingMap: Record<string, { avg: number; count: number }>;
  reviews: Review[];
  tableId?: string;
}

export default function CartaRouter(props: Props) {
  const { view, isReady } = useCartaView();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    const key = `${view}:${props.restaurant.id}`;
    if (trackedRef.current === key) return;
    trackedRef.current = key;

    import("./utils/cartaAnalytics").then(({ trackCartaViewLoaded }) => {
      trackCartaViewLoaded(props.restaurant.id, view);
    }).catch(() => {});
  }, [view, isReady, props.restaurant.id]);

  // Before ready, render Premium to avoid flash
  if (!isReady) {
    return <CartaPremium {...props} />;
  }

  if (view === "lista") {
    return <CartaLista {...props} />;
  }

  // "viaje" falls back to Premium for now
  return <CartaPremium {...props} />;
}
