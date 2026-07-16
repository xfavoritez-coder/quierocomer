"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import HeroDish from "./HeroDish";
import CategoryNav from "./CategoryNav";
import DishCard from "./DishCard";
import DishDetail from "./DishDetail";
import DishDetailErrorBoundary from "./DishDetailErrorBoundary";
import { Search, X } from "lucide-react";
import WaiterButton from "../garzon/WaiterButton";
import BirthdayAutoModal from "../capture/BirthdayAutoModal";
import { norm } from "@/lib/normalize";
import { useClientAvoidsSpicy } from "./SpicyStamp";
import { canAccess, effectivePlan } from "@/lib/plans";
import { getGuestId } from "@/lib/guestId";
import { trackCategoryDwell } from "@/lib/sessionTracker";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import { trackSearchPerformed, track, flushEvents } from "./utils/cartaAnalytics";
import CartaFilterBar, { applyCartaFilter } from "./CartaFilterBar";
import type { CartaFilterKey } from "./CartaFilterBar";
import { getPersonalizedDishes, type PersonalizationMap } from "@/lib/qr/utils/getPersonalizedDishes";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { ScoringDish } from "@/lib/qr/utils/dishScoring";
import PromoCompact from "./PromoCompact";
import PromoCarousel from "../capture/PromoCarousel";
import EmailTypoHint from "../capture/EmailTypoHint";
import ExperienceBanner from "../capture/ExperienceBanner";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";
import AnnouncementBanner from "./AnnouncementBanner";

interface Review {
  id: string;
  dishId: string;
  rating: number;
  customerId: string;
  createdAt: Date;
}

interface CartaProps {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  promotions: RestaurantPromotion[];
  ratingMap: Record<string, { avg: number; count: number }>;
  reviews: Review[];
  tableId?: string;
  qrUser?: any;
  onProfileOpen?: () => void;
  onReady?: () => void;
  readyKey?: number;
  showWaiter?: boolean;
  marketingPromos?: any[];
  timeOfDay?: string;
  weather?: string;
  popularDishIds?: Set<string>;
  announcements?: { id: string; text: string; linkUrl: string | null }[];
}

function ScrollFade({ color = "var(--carta-bg)" }: { color?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(true);

  useEffect(() => {
    const el = scrollRef.current?.parentElement?.querySelector("[data-scroll-container]") as HTMLElement | null;
    if (!el) return;
    const check = () => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      setShowFade(!atEnd);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, []);

  return (
    <div
      ref={scrollRef}
      className="absolute top-0 right-0 pointer-events-none"
      style={{
        width: 30,
        height: "100%",
        background: showFade ? `linear-gradient(to right, transparent, ${color}50)` : "transparent",
        zIndex: 1,
        transition: "background 0.2s",
      }}
    />
  );
}

export default function CartaPremium({
  restaurant,
  categories,
  dishes,
  ratingMap,
  reviews,
  tableId,
  qrUser: qrUserProp,
  onProfileOpen: onProfileOpenProp,
  onReady,
  readyKey,
  showWaiter,
  marketingPromos,
  timeOfDay: timeOfDayProp,
  weather: weatherProp,
  popularDishIds: popularDishIdsProp,
  announcements,
}: CartaProps) {
  const lang = useLang();
  const { hasNewLikes, clearNewLikes } = useFavorites();
  const hasPromos = marketingPromos && marketingPromos.length > 0;
  const [activeFilter, setActiveFilter] = useState<CartaFilterKey[]>([]);
  const toggleFilter = (key: CartaFilterKey) => setActiveFilter(f => {
    const next = f.includes(key) ? f.filter(k => k !== key) : [...f, key];
    if (next.length > 0) { track(restaurant.id, "FILTER_APPLIED", { query: next.join(",") }); flushEvents(); }
    return next;
  });

  const [activeCategory, setActiveCategory] = useState(hasPromos ? "promos" : (categories[0]?.id || ""));
  const lastScrollY = useRef(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        lastScrollY.current = window.scrollY;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const catStartRef = useRef<{ id: string; start: number }>({ id: categories[0]?.id || "", start: Date.now() });

  // Track category dwell time when active category changes
  useEffect(() => {
    const prev = catStartRef.current;
    if (prev.id && prev.id !== activeCategory) {
      const dwellMs = Date.now() - prev.start;
      if (dwellMs > 1000) trackCategoryDwell(prev.id, dwellMs);
    }
    catStartRef.current = { id: activeCategory, start: Date.now() };
  }, [activeCategory]);

  // Flush current category dwell on unmount or page hide
  useEffect(() => {
    const flush = () => {
      const cur = catStartRef.current;
      if (cur.id) {
        const dwellMs = Date.now() - cur.start;
        if (dwellMs > 1000) trackCategoryDwell(cur.id, dwellMs);
        catStartRef.current = { id: cur.id, start: Date.now() };
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => { flush(); document.removeEventListener("visibilitychange", flush); };
  }, []);

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishFromHero, setDishFromHero] = useState(false);
  const [openPromo, setOpenPromo] = useState<any>(null);
  const [qrUserLocal, setQrUserLocal] = useState<any>(null);
  const [profileOpenLocal, setProfileOpenLocal] = useState(false);
  const qrUser = qrUserProp ?? qrUserLocal;
  const profileOpen = onProfileOpenProp ? false : profileOpenLocal;
  const handleProfileOpen = onProfileOpenProp ?? (() => setProfileOpenLocal(true));

  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setShowVerifiedModal(true);
      // Clean URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const [birthdayCountdown, setBirthdayCountdown] = useState<number | null>(null);

  const [showVerifiedToast, setShowVerifiedToast] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [captureName, setCaptureName] = useState("");
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureStatus, setCaptureStatus] = useState<"idle" | "loading" | "success">("idle");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { sortKey, setSortKey, rankings } = useCartaSort(restaurant.id, "premium");
  const popularDishIds = popularDishIdsProp ?? new Set<string>();
  const catNames = useMemo(() => { const m: Record<string, string> = {}; for (const c of categories) m[c.id] = c.name; return m; }, [categories]);
  const scoringCtx = useMemo(() => ({ timeOfDay: timeOfDayProp || "LUNCH", weather: weatherProp || "CLEAR", categoryNames: catNames }), [timeOfDayProp, weatherProp, catNames]);

  // pMap from localStorage prefs — computed once on client mount (SSR-safe)
  const [pMap, setPMap] = useState<PersonalizationMap | null>(() => {
    if (typeof window === "undefined") return null;
    const diet = localStorage.getItem("qr_diet");
    const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const dislikes = (() => { try { return JSON.parse(localStorage.getItem("qr_dislikes") || "[]"); } catch { return []; } })();
    if (!diet && restrictions.length === 0 && dislikes.length === 0) return null;
    const localProfile = { dietType: diet, restrictions, dislikedIngredients: dislikes, likedIngredients: {}, viewHistory: [], visitCount: 0, visitedCategoryIds: [], lastSessionDate: null };
    const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, localProfile, scoringCtx);
    return result.hasPersonalization ? result.map : null;
  });
  const [profileTrigger, setProfileTrigger] = useState(0);
  const mountedAt = useRef(Date.now());
  const recShownRef = useRef(new Set<string>());
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerH, setBannerH] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const [navH, setNavH] = useState(0);

  useEffect(() => {
    if (!bannerRef.current) return;
    const ro = new ResizeObserver(() => {
      setBannerH(bannerRef.current?.offsetHeight ?? 0);
    });
    ro.observe(bannerRef.current);
    return () => ro.disconnect();
  }, [announcements?.length]);

  useEffect(() => {
    if (!navRef.current) return;
    const ro = new ResizeObserver(() => setNavH(navRef.current?.offsetHeight ?? 0));
    ro.observe(navRef.current);
    return () => ro.disconnect();
  }, []);

  // Track search with debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const q = norm(searchQuery.trim());
      const count = dishes.filter((d) => norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q)).length;
      trackSearchPerformed(restaurant.id, q, count);
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, dishes, restaurant.id]);

  // Single fetch for user data — used for birthday countdown, second visit detection, and local user state
  useEffect(() => {
    const cookieKey = `qr_visited_${restaurant.id}`;
    const dismissKey = `qr_toast_dismissed_${restaurant.id}`;

    // Check verified param
    if (typeof window !== "undefined" && window.location.search.includes("verified=true")) {
      setShowVerifiedToast(true);
      setTimeout(() => setShowVerifiedToast(false), 4000);
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Determine if second visit check is needed
    const visited = localStorage.getItem(cookieKey);
    const dismissed = localStorage.getItem(dismissKey);
    const hasPrefs = localStorage.getItem("qr_diet") || localStorage.getItem("qr_restrictions");
    const viewTipNotSeen = !localStorage.getItem("quierocomer_carta_view_tooltip_shown");
    const needsSecondVisitCheck = visited && !dismissed && hasPrefs && !viewTipNotSeen && !sessionStorage.getItem("qr_capture_shown");

    if (!visited) localStorage.setItem(cookieKey, String(Date.now()));

    // Single fetch for all user-related data
    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        // Set local user state if not provided via prop
        if (qrUserProp === undefined && d.user) {
          setQrUserLocal(d.user);
        }

        // Birthday countdown
        if (d.user?.birthDate) {
          const today = new Date();
          const birth = new Date(d.user.birthDate);
          const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
          if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
          const days = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 30) setBirthdayCountdown(days);
        }

        // Second visit detection
        if (needsSecondVisitCheck && !d.user) {
          sessionStorage.setItem("qr_capture_shown", "true");
        }
      })
      .catch(() => {});
  }, [restaurant.id, qrUserProp]);

  useEffect(() => { onReady?.(); }, [readyKey]);

  // Background fetch: enrich pMap with likedIngredients for autoRecommended badges
  useEffect(() => {
    const guestId = getGuestId();
    if (!guestId && !qrUser?.id) return;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 5000);
    fetch(`/api/qr/profile?restaurantId=${restaurant.id}&guestId=${guestId}`, { signal: abort.signal }).then(r => r.json())
      .then((d) => {
        clearTimeout(timer);
        if (!d.profile) return;
        // Restore preferences to localStorage if lost (cache cleared, new browser, guest without account)
        if (!localStorage.getItem("qr_diet") && d.profile.dietType) {
          localStorage.setItem("qr_diet", d.profile.dietType);
          localStorage.setItem("qr_restrictions", JSON.stringify(d.profile.restrictions?.length ? d.profile.restrictions : ["ninguna"]));
          if (d.profile.dislikedIngredients?.length) localStorage.setItem("qr_dislikes", JSON.stringify(d.profile.dislikedIngredients));
        }
        const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, d.profile, scoringCtx);
        if (result.hasPersonalization) setPMap(result.map);
      })
      .catch(() => { clearTimeout(timer); });
  }, [restaurant.id, categories, dishes, qrUser?.id, scoringCtx, profileTrigger]);

  const heroDishes = useMemo(() => {
    const preferTranslated = lang !== "es";
    const sortPriority = (arr: typeof dishes) => [...arr].sort((a, b) => {
      const aPhoto = a.photos?.[0] ? 1 : 0;
      const bPhoto = b.photos?.[0] ? 1 : 0;
      if (aPhoto !== bPhoto) return bPhoto - aPhoto;
      if (preferTranslated) return ((b as any)._hasTranslation ? 1 : 0) - ((a as any)._hasTranslation ? 1 : 0);
      return 0;
    });

    const withPhoto = (arr: typeof dishes) => arr.filter(d => d.photos?.[0]);
    const recommended = dishes.filter(d => d.tags?.includes("RECOMMENDED"));
    const recsWithPhoto = sortPriority(withPhoto(recommended));
    if (recsWithPhoto.length > 0) return recsWithPhoto;
    if (recommended.length > 0) return sortPriority(recommended);
    const popular = sortPriority(withPhoto(dishes.filter(d => popularDishIds.has(d.id)))).slice(0, 3);
    if (popular.length > 0) return popular;
    const anyWithPhoto = sortPriority(withPhoto(dishes)).slice(0, 3);
    if (anyWithPhoto.length > 0) return anyWithPhoto;
    return sortPriority(dishes).slice(0, 3);
  }, [dishes, popularDishIds, lang]);

  // Hard rule: si el cliente filtra "_spicy", los picantes SIEMPRE van al final
  // de la categoria, sin importar score, RECOMMENDED, autoRec o popularidad.
  // Si tiene la preferencia de evitar picante, no le interesa el plato por
  // muy destacado que este.
  const clientAvoidsSpicyForSort = useClientAvoidsSpicy();

  // Categorías que tienen al menos un plato visible con el filtro/búsqueda activos
  const visibleCatIds = useMemo(() => {
    if (!activeFilter.length && !searchQuery) return null;
    const ids = new Set<string>();
    for (const cat of categories) {
      const has = applyCartaFilter(
        dishes.filter(d => d.categoryId === cat.id),
        activeFilter, popularDishIds
      ).some(d => {
        if (!searchQuery) return true;
        const q = norm(searchQuery.trim());
        return norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm((d as any).ingredients || "").includes(q);
      });
      if (has) ids.add(cat.id);
    }
    return ids;
  }, [categories, dishes, activeFilter, searchQuery, popularDishIds]);

  // Build sorted dish list matching carta visual order (category by category, recommended first, then by score)
  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of categories) {
      const catDishes = dishes.filter((d) => d.categoryId === cat.id && d.isActive);
      // Manual sort selector overrides Genio personalization for this category.
      if (sortKey !== "default") {
        result.push(...applyCartaSort(catDishes, sortKey, rankings));
        continue;
      }
      catDishes.sort((a, b) => {
          // Hard: spicy al final si el cliente filtra "sin picante"
          if (clientAvoidsSpicyForSort) {
            const aSpicy = (a as any).isSpicy ? 1 : 0;
            const bSpicy = (b as any).isSpicy ? 1 : 0;
            if (aSpicy !== bSpicy) return aSpicy - bSpicy;
          }
          if (pMap) {
            const aScore = pMap.get(a.id)?.score ?? 50;
            const bScore = pMap.get(b.id)?.score ?? 50;
            // 1. Para ti first (only if score is healthy)
            const aAuto = pMap.get(a.id)?.autoRecommended && aScore > 10 ? 1 : 0;
            const bAuto = pMap.get(b.id)?.autoRecommended && bScore > 10 ? 1 : 0;
            if (aAuto !== bAuto) return bAuto - aAuto;
            // 2. Destacados del local (only if no restriction penalty)
            const aRec = a.tags?.includes("RECOMMENDED") && aScore > 10 ? 1 : 0;
            const bRec = b.tags?.includes("RECOMMENDED") && bScore > 10 ? 1 : 0;
            if (aRec !== bRec) return bRec - aRec;
            // 3. Then by score
            if (aScore !== bScore) return bScore - aScore;
          } else {
            const aRec = a.tags?.includes("RECOMMENDED") ? 1 : 0;
            const bRec = b.tags?.includes("RECOMMENDED") ? 1 : 0;
            if (aRec !== bRec) return bRec - aRec;
          }
          return a.position - b.position;
        });
      result.push(...catDishes);
    }
    return result;
  }, [categories, dishes, pMap, sortKey, rankings, clientAvoidsSpicyForSort]);

  // Filtered dish list for DishDetail navigation — matches what's visible on screen
  const filteredSortedDishes = useMemo(() => {
    if (!activeFilter.length && !searchQuery) return sortedDishes;
    let result = applyCartaFilter(sortedDishes, activeFilter, popularDishIds);
    if (searchQuery) {
      const q = norm(searchQuery.trim());
      result = result.filter(d => norm(d.name || "").includes(q) || norm(d.description || "").includes(q));
    }
    return result;
  }, [sortedDishes, activeFilter, searchQuery, popularDishIds]);

  // Reset horizontal scroll containers when personalization order changes
  useEffect(() => {
    if (!pMap) return;
    // Small delay to let React re-render with new order before resetting scroll
    requestAnimationFrame(() => {
      const containers = document.querySelectorAll("[data-scroll-container]");
      containers.forEach((el) => { (el as HTMLElement).scrollLeft = 0; });
      // Only scroll to top after Genio, not on initial page load
      // Don't scroll to top — keep user's position
    });
  }, [pMap, profileTrigger]);

  // Track RECOMMENDATION_SHOWN when auto-recommended dishes enter viewport
  useEffect(() => {
    if (!pMap) return;
    const observers: IntersectionObserver[] = [];
    for (const [dishId, entry] of pMap) {
      if (!entry.autoRecommended) continue;
      const el = document.querySelector(`[data-dish-id="${dishId}"]`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !recShownRef.current.has(dishId)) {
            recShownRef.current.add(dishId);
            track(restaurant.id, "RECOMMENDATION_SHOWN", { dishId, metadata: { score: entry.score, reason: entry.reason, wasAutomatic: true } });
          }
        },
        { threshold: 0.5 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [pMap, restaurant.id]);

  // IntersectionObserver-based active category detection
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const allCats = hasPromos
      ? [{ id: "promos" }, ...categories]
      : categories;
    for (const cat of allCats) {
      const el = document.getElementById(`cat-${cat.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveCategory(cat.id);
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(obs => obs.disconnect());
  }, [categories, hasPromos]);

  const isDemo = (restaurant as any).isDemo;
  const demoOffset = isDemo ? 105 : 0;

  const announcementSlot = announcements && announcements.length > 0 ? (
    <div
      ref={bannerRef}
      style={{ position: "sticky", top: demoOffset + navH, left: 0, right: 0, zIndex: 45 }}
    >
      <AnnouncementBanner announcements={announcements} accentColor={(restaurant as any).cartaAccentColor} />
    </div>
  ) : undefined;

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "var(--carta-bg)", paddingTop: demoOffset }}>
      <HeroDish restaurant={restaurant} heroDishes={heroDishes} qrUser={qrUser} onProfileOpen={handleProfileOpen} enabledLangs={(restaurant as any).plan === "PREMIUM" ? (restaurant as any).enabledLangs : undefined} onDishSelect={(d) => { setDishFromHero(true); setSelectedDish(d); }} belowNavSlot={announcementSlot} stickyNav navRef={navRef} />

      {/* Filter bar — solo Gold y Premium */}
      {(restaurant as any).plan !== "FREE" && (
        <div style={{ borderBottom: "1px solid var(--carta-border)", padding: "10px 12px" }}>
          <CartaFilterBar active={activeFilter} onToggle={toggleFilter} />
        </div>
      )}

      {/* Search overlay on CategoryNav */}
      {searchOpen ? (
        <div
          className="z-40"
          style={{ position: "sticky", top: bannerH + navH, background: "var(--carta-bg-solid)", borderBottom: "1px solid var(--carta-border)", height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}
        >
          <Search size={16} color="var(--carta-text-muted)" style={{ flexShrink: 0 }} />
          <input
            autoFocus
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(lang, "search")}
            className="font-[family-name:var(--font-dm)]"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "16px",
              color: "var(--carta-text)",
              background: "transparent",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}
          >
            <X size={18} color="var(--carta-text-muted)" />
          </button>
        </div>
      ) : (
        <CategoryNav
          categories={[
            ...(hasPromos ? [{ id: "promos", name: "Ofertas", position: -2, isActive: true, restaurantId: "", description: null, createdAt: new Date(), updatedAt: new Date() } as any] : []),
            ...(visibleCatIds ? categories.filter(c => visibleCatIds.has(c.id)) : categories),
          ]}
          activeCategory={activeCategory}
          stickyTop={bannerH + navH}
          onCategoryChange={(id) => {
            setActiveCategory(id);
            if (id === "promos") { const el = document.getElementById("cat-promos"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 54, behavior: "smooth" }); }
          }}
          rightSlot={
            <button
              onClick={() => setSearchOpen(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 4, cursor: "pointer", borderRadius: 8 }}
            >
              <Search size={17} color="var(--carta-text-muted)" />
            </button>
          }
        />
      )}

      {/* Empty state — filtro activo sin resultados */}
      {activeFilter.length > 0 && !searchQuery && !categories.some(cat =>
        applyCartaFilter(dishes.filter(d => d.categoryId === cat.id), activeFilter, popularDishIds).length > 0
      ) && (
        <div className="font-[family-name:var(--font-dm)]" style={{ padding: "64px 28px", textAlign: "center" }}>
          <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
          <p style={{ color: "var(--carta-text)", fontSize: "0.95rem", fontWeight: 600, margin: "0 0 6px" }}>
            Sin resultados para los filtros seleccionados
          </p>
          <p style={{ color: "var(--carta-text-muted)", fontSize: "0.82rem", lineHeight: 1.5, margin: "0 0 16px" }}>
            Prueba quitando alguno de los filtros activos.
          </p>
          <button
            onClick={() => setActiveFilter([])}
            className="font-[family-name:var(--font-dm)]"
            style={{
              fontSize: "0.88rem", color: "var(--carta-accent)", fontWeight: 600,
              background: "color-mix(in srgb, var(--carta-accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--carta-accent) 30%, transparent)",
              padding: "8px 18px", borderRadius: 999, cursor: "pointer",
            }}
          >
            Ver todos los platos
          </button>
        </div>
      )}

      {/* Personalización ocurre en background sin bloquear la UI */}

      <main style={{ paddingBottom: 55 }}>
        {/* Ofertas section */}
        {hasPromos && (
          <div id="cat-promos" style={{ paddingTop: 18 }}>
            <PromoCompact promos={marketingPromos || []} onViewPromo={(promo) => setOpenPromo(promo)} />
          </div>
        )}

        {searchQuery && !categories.some((cat) => dishes.some((d) => d.categoryId === cat.id && (norm(d.name || "").includes(norm(searchQuery.trim())) || norm(d.description || "").includes(norm(searchQuery.trim())) || norm(d.ingredients || "").includes(norm(searchQuery.trim()))))) && (
          <div className="font-[family-name:var(--font-dm)]" style={{ padding: "64px 32px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
            <p style={{ color: "var(--carta-text-muted)", fontSize: "0.95rem" }}>
              No encontramos platos con &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              onClick={() => { setSearchQuery(""); }}
              className="font-[family-name:var(--font-dm)]"
              style={{ marginTop: 12, fontSize: "0.88rem", color: "var(--carta-accent, #F4A623)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}
        {categories.map((cat, index) => {
          const catDishes = applyCartaFilter(
            dishes.filter((d) => d.categoryId === cat.id),
            activeFilter,
            popularDishIds,
          ).filter((d) => {
              if (!searchQuery) return true;
              const q = norm(searchQuery.trim());
              return norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q);
            })
            .sort((a, b) => {
              if (pMap) {
                const aScore = pMap.get(a.id)?.score ?? 50;
                const bScore = pMap.get(b.id)?.score ?? 50;
                const aAuto = pMap.get(a.id)?.autoRecommended && aScore > 10 ? 1 : 0;
                const bAuto = pMap.get(b.id)?.autoRecommended && bScore > 10 ? 1 : 0;
                if (aAuto !== bAuto) return bAuto - aAuto;
                const aRec = a.tags?.includes("RECOMMENDED") && aScore > 10 ? 1 : 0;
                const bRec = b.tags?.includes("RECOMMENDED") && bScore > 10 ? 1 : 0;
                if (aRec !== bRec) return bRec - aRec;
                if (aScore !== bScore) return bScore - aScore;
              } else {
                const aRec = a.tags?.includes("RECOMMENDED") ? 1 : 0;
                const bRec = b.tags?.includes("RECOMMENDED") ? 1 : 0;
                if (aRec !== bRec) return bRec - aRec;
              }
              return a.position - b.position;
            });
          if (!catDishes.length) return null;

          return (
            <div key={cat.id}>
            {index === Math.max(2, Math.floor(categories.length * 0.4)) && <ExperienceBanner restaurantId={restaurant.id} />}
            <section id={`cat-${cat.id}`} style={{ paddingTop: index === 0 ? 16 : 32 }}>
              {/* Title */}
              <div style={{ padding: "0 20px", marginBottom: 10 }}>
                <h2
                  className="font-[family-name:var(--font-playfair)]"
                  style={{ fontSize: "1.5rem", fontWeight: 800, color: "#8d8d8d" }}
                >
                  {cat.name}
                </h2>
                {cat.description && cat.description.length <= 60 && (
                  <p
                    className="font-[family-name:var(--font-dm)] truncate"
                    style={{ fontSize: "0.8rem", color: "var(--carta-text3)", marginTop: 2 }}
                  >
                    {cat.description}
                  </p>
                )}
              </div>

              {/* Scroll with fade — degradado en el borde derecho indica que hay mas cartas */}
              <div className="relative">
                <div
                  data-scroll-container
                  className="flex overflow-x-auto snap-x snap-mandatory items-start"
                  style={{
                    paddingBottom: 8,
                    scrollPaddingLeft: 20,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                  ref={(el) => {
                    if (!el) return;
                    // Detecta si hay scroll disponible y agrega/quita la clase para mostrar el fade
                    const update = () => {
                      const hasMore = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
                      el.parentElement?.toggleAttribute("data-has-more", hasMore);
                    };
                    update();
                    el.addEventListener("scroll", update, { passive: true });
                    const ro = new ResizeObserver(update);
                    ro.observe(el);
                  }}
                >
                  {catDishes.map((dish, i) => {
                    return (
                    <div
                      key={dish.id}
                      data-dish-id={dish.id}
                      style={{
                        width: 200,
                        minWidth: 200,
                        flexShrink: 0,
                        scrollSnapAlign: "start",
                        marginLeft: i === 0 ? 20 : 14,
                        marginRight: i === catDishes.length - 1 ? 20 : 0,
                      }}
                    >
                      <DishCard
                        dish={dish}
                        variant="premium"
                        onClick={() => {
                          const entry = pMap?.get(dish.id);
                          if (entry?.autoRecommended) {
                            track(restaurant.id, "RECOMMENDATION_TAPPED", { dishId: dish.id, metadata: { score: entry.score, wasAutomatic: true } });
                          }
                          setSelectedDish(dish);
                        }}
                        averageRating={ratingMap[dish.id]}
                        autoRecommended={pMap?.get(dish.id)?.autoRecommended}
                        recommendationReason={pMap?.get(dish.id)?.reason}
                        isExploration={pMap?.get(dish.id)?.isExploration}
                        hasPersonalization={!!pMap}
                        restaurantName={restaurant.name}
                        isPopular={popularDishIds.has(dish.id)}
                      />
                    </div>
                    );
                  })}
                </div>
                {/* Fade overlay del borde derecho — visible solo cuando hay scroll restante */}
                <div
                  aria-hidden
                  className="cp-scroll-fade"
                  style={{
                    position: "absolute", right: 0, top: 0, bottom: 8, width: 56,
                    pointerEvents: "none",
                    background: "linear-gradient(to right, transparent 0%, var(--carta-bg) 80%)",
                    opacity: 0, transition: "opacity 0.18s ease",
                  }}
                />
              </div>
            </section>
            </div>
          );
        })}

        {/* Genio nudge — inside main, after categories */}
        {birthdayCountdown !== null && (
          <div
            className="font-[family-name:var(--font-dm)]"
            style={{
              margin: "20px 20px 12px", padding: "12px 16px",
              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
              border: "1px solid rgba(244,166,35,0.2)", borderRadius: 12,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>🎁</span>
            <span style={{ fontSize: "0.82rem", color: "#92400e", fontWeight: 600 }}>
              {(() => {
                const firstName = (qrUser?.name || "").split(" ")[0];
                if (birthdayCountdown === 0) return firstName ? `¡Feliz cumpleaños, ${firstName}! 🎉` : "¡Hoy es tu cumpleaños! 🎉";
                return firstName
                  ? `${firstName}, tu regalo llega en ${birthdayCountdown} día${birthdayCountdown !== 1 ? "s" : ""}`
                  : `Tu regalo llega en ${birthdayCountdown} día${birthdayCountdown !== 1 ? "s" : ""}`;
              })()}
            </span>
          </div>
        )}

      </main>

      {/* Powered by footer */}
      <footer
        className="font-[family-name:var(--font-dm)]"
        style={{
          paddingBottom: 30, marginTop: 40,
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <a
          href="https://quierocomer.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <span style={{ color: "var(--carta-text3)", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span
            className="font-[family-name:var(--font-playfair)]"
            style={{ color: "var(--carta-accent, #F4A623)", fontSize: "0.82rem", fontWeight: 700 }}
          >
            QuieroComer.com
          </span>
        </a>
        <span style={{ color: "var(--carta-text3)", fontSize: "0.62rem" }}>© {new Date().getFullYear()}</span>
      </footer>

      {!(restaurant as any).isDemo && showWaiter && (
        <div className="fixed z-50" style={{ right: 14, bottom: "calc(16px + env(safe-area-inset-bottom)" }}>
          <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />
        </div>
      )}
      <style>{`
        /* Fade del borde derecho del scroll de cada categoria — solo cuando hay mas cartas */
        [data-has-more] > .cp-scroll-fade { opacity: 0.6 !important; }
      `}</style>

      {selectedDish && (
        <DishDetailErrorBoundary onClose={() => { setSelectedDish(null); setDishFromHero(false); }}>
        <DishDetail
          dish={selectedDish}
          allDishes={dishFromHero ? [selectedDish] : filteredSortedDishes}
          categories={categories}
          restaurantId={restaurant.id}
          reviews={reviews}
          ratingMap={ratingMap}
          onClose={() => { setSelectedDish(null); setDishFromHero(false); if (hasNewLikes) { clearNewLikes(); setProfileTrigger((n) => n + 1); } }}
          onChangeDish={(d) => { setDishFromHero(false); setSelectedDish(d); }}
          personalizationMap={pMap}
          restaurantName={restaurant.name}
            restaurantPlan={(restaurant as any).plan}
          popularDishIds={popularDishIds}
        />
        </DishDetailErrorBoundary>
      )}

      {/* Promo detail modal — uses the full PromoCarousel modal */}
      <PromoCarousel
        restaurantId={restaurant.id}
        initialPromos={marketingPromos}
        hideCards
        externalOpenPromo={openPromo}
        onClosePromo={() => setOpenPromo(null)}
        onViewDish={(dishId) => {
          const dish = dishes.find(d => d.id === dishId);
          if (dish) setSelectedDish(dish);
        }}
      />

      {!(restaurant as any).isDemo && <BirthdayAutoModal restaurantId={restaurant.id} restaurantName={restaurant.name} birthdayPerk={(restaurant as any).birthdayPerk} logoUrl={restaurant.logoUrl} />}

      {/* Verified toast */}
      {showVerifiedToast && (
        <div className="fixed font-[family-name:var(--font-dm)]" style={{ top: 16, left: "50%", transform: "translateX(-50%)", background: "#0a2e1a", border: "1px solid #16a34a", color: "white", padding: "10px 20px", borderRadius: 12, fontSize: "0.92rem", fontWeight: 600, zIndex: 80 }}>
          ✓ ¡Listo! Ya guardamos tus preferencias
        </div>
      )}

      {/* Second visit toast moved inside floating buttons container above */}

      {/* Verified celebration modal */}
      {showVerifiedModal && (
        <div
          className="fixed inset-0 flex items-center justify-center font-[family-name:var(--font-dm)]"
          style={{ zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowVerifiedModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--carta-surface)", borderRadius: 20, padding: "36px 28px",
              maxWidth: 340, width: "90%", textAlign: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              animation: "bdaySlideIn 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <span style={{ fontSize: "3rem", display: "block", marginBottom: 12 }}>🎉</span>
            <h3
              className="font-[family-name:var(--font-playfair)]"
              style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--carta-text)", lineHeight: 1.3, margin: "0 0 8px" }}
            >
              ¡Listo, ya estás registrado!
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--carta-text2)", lineHeight: 1.5, margin: "0 0 20px" }}>
              Recibirás un regalo especial en tu cumpleaños. El Genio ahora te conoce y te recomendará mejor.
            </p>
            <button
              onClick={() => setShowVerifiedModal(false)}
              className="active:scale-[0.97] transition-transform"
              style={{
                background: "var(--carta-accent, #F4A623)", color: "white", border: "none",
                borderRadius: 50, padding: "12px 28px", fontSize: "0.92rem",
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
              }}
            >
              ¡Genial! 🧞
            </button>
          </div>
        </div>
      )}

      {/* Email capture modal */}
      {showEmailModal && (
        <div
          className="fixed flex items-center justify-center font-[family-name:var(--font-dm)]"
          style={{ inset: 0, zIndex: 90, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowEmailModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--carta-surface)",
              borderRadius: 20,
              padding: "32px 24px 28px",
              maxWidth: 360,
              width: "90%",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setShowEmailModal(false)}
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="var(--carta-text3)" />
            </button>

            {captureStatus === "success" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 14 }}>🧞</span>
                <h3
                  className="font-[family-name:var(--font-playfair)]"
                  style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--carta-text)", marginBottom: 8 }}
                >
                  ¡Listo{captureName ? `, ${captureName}` : ""}!
                </h3>
                <p style={{ color: "var(--carta-text3)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Tus gustos quedaron guardados. La próxima vez te recomendaré mejor.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <span style={{ fontSize: "2.4rem", display: "block", marginBottom: 10 }}>🧞</span>
                  <h3
                    className="font-[family-name:var(--font-playfair)]"
                    style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--carta-text)", lineHeight: 1.2 }}
                  >
                    Guarda tus gustos
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--carta-text3)", marginTop: 6, lineHeight: 1.5 }}>
                    Así el Genio te recomienda mejor cada vez
                  </p>
                </div>

                {/* Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    type="text"
                    value={captureName}
                    onChange={(e) => setCaptureName(e.target.value)}
                    placeholder="Tu nombre"
                    style={{
                      background: "var(--carta-bg)", border: "1px solid var(--carta-border)", borderRadius: 10,
                      padding: "12px 16px", color: "var(--carta-text)", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <input
                    type="email"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    placeholder="tu@email.com"
                    style={{
                      background: "var(--carta-bg)", border: "1px solid var(--carta-border)", borderRadius: 10,
                      padding: "12px 16px", color: "var(--carta-text)", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <EmailTypoHint email={captureEmail} onAccept={setCaptureEmail} />
                  <button
                    className="active:scale-[0.98] transition-transform"
                    onClick={async () => {
                      if (!captureEmail || !captureName) return;
                      setCaptureStatus("loading");
                      const res = await fetch("/api/qr/user/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: captureEmail,
                          name: captureName || null,
                          dietType: localStorage.getItem("qr_diet"),
                          restrictions: localStorage.getItem("qr_restrictions") ? JSON.parse(localStorage.getItem("qr_restrictions")!) : [],
                          restaurantId: restaurant.id,
                          source: "second_visit",
                          guestId: getGuestId(),
                        }),
                      });
                      const data = await res.json();
                      if (data.userId) {
                        document.cookie = `qr_user_id=${data.userId};path=/;max-age=${60 * 60 * 24 * 365}`;
                      }
                      setCaptureStatus("success");
                    }}
                    style={{
                      width: "100%", marginTop: 4, background: "var(--carta-accent, #F4A623)", color: "white",
                      borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                      border: "none", fontFamily: "inherit", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                      opacity: captureStatus === "loading" ? 0.6 : 1,
                    }}
                  >
                    {captureStatus === "loading" ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--carta-text3)", marginTop: 12 }}>
                  🔒 Solo usaremos tu email para recordar tus gustos
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
