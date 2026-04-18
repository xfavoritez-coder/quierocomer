"use client";

import { useEffect, useRef, lazy, Suspense } from "react";
import { useCartaView } from "./hooks/useCartaView";
import CartaPremium from "./CartaPremium";
import CartaLista from "./CartaLista";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";

const CartaViaje = lazy(() => import("./CartaViaje"));

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

function ViajeLoader() {
  return (
    <div style={{ height: "100vh", background: "black", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid rgba(244,166,35,0.3)", borderTopColor: "#F4A623", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
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

  useEffect(() => {
    if (isReady) window.scrollTo({ top: 0 });
  }, [view, isReady]);

  if (!isReady) {
    return <CartaPremium {...props} />;
  }

  if (view === "viaje") {
    return (
      <>
        <Suspense fallback={<ViajeLoader />}>
          <CartaViaje {...props} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <div style={{ display: view === "premium" ? "block" : "none" }}>
        <CartaPremium {...props} />
      </div>
      <div style={{ display: view === "lista" ? "block" : "none" }}>
        <CartaLista {...props} />
      </div>
    </>
  );
}
