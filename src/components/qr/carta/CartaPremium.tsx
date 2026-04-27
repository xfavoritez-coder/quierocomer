"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import HeroDish from "./HeroDish";
import CategoryNav from "./CategoryNav";
import DishCard from "./DishCard";
import DishDetail from "./DishDetail";
import GenioOnboarding from "../genio/GenioOnboarding";
import { Sparkles, Search, X } from "lucide-react";
import WaiterButton from "../garzon/WaiterButton";
import BirthdayBanner from "../capture/BirthdayBanner";
import { norm } from "@/lib/normalize";
import ProfileDrawer from "../auth/ProfileDrawer";
import ViewSelector from "./ViewSelector";
import GenioTip from "../genio/GenioTip";
import { getGuestId } from "@/lib/guestId";
import { trackDishEnter, trackDishLeave, trackCategoryDwell } from "@/lib/sessionTracker";
import { trackSearchPerformed } from "./utils/cartaAnalytics";
import { getPersonalizedDishes, type PersonalizationMap } from "@/lib/qr/utils/getPersonalizedDishes";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { ScoringDish } from "@/lib/qr/utils/dishScoring";
import PromoCarousel from "../capture/PromoCarousel";
import EmailTypoHint from "../capture/EmailTypoHint";
import ExperienceBanner from "../capture/ExperienceBanner";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";

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
}

function ScrollFade({ color = "#f7f7f5" }: { color?: string }) {
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
        background: showFade ? `linear-gradient(to right, transparent, ${color}80)` : "transparent",
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
}: CartaProps) {
  const lang = useLang();
  const { hasNewLikes, clearNewLikes } = useFavorites();
  const [hasCompletedGenio, setHasCompletedGenio] = useState(false);
  useEffect(() => {
    setHasCompletedGenio(!!(localStorage.getItem("qr_diet") && localStorage.getItem("qr_restrictions")));
  }, []);
  const hasPromos = marketingPromos && marketingPromos.length > 0;
  const [activeCategory, setActiveCategory] = useState(hasPromos ? "promos" : (categories[0]?.id || ""));
  const [showGenioNudge, setShowGenioNudge] = useState(false);
  const [showLikeGenioTip, setShowLikeGenioTip] = useState(false);
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

  // Genio nudge — pulse the floating button after 20s (once per session)
  // Show "¿Ordeno la carta según tus gustos?" after 20s on first visit
  useEffect(() => {
    if (hasCompletedGenio) return;
    if (sessionStorage.getItem("qc_genio_nudge_shown")) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem("qc_genio_nudge_shown", "1");
      setShowLikeGenioTip(true);
      setTimeout(() => setShowLikeGenioTip(false), 5000);
    }, 20_000);
    return () => clearTimeout(timer);
  }, [hasCompletedGenio]);

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [genioOpen, setGenioOpen] = useState(false);
  const [qrUserLocal, setQrUserLocal] = useState<any>(null);
  const [profileOpenLocal, setProfileOpenLocal] = useState(false);
  const qrUser = qrUserProp ?? qrUserLocal;
  const profileOpen = onProfileOpenProp ? false : profileOpenLocal;
  const handleProfileOpen = onProfileOpenProp ?? (() => setProfileOpenLocal(true));

  // Like genio tip removed — nudge now triggers at 20s on first visit instead

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
  const [personalizing, setPersonalizing] = useState(false);
  const mountedAt = useRef(Date.now());

  // Instant local pMap refresh (no network) — call after Genio/likes
  const refreshLocalPMap = useCallback(() => {
    const diet = localStorage.getItem("qr_diet");
    const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const dislikes = (() => { try { return JSON.parse(localStorage.getItem("qr_dislikes") || "[]"); } catch { return []; } })();
    if (!diet && restrictions.length === 0 && dislikes.length === 0) return;
    const localProfile = { dietType: diet, restrictions, dislikedIngredients: dislikes, likedIngredients: {}, viewHistory: [], visitCount: 0, visitedCategoryIds: [], lastSessionDate: null };
    const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, localProfile, scoringCtx);
    if (result.hasPersonalization) setPMap(result.map);
  }, [dishes, categories, scoringCtx]);
  const recShownRef = useRef(new Set<string>());

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
    setPersonalizing(true);
    fetch(`/api/qr/profile?restaurantId=${restaurant.id}&guestId=${guestId}`).then(r => r.json())
      .then((d) => {
        if (!d.profile) { setPersonalizing(false); return; }
        // Restore preferences to localStorage if lost (cache cleared, new browser, guest without account)
        if (!localStorage.getItem("qr_diet") && d.profile.dietType) {
          localStorage.setItem("qr_diet", d.profile.dietType);
          localStorage.setItem("qr_restrictions", JSON.stringify(d.profile.restrictions?.length ? d.profile.restrictions : ["ninguna"]));
          if (d.profile.dislikedIngredients?.length) localStorage.setItem("qr_dislikes", JSON.stringify(d.profile.dislikedIngredients));
        }
        const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, d.profile, scoringCtx);
        if (result.hasPersonalization) setPMap(result.map);
        setPersonalizing(false);
      })
      .catch(() => setPersonalizing(false));
  }, [restaurant.id, categories, dishes, qrUser?.id, scoringCtx, profileTrigger]);

  const heroDishes = useMemo(() => {
    // 1. RECOMMENDED dishes with photos
    const recommendedWithPhotos = dishes.filter(
      (d) => d.tags?.includes("RECOMMENDED") && d.photos?.[0]
    );
    if (recommendedWithPhotos.length > 0) return recommendedWithPhotos;

    // 2. Popular dishes with photos (up to 3)
    const popularWithPhotos = dishes.filter(
      (d) => popularDishIds.has(d.id) && d.photos?.[0]
    ).slice(0, 3);
    if (popularWithPhotos.length > 0) return popularWithPhotos;

    // 3. Fallback: 3 random dishes with photos
    const withPhotos = dishes.filter((d) => d.photos?.[0]);
    if (withPhotos.length <= 3) return withPhotos;
    // Shuffle and pick 3
    const shuffled = [...withPhotos].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [dishes, popularDishIds]);

  // Build sorted dish list matching carta visual order (category by category, recommended first, then by score)
  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of categories) {
      const catDishes = dishes
        .filter((d) => d.categoryId === cat.id && d.isActive)
        .sort((a, b) => {
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
  }, [categories, dishes, pMap]);

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
            fetch("/api/qr/stats", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventType: "RECOMMENDATION_SHOWN",
                dishId,
                restaurantId: restaurant.id,
                guestId: getGuestId(),
                metadata: { score: entry.score, reason: entry.reason, wasAutomatic: true },
              }),
            }).catch(() => {});
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

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#f7f7f5" }}>
      <HeroDish restaurant={restaurant} heroDishes={heroDishes} qrUser={qrUser} onProfileOpen={handleProfileOpen} onDishSelect={setSelectedDish} />

      {/* Search overlay on CategoryNav */}
      {searchOpen ? (
        <div
          className="sticky top-0 z-40"
          style={{ position: "sticky", top: 0, background: "#f7f7f5", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}
        >
          <Search size={16} color="rgba(14,14,14,0.35)" style={{ flexShrink: 0 }} />
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
              fontSize: "0.92rem",
              color: "#0e0e0e",
              background: "transparent",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
            style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}
          >
            <X size={18} color="rgba(14,14,14,0.4)" />
          </button>
        </div>
      ) : (
        <CategoryNav
          categories={hasPromos ? [{ id: "promos", name: "Ofertas", position: -1, isActive: true, restaurantId: "", description: null, createdAt: new Date(), updatedAt: new Date() } as any, ...categories] : categories}
          activeCategory={activeCategory}
          onCategoryChange={(id) => { setActiveCategory(id); if (id === "promos") { const el = document.getElementById("cat-promos"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 54, behavior: "smooth" }); } }}
          leftSlot={
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(14,14,14,0.06)",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              aria-label="Buscar"
            >
              <Search size={19} color="#666" />
            </button>
          }
        />
      )}

      {personalizing && !pMap && Date.now() - mountedAt.current > 500 && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            background: "rgba(247,247,245,0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: "1.5rem", animation: "genioFloat 1.5s ease-in-out infinite" }}>✨</span>
          <span style={{ fontSize: "0.95rem", color: "#b8860b", fontWeight: 500 }}>Personalizando la carta para ti...</span>
        </div>
      )}

      <main style={{ paddingBottom: 55 }}>
        {/* Ofertas section — inside main as first "category" */}
        {hasPromos && (
          <div id="cat-promos" style={{ paddingTop: 16 }}>
            <PromoCarousel restaurantId={restaurant.id} initialPromos={marketingPromos} onViewDish={(dishId) => {
              const dish = dishes.find(d => d.id === dishId);
              if (dish) setSelectedDish(dish);
            }} />
          </div>
        )}

        {searchQuery && !categories.some((cat) => dishes.some((d) => d.categoryId === cat.id && (norm(d.name || "").includes(norm(searchQuery.trim())) || norm(d.description || "").includes(norm(searchQuery.trim())) || norm(d.ingredients || "").includes(norm(searchQuery.trim()))))) && (
          <div className="font-[family-name:var(--font-dm)]" style={{ padding: "64px 32px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
            <p style={{ color: "rgba(14,14,14,0.45)", fontSize: "0.95rem" }}>
              No encontramos platos con &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              onClick={() => { setSearchQuery(""); }}
              className="font-[family-name:var(--font-dm)]"
              style={{ marginTop: 12, fontSize: "0.88rem", color: "#F4A623", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}
        {categories.map((cat, index) => {
          const catDishes = dishes
            .filter((d) => d.categoryId === cat.id)
            .filter((d) => {
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
            {index === Math.max(4, Math.floor(categories.length * 0.8)) && <BirthdayBanner restaurantId={restaurant.id} restaurantName={restaurant.name} />}
            <section id={`cat-${cat.id}`} style={{ paddingTop: index === 0 ? 16 : 21 }}>
              {/* Title */}
              <div style={{ padding: "0 20px", marginBottom: 10 }}>
                <h2
                  className="font-[family-name:var(--font-playfair)]"
                  style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0e0e0e" }}
                >
                  {cat.name}
                </h2>
                {cat.description && cat.description.length <= 60 && (
                  <p
                    className="font-[family-name:var(--font-dm)] truncate"
                    style={{ fontSize: "0.8rem", color: "#bbb", marginTop: 2 }}
                  >
                    {cat.description}
                  </p>
                )}
              </div>

              {/* Scroll with fade */}
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
                >
                  {catDishes.map((dish, i) => {
                    return (
                    <div
                      key={dish.id}
                      data-dish-id={dish.id}
                      style={{
                        width: 205,
                        minWidth: 205,
                        flexShrink: 0,
                        scrollSnapAlign: "start",
                        marginLeft: i === 0 ? 20 : 10,
                        marginRight: i === catDishes.length - 1 ? 20 : 0,
                      }}
                    >
                      <DishCard
                        dish={dish}
                        variant="premium"
                        onClick={() => {
                          const entry = pMap?.get(dish.id);
                          if (entry?.autoRecommended) {
                            fetch("/api/qr/stats", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                eventType: "RECOMMENDATION_TAPPED",
                                dishId: dish.id,
                                restaurantId: restaurant.id,
                                guestId: getGuestId(),
                                metadata: { score: entry.score, wasAutomatic: true },
                              }),
                            }).catch(() => {});
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
                <ScrollFade />
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
              {birthdayCountdown === 0 ? "¡Hoy es tu cumpleaños! 🎉" : `Tu regalo llega en ${birthdayCountdown} día${birthdayCountdown !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {hasCompletedGenio ? (
          <button
            onClick={() => setGenioOpen(true)}
            className="font-[family-name:var(--font-dm)] active:scale-[0.98] transition-transform"
            style={{
              margin: "32px 20px 16px", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
              background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
              border: "1px solid rgba(244,166,35,0.2)", borderRadius: 14, cursor: "pointer", width: "calc(100% - 40px)",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>🧞</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0e0e0e" }}>Tu carta está personalizada ✓</span>
              <span style={{ fontSize: "0.72rem", color: "#8a5a2c", marginLeft: 8 }}>Editar gustos</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ) : (
          <div
            className="font-[family-name:var(--font-dm)]"
            style={{
              margin: "32px 20px 16px", padding: "20px", textAlign: "center",
              background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
              border: "1px solid rgba(244,166,35,0.2)", borderRadius: 20,
            }}
          >
            <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "17px", fontWeight: 600, color: "#0e0e0e", margin: "0 0 2px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span>🧞</span> {t(lang, "dontKnowWhat")} {restaurant.name}?
            </h3>
            <p style={{ fontSize: "14.5px", color: "#8a5a2c", margin: "0 0 16px" }}>{t(lang, "gBannerSub")}</p>
            <button
              onClick={() => setGenioOpen(true)}
              className="active:scale-[0.97] transition-transform"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#F4A623",
                color: "white", padding: "12px 24px", borderRadius: 100,
                fontSize: "13.5px", fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "0 8px 20px rgba(244,166,35,0.3)", fontFamily: "inherit",
              }}
            >
              {t(lang, "askGenieShort")}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        )}
      </main>

      {/* Powered by footer */}
      <footer
        className="font-[family-name:var(--font-dm)]"
        style={{
          paddingBottom: 100,
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <a
          href="https://quierocomer.cl/qr"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <span style={{ color: "#bbb", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span
            className="font-[family-name:var(--font-playfair)]"
            style={{ color: "#999", fontSize: "0.82rem", fontWeight: 700 }}
          >
            QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
          </span>
        </a>
        <span style={{ color: "#ccc", fontSize: "0.62rem" }}>© {new Date().getFullYear()}</span>
      </footer>

      {/* Floating buttons */}
      {/* Floating buttons — Genio separate to avoid pushing others */}
      <div className="fixed z-50 flex flex-col items-end" style={{ right: 14, bottom: "calc(54px + env(safe-area-inset-bottom))", gap: 10 }}>
        <div style={{ position: "relative" }}>
          {showLikeGenioTip && (
            <div className="font-[family-name:var(--font-dm)]" style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 8, background: "#FFF7E8", color: "#0e0e0e", fontSize: "14px", fontWeight: 600, padding: "8px 14px", borderRadius: 10, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", animation: "fadeToast 0.3s ease-out" }}>
              ¿Ordeno la carta según tus gustos? 🧞
              <div style={{ position: "absolute", bottom: -6, right: 20, width: 12, height: 12, background: "#FFF7E8", transform: "rotate(45deg)" }} />
            </div>
          )}
          <button
            onClick={() => { setShowLikeGenioTip(false); setGenioOpen(true); }}
            className="flex items-center justify-center rounded-full active:scale-95"
            style={{ height: 60, width: 60, background: "#F4A623", boxShadow: showLikeGenioTip ? "0 0 0 4px rgba(244,166,35,0.3), 0 4px 18px rgba(244,166,35,0.35)" : "0 4px 18px rgba(244,166,35,0.35)", borderRadius: 50, transition: "box-shadow 0.3s ease", position: "relative" }}
          >
            <span style={{ fontSize: "26px", lineHeight: 1, flexShrink: 0, animation: showLikeGenioTip ? "genioNudgePulse 1s ease-in-out infinite" : "genioFabFloat 1.5s ease-in-out infinite" }}>🧞</span>
            {hasCompletedGenio && <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", lineHeight: 1, color: "white", fontWeight: 700 }}>✓</span>}
          </button>
        </div>
        {showWaiter && <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />}
        <ViewSelector restaurantId={restaurant.id} />
      </div>
      <style>{`
        @keyframes genioFabFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes genioNudgePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      `}</style>

      {selectedDish && (
        <DishDetail
          dish={selectedDish}
          allDishes={sortedDishes}
          categories={categories}
          restaurantId={restaurant.id}
          reviews={reviews}
          ratingMap={ratingMap}
          onClose={() => { setSelectedDish(null); if (hasNewLikes) { clearNewLikes(); refreshLocalPMap(); setProfileTrigger((n) => n + 1); } }}
          onChangeDish={setSelectedDish}
          personalizationMap={pMap}
          restaurantName={restaurant.name}
          popularDishIds={popularDishIds}
        />
      )}

      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          qrUser={qrUser}
          onClose={() => { setGenioOpen(false); refreshLocalPMap(); setProfileTrigger((n) => n + 1); }}
          onResult={(dish) => {
            setGenioOpen(false);
            refreshLocalPMap();
            setProfileTrigger((n) => n + 1);
            // Scroll to dish then open detail
            setTimeout(() => {
              const el = document.querySelector(`[data-dish-id="${dish.id}"]`);
              if (el) {
                // Scroll to the section title, not the card
                const section = el.closest("section");
                const target = section || el;
                const top = target.getBoundingClientRect().top + window.scrollY - 48;
                window.scrollTo({ top, behavior: "smooth" });
              }
              setTimeout(() => setSelectedDish(dish), 500);
            }, 250);
          }}
        />
      )}

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
              background: "white", borderRadius: 20, padding: "36px 28px",
              maxWidth: 340, width: "90%", textAlign: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              animation: "bdaySlideIn 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <span style={{ fontSize: "3rem", display: "block", marginBottom: 12 }}>🎉</span>
            <h3
              className="font-[family-name:var(--font-playfair)]"
              style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.3, margin: "0 0 8px" }}
            >
              ¡Listo, ya estás registrado!
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#666", lineHeight: 1.5, margin: "0 0 20px" }}>
              Recibirás un regalo especial en tu cumpleaños. El Genio ahora te conoce y te recomendará mejor.
            </p>
            <button
              onClick={() => setShowVerifiedModal(false)}
              className="active:scale-[0.97] transition-transform"
              style={{
                background: "#F4A623", color: "white", border: "none",
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
              background: "white",
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
              <X size={18} color="#ccc" />
            </button>

            {captureStatus === "success" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "2.8rem", display: "block", marginBottom: 14 }}>🧞</span>
                <h3
                  className="font-[family-name:var(--font-playfair)]"
                  style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", marginBottom: 8 }}
                >
                  ¡Listo{captureName ? `, ${captureName}` : ""}!
                </h3>
                <p style={{ color: "#888", fontSize: "0.9rem", lineHeight: 1.5 }}>
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
                    style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0e0e0e", lineHeight: 1.2 }}
                  >
                    Guarda tus gustos
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "#888", marginTop: 6, lineHeight: 1.5 }}>
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
                      background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                      padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <input
                    type="email"
                    value={captureEmail}
                    onChange={(e) => setCaptureEmail(e.target.value)}
                    placeholder="tu@email.com"
                    style={{
                      background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10,
                      padding: "12px 16px", color: "#0e0e0e", fontSize: "0.92rem",
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
                      width: "100%", marginTop: 4, background: "#F4A623", color: "white",
                      borderRadius: 50, padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                      border: "none", fontFamily: "inherit", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(244,166,35,0.3)",
                      opacity: captureStatus === "loading" ? 0.6 : 1,
                    }}
                  >
                    {captureStatus === "loading" ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#bbb", marginTop: 12 }}>
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
