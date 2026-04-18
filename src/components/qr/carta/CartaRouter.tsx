"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, List, BookOpen, Rocket } from "lucide-react";
import { useCartaView } from "./hooks/useCartaView";
import { useViewTransition, hideViewTransition } from "./hooks/useViewTransition";
import { startSession, trackViewSelected } from "@/lib/sessionTracker";
import { setMesaToken, hasMesaToken } from "@/lib/mesaToken";
import CartaPremium from "./CartaPremium";
import CartaLista from "./CartaLista";
import CartaViaje from "./CartaViaje";
import ProfileDrawer from "../auth/ProfileDrawer";
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
  // Check cookie instantly to avoid flash of "not logged in"
  const [qrUser, setQrUser] = useState<any>(() => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/qr_user_id=([^;]*)/);
    return match ? { _pending: true } : null;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const { overlay, fadeOut } = useViewTransition();
  const readyKeyRef = useRef(0);
  const prevViewRef = useRef(view);

  // Track view changes for readyKey
  if (prevViewRef.current !== view) {
    readyKeyRef.current += 1;
    prevViewRef.current = view;
  }

  // Fetch user once
  useEffect(() => {
    fetch("/api/qr/user/me").then((r) => r.json()).then((d) => { if (d.user) setQrUser(d.user); }).catch(() => {});
  }, []);

  // Set mesa token if arriving from table QR
  const [showWaiter, setShowWaiter] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get("mesa");
    const isDemo = params.get("demo") === "true";
    if (mesa) {
      setMesaToken(props.restaurant.id, mesa, isDemo);
      setShowWaiter(true);
    } else {
      setShowWaiter(hasMesaToken(props.restaurant.id));
    }
  }, [props.restaurant.id]);

  // Start session tracking
  useEffect(() => {
    startSession(props.restaurant.id, props.tableId);
  }, [props.restaurant.id, props.tableId]);

  // Track view changes
  useEffect(() => {
    if (isReady) trackViewSelected(view);
  }, [view, isReady]);

  // Child calls this when mounted — dismiss overlay
  const onViewReady = useCallback(() => {
    hideViewTransition();
  }, []);

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

  const readyKey = readyKeyRef.current;
  const sharedProps = { ...props, qrUser, onProfileOpen: () => setProfileOpen(true), onReady: onViewReady, readyKey, showWaiter };

  return (
    <>
      {(!isReady || view === "premium") && <CartaPremium {...sharedProps} />}
      {isReady && view === "lista" && <CartaLista {...sharedProps} />}
      {isReady && view === "viaje" && <CartaViaje {...sharedProps} />}

      {overlay && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center font-[family-name:var(--font-dm)]"
          style={{
            zIndex: 200,
            background: "#0e0e0e",
            opacity: fadeOut ? 0 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          <div style={{ animation: "genioFloat 1.5s ease-in-out infinite" }}>
            {overlay.view === "lista" && <List size={28} color="#F4A623" style={{ filter: "drop-shadow(0 0 12px rgba(244,166,35,0.5))" }} />}
            {overlay.view === "premium" && <BookOpen size={28} color="#F4A623" style={{ filter: "drop-shadow(0 0 12px rgba(244,166,35,0.5))" }} />}
            {overlay.view === "viaje" && <Rocket size={28} color="#F4A623" style={{ filter: "drop-shadow(0 0 12px rgba(244,166,35,0.5))" }} />}
          </div>
          <p style={{ color: "white", fontSize: "1.1rem", fontWeight: 600, marginTop: 20 }}>
            Cargando vista {overlay.label}
          </p>
        </div>
      )}

      {profileOpen && (
        <ProfileDrawer
          qrUser={qrUser}
          restaurantId={props.restaurant.id}
          onClose={() => setProfileOpen(false)}
          onLogout={() => { setQrUser(null); setProfileOpen(false); }}
        />
      )}

      <style>{`
        @keyframes genioFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-8px) scale(1.15); opacity: 1; }
        }
      `}</style>
    </>
  );
}
