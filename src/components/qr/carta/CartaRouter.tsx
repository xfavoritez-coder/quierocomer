"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Sparkles, List, BookOpen, Rocket, LayoutGrid } from "lucide-react";
import { useCartaView } from "./hooks/useCartaView";
import { useViewTransition, hideViewTransition } from "./hooks/useViewTransition";
import { startSession, trackViewSelected, setCartaLang } from "@/lib/sessionTracker";
import { setMesaToken, hasMesaToken } from "@/lib/mesaToken";
import { canAccess } from "@/lib/plans";
import CartaPremium from "./CartaPremium";
import CartaLista from "./CartaLista";
import CartaImpact from "./CartaImpact";
import CartaFeed from "./CartaFeed";
import CartaEsencial from "./CartaEsencial";
import HappyHourBanner, { getActiveHappyHour, applyHappyHourPrices } from "./HappyHourBanner";
import CategoryLobby from "./CategoryLobby";
import MenuSwitcher from "./MenuSwitcher";
import ProfileDrawer from "../auth/ProfileDrawer";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { LangProvider } from "@/contexts/LangContext";
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
  timeOfDay?: string;
  weather?: string;
  popularDishIds?: string[];
  announcements?: { id: string; text: string; linkUrl: string | null }[];
  menuGroups?: { slug: string; name: string }[];
  activeMenuSlug?: string;
}

export default function CartaRouter(props: Props) {
  const lang = props.lang || "es";
  useEffect(() => { setCartaLang(lang); }, [lang]);
  const { view, isReady, demoFading } = useCartaView((props.restaurant as any).defaultView, props.initialView);
  const trackedRef = useRef<string | null>(null);
  // Check cookie instantly to avoid flash of "not logged in"
  const [qrUser, setQrUser] = useState<any>(() => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/qr_user_id=([^;]*)/);
    return match ? { _pending: true } : null;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const lobbyEnabled = !!(props.restaurant as any).showCategoryLobby;
  // Lobby needs at least 3 active categories with active dishes to show
  const hasEnoughForLobby = lobbyEnabled && (() => {
    const activeCats = props.categories.filter(c => c.isActive);
    const withDishes = activeCats.filter(c => props.dishes.some(d => d.categoryId === c.id && d.isActive));
    return withDishes.length >= 3;
  })();
  const showLobby = hasEnoughForLobby;
  const [lobbyDismissed, setLobbyDismissed] = useState(false);

  // Browser back button returns to lobby
  useEffect(() => {
    if (!showLobby) return;
    const onPopState = () => {
      if (lobbyDismissed) {
        setLobbyDismissed(false);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [showLobby, lobbyDismissed]);
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

  // Persist QR scan flag in sessionStorage so it survives view changes & in-app browser URL stripping
  const isQrScan = (() => {
    if (typeof window === "undefined") return props.isQrScan || false;
    const key = `qr_scan_${props.restaurant.id}`;
    if (props.isQrScan) {
      sessionStorage.setItem(key, "1");
      return true;
    }
    if (sessionStorage.getItem(key) === "1") return true;
    // Heuristic: in-app browsers (Instagram, WhatsApp) strip query params
    // If referrer is empty and we're on a /qr/ page, likely a QR scan
    const ua = navigator.userAgent;
    const isInApp = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(ua);
    if (isInApp) {
      sessionStorage.setItem(key, "1");
      return true;
    }
    return false;
  })();

  // Botón de Garzón: siempre visible para locales Premium con la feature
  // habilitada — el botón abre un modal que pregunta el número de mesa si
  // el cliente no llegó por QR escaneado. Antes el botón sólo aparecía
  // bajo condiciones específicas (QR scan, ?mesa=, token persistido), y
  // los clientes que entraban por link directo no podían llamar al mozo
  // aunque el local lo tuviera contratado.
  const waiterEnabled = (props.restaurant as any).waiterPanelActive !== false;
  const restaurantPlan = (props.restaurant as any).plan;
  const hasWaiterFeature = canAccess(restaurantPlan, "waiter");
  const [showWaiter, setShowWaiter] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!waiterEnabled || !hasWaiterFeature) { setShowWaiter(false); return; }

    // Persistir mesa token si llegó vía URL con ?mesa= (efecto separado del
    // gating del botón).
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get("mesa");
    const isDemo = params.get("demo") === "true";
    if (mesa) setMesaToken(props.restaurant.id, mesa, isDemo);

    setShowWaiter(true);
  }, [props.restaurant.id, isQrScan, waiterEnabled, hasWaiterFeature]);

  // Start session tracking
  useEffect(() => {
    startSession(props.restaurant.id, props.tableId, isQrScan);
  }, [props.restaurant.id, props.tableId, isQrScan]);

  // Track view changes
  useEffect(() => {
    if (isReady) trackViewSelected(view);
  }, [view, isReady]);

  // Child calls this when mounted — dismiss overlay with minimum visible time
  const overlayShownAt = useRef(0);
  useEffect(() => {
    if (overlay) overlayShownAt.current = Date.now();
  }, [overlay]);
  const onViewReady = useCallback(() => {
    const elapsed = Date.now() - overlayShownAt.current;
    const minVisible = 400;
    if (elapsed >= minVisible) {
      hideViewTransition();
    } else {
      setTimeout(() => hideViewTransition(), minVisible - elapsed);
    }
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

  // ═══ Demo onboarding: temporary lang override ═══
  const [demoLang, setDemoLang] = useState<string | null>(null);
  useEffect(() => {
    const handle = (e: Event) => {
      const next = (e as CustomEvent).detail?.lang;
      // If restoring to original lang, clear override
      if (next === lang) { setDemoLang(null); return; }
      if (next) setDemoLang(next);
    };
    window.addEventListener("demo-onboarding-change-lang", handle);
    return () => window.removeEventListener("demo-onboarding-change-lang", handle);
  }, [lang]);
  // Use demoLang override when set (null = no override)
  const effectiveLang = (demoLang || lang) as typeof lang;

  // ═══ Demo onboarding: temporary genio reorder ═══
  const [demoGenio, setDemoGenio] = useState<string | null>(null);
  useEffect(() => {
    const simulate = (e: Event) => {
      const diet = (e as CustomEvent).detail?.diet;
      if (diet) setDemoGenio(diet);
    };
    const restore = () => setDemoGenio(null);
    window.addEventListener("demo-onboarding-simulate-genio", simulate);
    window.addEventListener("demo-onboarding-restore-genio", restore);
    return () => {
      window.removeEventListener("demo-onboarding-simulate-genio", simulate);
      window.removeEventListener("demo-onboarding-restore-genio", restore);
    };
  }, []);

  // Popular dishes come from server (QR page), convert once to Set
  const popularSet = useRef(new Set(props.popularDishIds || []));

  const readyKey = readyKeyRef.current;
  const activeHH = getActiveHappyHour(props.happyHours || []);
  const hhDishes = activeHH ? applyHappyHourPrices(props.dishes, activeHH) : props.dishes;

  // Inject promo discountPrice for dishes in active marketing promotions
  const pricedDishes = useMemo(() => {
    const promos: any[] = props.marketingPromos || [];
    const promoMap = new Map<string, number>();
    for (const p of promos) {
      if (!p.promoPrice) continue;
      // marketingPromos have dishes: [{id, name, ...}] not dishIds
      const ids: string[] = p.dishIds || (p.dishes || []).map((d: any) => d.id);
      for (const did of ids) {
        if (!promoMap.has(did)) promoMap.set(did, p.promoPrice);
      }
    }
    if (promoMap.size === 0) return hhDishes;
    return hhDishes.map((d: any) => {
      if (d.discountPrice) return d;
      const pp = promoMap.get(d.id);
      if (!pp) return d;
      return { ...d, discountPrice: pp };
    });
  }, [hhDishes, props.marketingPromos]);

  // Apply demo genio reorder: push vegan dishes to top
  const orderedDishes = (() => {
    if (!demoGenio) return pricedDishes;
    const vegan = pricedDishes.filter((d: any) => d.dishDiet === "VEGAN" || d.dishDiet === "VEGETARIAN");
    const rest = pricedDishes.filter((d: any) => d.dishDiet !== "VEGAN" && d.dishDiet !== "VEGETARIAN");
    return [...vegan, ...rest];
  })();

  const plan = (props.restaurant as any).plan || "FREE";
  const showViewSelector = canAccess(plan, "view_selector");

  // Force view based on plan
  const effectiveView = (() => {
    if (view === "feed" && !canAccess(plan, "view_feed")) return "lista";
    if (view === "impact" && !canAccess(plan, "view_space")) return "lista";
    if (view === "premium" && !canAccess(plan, "view_gallery")) return "lista";
    return view;
  })();

  const sharedProps = { ...props, dishes: orderedDishes, qrUser, onProfileOpen: () => setProfileOpen(true), onReady: onViewReady, readyKey, showWaiter, popularDishIds: popularSet.current, showViewSelector };

  return (
    <LangProvider value={effectiveLang}>
      <FavoritesProvider>
        {props.menuGroups && props.activeMenuSlug && (
          <MenuSwitcher menuGroups={props.menuGroups} activeMenuSlug={props.activeMenuSlug} accentColor={(props.restaurant as any).cartaAccentColor} />
        )}
        {effectiveView !== "impact" && !(props.announcements?.length) && <HappyHourBanner happyHours={props.happyHours || []} />}
        {showLobby && !lobbyDismissed ? (
          <CategoryLobby
            categories={props.categories}
            dishes={orderedDishes}
            restaurantName={props.restaurant.name}
            logoUrl={props.restaurant.logoUrl}
            accentColor={(props.restaurant as any).cartaAccentColor}
            onSelectCategory={(catId) => {
              history.pushState({ lobby: true }, "");
              setLobbyDismissed(true);
              const scrollToCategory = () => {
                const el = document.querySelector(`[id$="-cat-${catId}"]`);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 20;
                  window.scrollTo({ top: y, behavior: "smooth" });
                  return true;
                }
                return false;
              };
              // Retry until element is rendered
              let attempts = 0;
              const tryScroll = () => {
                if (scrollToCategory() || attempts++ > 15) return;
                setTimeout(tryScroll, 100);
              };
              setTimeout(tryScroll, 150);
            }}
            onSkip={() => { history.pushState({ lobby: true }, ""); setLobbyDismissed(true); window.scrollTo({ top: 0 }); }}
          />
        ) : (
        <div style={{ position: "relative" }}>
          {effectiveView === "lista" && <CartaLista {...sharedProps} />}
          {effectiveView === "feed" && <CartaFeed {...sharedProps} />}
          {effectiveView === "impact" && <CartaImpact {...sharedProps} />}
          {effectiveView === "esencial" && <CartaEsencial {...sharedProps} />}
          {effectiveView === "premium" && <CartaPremium {...sharedProps} />}
          {demoFading && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none",
              background: document.body.getAttribute("data-onboarding-flash") === "white" ? "white" : "black",
              opacity: demoFading === "flash" ? 1 : 0,
              transition: demoFading === "reveal" ? "opacity 0.35s ease-out" : "opacity 0.06s ease-in",
            }} />
          )}
        </div>
        )}


        {overlay && (
          <div
            className="fixed flex flex-col items-center justify-center font-[family-name:var(--font-dm)]"
            style={{
              top: 0, left: 0, right: 0, bottom: 0, minHeight: "100dvh",
              zIndex: 200,
              background: "rgba(14,14,14,0.85)",
              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              opacity: fadeOut ? 0 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <div style={{ animation: "genioFloat 1.5s ease-in-out infinite" }}>
              {overlay.view === "lista" && <List size={26} color="#F4A623" style={{ filter: "drop-shadow(0 0 10px rgba(244,166,35,0.4))" }} />}
              {overlay.view === "premium" && <BookOpen size={26} color="#F4A623" style={{ filter: "drop-shadow(0 0 10px rgba(244,166,35,0.4))" }} />}
              {overlay.view === "feed" && <LayoutGrid size={26} color="#F4A623" style={{ filter: "drop-shadow(0 0 10px rgba(244,166,35,0.4))" }} />}
              {overlay.view === "impact" && <Rocket size={26} color="#F4A623" style={{ filter: "drop-shadow(0 0 10px rgba(244,166,35,0.4))" }} />}
            </div>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", fontWeight: 500, marginTop: 14 }}>Vista {overlay.label}</p>
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


