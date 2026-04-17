"use client";

import { useEffect, useRef } from "react";
import { useCartaView } from "./hooks/useCartaView";
import CartaPremium from "./CartaPremium";
import CartaLista from "./CartaLista";
import ViewSelector from "./ViewSelector";
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

  // Scroll to top when switching views
  useEffect(() => {
    if (isReady) window.scrollTo({ top: 0 });
  }, [view, isReady]);

  return (
    <>
      {/* Both views always mounted, toggle with display */}
      <div style={{ display: (!isReady || view === "premium" || view === "viaje") ? "block" : "none" }}>
        <CartaPremium {...props} />
      </div>
      {isReady && (
        <div style={{ display: view === "lista" ? "block" : "none" }}>
          <CartaLista {...props} />
        </div>
      )}

      {/* Floating ViewSelector — above Genio button */}
      {isReady && (
        <div className="fixed z-50" style={{ right: 20, bottom: 114 }}>
          <ViewSelector restaurantId={props.restaurant.id} />
        </div>
      )}
    </>
  );
}
