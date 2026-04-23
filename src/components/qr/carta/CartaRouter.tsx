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
import HappyHourBanner, { getActiveHappyHour, applyHappyHourPrices } from "./HappyHourBanner";
import ProfileDrawer from "../auth/ProfileDrawer";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { LangProvider } from "@/contexts/LangContext";
import FavoritesToasts from "./FavoritesToasts";
import NameModal from "../auth/NameModal";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import type { Lang } from "@/lib/qr/i18n";

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
  isQrScan?: boolean;
  marketingPromos?: any[];
  initialView?: string;
  lang?: Lang;
  happyHours?: any[];
}

export default function CartaRouter(props: Props) {
  const lang = props.lang || "es";
  const { view, isReady } = useCartaView((props.restaurant as any).defaultView, props.initialView);
  const trackedRef = useRef<string | null>(null);
  // Check cookie instantly to avoid flash of "not logged in"
  const [qrUser, setQrUser] = useState<any>(() => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/qr_user_id=([^;]*)/);
    return match ? { _pending: true } : null;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const { overlay, fadeOut } = useViewTransition();
  const readyKeyRef = useRef(0);
  const prevViewRef = useRef(view);

  // Track view changes for readyKey
  if (prevViewRef.current !== view) {
    readyKeyRef.current += 1;
    prevViewRef.current = view;
  }

  // Fetch user once — show name modal if logged in but no name
  useEffect(() => {
    fetch("/api/qr/user/me").then((r) => r.json()).then((d) => {
      if (d.user) {
        setQrUser(d.user);
        if (d.user.id && !d.user.name && !sessionStorage.getItem("qc_name_modal_shown")) {
          sessionStorage.setItem("qc_name_modal_shown", "1");
          setTimeout(() => setShowNameModal(true), 1500);
        }
      }
    }).catch(() => {});
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
    startSession(props.restaurant.id, props.tableId, props.isQrScan);
  }, [props.restaurant.id, props.tableId, props.isQrScan]);

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
  const activeHH = getActiveHappyHour(props.happyHours || []);
  const pricedDishes = activeHH ? applyHappyHourPrices(props.dishes, activeHH) : props.dishes;
  const sharedProps = { ...props, dishes: pricedDishes, qrUser, onProfileOpen: () => setProfileOpen(true), onReady: onViewReady, readyKey, showWaiter };

  return (
    <LangProvider value={lang}>
      <FavoritesProvider>
        <HappyHourBanner happyHours={props.happyHours || []} />
        {view === "premium" && <CartaPremium {...sharedProps} />}
        {view === "lista" && <CartaLista {...sharedProps} />}
        {view === "viaje" && <CartaViaje {...sharedProps} />}

        {overlay && (
          <div
            className="fixed flex flex-col items-center justify-center font-[family-name:var(--font-dm)]"
            style={{
              top: 0, left: 0, right: 0, bottom: 0, minHeight: "100dvh",
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

        <FavoritesToasts />

        {showNameModal && (
          <NameModal onSave={(name) => { setShowNameModal(false); setQrUser((prev: any) => prev ? { ...prev, name } : prev); }} />
        )}

        <style>{`
          @keyframes genioFloat {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
            50% { transform: translateY(-8px) scale(1.15); opacity: 1; }
          }
        `}</style>
      </FavoritesProvider>
    </LangProvider>
  );
}
