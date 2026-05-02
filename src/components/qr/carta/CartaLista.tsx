"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { Search, X, User, Sparkles } from "lucide-react";
import { trackCategoryDwell } from "@/lib/sessionTracker";
import { trackSearchPerformed } from "./utils/cartaAnalytics";
import { getPersonalizedDishes, type PersonalizationMap } from "@/lib/qr/utils/getPersonalizedDishes";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { ScoringDish } from "@/lib/qr/utils/dishScoring";
import { getGuestId } from "@/lib/guestId";
import PromoCarousel from "../capture/PromoCarousel";
import GenioVeganCarousel from "./GenioVeganCarousel";
import GenioVegetarianCarousel from "./GenioVegetarianCarousel";
import GenioGlutenFreeCarousel from "./GenioGlutenFreeCarousel";
import GenioLactoseFreeCarousel from "./GenioLactoseFreeCarousel";
import GenioSoyFreeCarousel from "./GenioSoyFreeCarousel";
import GenioSmartCarousel from "./GenioSmartCarousel";
import { getCarouselMode, getCarouselScrollId, getCarouselNavName, hasMatchingDishes, getDietMessage } from "@/lib/qr/utils/carouselMode";
import GenioDietMessage from "./GenioDietMessage";
import VeganFloatingPill from "./VeganFloatingPill";
import VegetarianFloatingPill from "./VegetarianFloatingPill";
import GlutenFreeFloatingPill from "./GlutenFreeFloatingPill";
import ExperienceBanner from "../capture/ExperienceBanner";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import ViewSelector from "./ViewSelector";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import { trackCartaDishOpenedInList } from "./utils/cartaAnalytics";
import HeroSlim from "./HeroSlim";
import DishDetail from "./DishDetail";
import DishDetailErrorBoundary from "./DishDetailErrorBoundary";
import BirthdayBanner from "../capture/BirthdayBanner";
import BirthdayAutoModal from "../capture/BirthdayAutoModal";
import GenioOnboarding from "../genio/GenioOnboarding";
import GenioFab from "./GenioFab";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import WaiterButton from "../garzon/WaiterButton";
import { norm } from "@/lib/normalize";
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

interface Props {
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


export default function CartaLista({
  restaurant,
  categories,
  dishes,
  promotions,
  ratingMap,
  reviews,
  tableId,
  qrUser,
  onProfileOpen,
  onReady,
  readyKey,
  showWaiter,
  marketingPromos,
  timeOfDay: timeOfDayProp,
  weather: weatherProp,
  popularDishIds: popularDishIdsProp,
  announcements,
}: Props) {
  const lang = useLang();
  const { hasNewLikes, clearNewLikes } = useFavorites();
  const [hasCompletedGenio, setHasCompletedGenio] = useState(false);
  useEffect(() => {
    const check = () => {
      setHasCompletedGenio(!!(localStorage.getItem("qr_diet") && localStorage.getItem("qr_restrictions")));
    };
    const onGenioUpdated = () => {
      check();
      // Auto-scroll to diet carousel after Genio completes
      setTimeout(() => {
        const diet = localStorage.getItem("qr_diet");
        const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
        const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
        const scrollId = getCarouselScrollId(mode);
        const el = scrollId ? document.getElementById(scrollId) : null;
        const target = el || document.getElementById("genio-diet-message");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 500);
    };
    check();
    window.addEventListener("genio-updated", onGenioUpdated);
    return () => window.removeEventListener("genio-updated", onGenioUpdated);
  }, []);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { sortKey, setSortKey, rankings } = useCartaSort(restaurant.id, "lista");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!query || query.length < 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const q = norm(query.trim());
      const count = dishes.filter((d) => norm(d.name || "").includes(q) || norm(d.description || "").includes(q)).length;
      trackSearchPerformed(restaurant.id, q, count);
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, dishes, restaurant.id]);
  const popularDishIds = popularDishIdsProp ?? new Set<string>();

  const heroDishes = useMemo(() => {
    const recommendedWithPhotos = dishes.filter(
      (d) => d.tags?.includes("RECOMMENDED") && d.photos?.[0]
    );
    if (recommendedWithPhotos.length > 0) return recommendedWithPhotos;
    const popularWithPhotos = dishes.filter(
      (d) => popularDishIds.has(d.id) && d.photos?.[0]
    ).slice(0, 3);
    if (popularWithPhotos.length > 0) return popularWithPhotos;
    const withPhotos = dishes.filter((d) => d.photos?.[0]);
    if (withPhotos.length <= 3) return withPhotos;
    return [...withPhotos].sort((a, b) => a.position - b.position).slice(0, 3);
  }, [dishes, popularDishIds]);

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

  useEffect(() => { onReady?.(); }, [readyKey]);

  // Background fetch: enrich pMap with likedIngredients for autoRecommended badges
  useEffect(() => {
    const guestId = getGuestId();
    if (!guestId && !qrUser?.id) return;
    fetch(`/api/qr/profile?restaurantId=${restaurant.id}&guestId=${guestId}`).then((r) => r.json())
      .then((d) => {
        if (!d.profile) return;
        const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, d.profile, scoringCtx);
        if (result.hasPersonalization) setPMap(result.map);
      })
      .catch(() => {});
  }, [restaurant.id, categories, dishes, qrUser?.id, scoringCtx, profileTrigger]);

  const hasPromos = marketingPromos && marketingPromos.length > 0;

  const dietNavItem = useMemo(() => {
    if (typeof window === "undefined") return null;
    const diet = localStorage.getItem("qr_diet");
    const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
    if (!mode) return null;
    if (!hasMatchingDishes(dishes, categories, mode, diet, restrictions.filter((r: string) => r !== "ninguna"))) return null;
    return { id: "diet-carousel", name: getCarouselNavName(mode), scrollTo: getCarouselScrollId(mode) };
  }, [restaurant, hasCompletedGenio, dishes, categories]);

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

  useEffect(() => {
    const prev = catStartRef.current;
    if (prev.id && prev.id !== activeCategory) {
      const dwellMs = Date.now() - prev.start;
      if (dwellMs > 1000) trackCategoryDwell(prev.id, dwellMs);
    }
    catStartRef.current = { id: activeCategory, start: Date.now() };
  }, [activeCategory]);

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

  const [genioOpen, setGenioOpen] = useState(false);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll category nav to active
  useEffect(() => {
    if (activeCatRef.current && catScrollRef.current) {
      const container = catScrollRef.current;
      const el = activeCatRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [activeCategory]);

  // IntersectionObserver-based active category detection
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const allCats = hasPromos
      ? [{ id: "promos" }, ...categories]
      : categories;
    for (const cat of allCats) {
      const el = document.getElementById(`lista-cat-${cat.id}`);
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
    // Observe diet carousel for active nav state
    if (dietNavItem) {
      const dietEl = document.getElementById(dietNavItem.scrollTo);
      if (dietEl) {
        const dietObs = new IntersectionObserver(
          ([entry]) => { if (entry.isIntersecting) setActiveCategory("diet-carousel"); },
          { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
        );
        dietObs.observe(dietEl);
        observers.push(dietObs);
      }
    }
    return () => observers.forEach(obs => obs.disconnect());
  }, [categories, hasPromos, dietNavItem]);

  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of [...categories].sort((a, b) => a.position - b.position)) {
      const catDishes = dishes
        .filter((d) => d.categoryId === cat.id)
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
      result.push(...catDishes);
    }
    return result;
  }, [categories, dishes, pMap]);

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (query) {
        const q = norm(query.trim());
        return norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q);
      }
      return true;
    });
  }, [dishes, query]);

  const grouped = useMemo(() => {
    const base = groupDishesByCategory(filtered, categories);
    // When the user picked a non-default sort, override the per-category
    // ordering — Genio personalization is the default behavior.
    if (sortKey !== "default") {
      return base.map((g) => ({ ...g, dishes: applyCartaSort(g.dishes, sortKey, rankings) }));
    }
    if (!pMap) return base;
    return base.map((g) => ({
      ...g,
      dishes: [...g.dishes].sort((a, b) => {
        const aScore = pMap.get(a.id)?.score ?? 50;
        const bScore = pMap.get(b.id)?.score ?? 50;
        const aAuto = pMap.get(a.id)?.autoRecommended && aScore > 10 ? 1 : 0;
        const bAuto = pMap.get(b.id)?.autoRecommended && bScore > 10 ? 1 : 0;
        if (aAuto !== bAuto) return bAuto - aAuto;
        const aRec = a.tags?.includes("RECOMMENDED") && aScore > 10 ? 1 : 0;
        const bRec = b.tags?.includes("RECOMMENDED") && bScore > 10 ? 1 : 0;
        if (aRec !== bRec) return bRec - aRec;
        if (aScore !== bScore) return bScore - aScore;
        return a.position - b.position;
      }),
    }));
  }, [filtered, categories, pMap, sortKey, rankings]);

  const handleDishClick = (dish: Dish) => {
    setSelectedDish(dish);
    trackCartaDishOpenedInList(restaurant.id, dish.id, isGeniePick(dish));
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#f7f7f5" }}>
      {/* Hero Slim */}
      <HeroSlim restaurant={restaurant} heroDishes={heroDishes} onDishSelect={(d) => { setDishFromHero(true); setSelectedDish(d); }} />

      {/* STICKY NAV wrapper — single sticky container so toggling search doesn't break position */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}>
        {searchOpen ? (
          <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
            <Search size={16} color="rgba(14,14,14,0.35)" style={{ flexShrink: 0 }} />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(lang, "search")}
              className="font-[family-name:var(--font-dm)]"
              style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "#0e0e0e", background: "transparent", fontFamily: "inherit" }}
            />
            <button onClick={() => { setSearchOpen(false); setQuery(""); }} style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}>
              <X size={18} color="rgba(14,14,14,0.4)" />
            </button>
          </div>
        ) : (
          <nav style={{ height: 44, display: "flex", alignItems: "center" }}>
            {/* Category tabs */}
            <div
              ref={catScrollRef}
              className="flex overflow-x-auto"
              style={{ flex: 1, height: "100%", paddingLeft: 12, paddingRight: 4, gap: 20, scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
            >
              {dietNavItem && (() => {
                const isActive = "diet-carousel" === activeCategory;
                return (
                  <button
                    key="diet-carousel"
                    ref={isActive ? activeCatRef : null}
                    onClick={() => { setActiveCategory("diet-carousel"); const el = document.getElementById(dietNavItem.scrollTo); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                    className="shrink-0 font-[family-name:var(--font-dm)]"
                    style={{ height: "100%", display: "flex", alignItems: "center", padding: "0 2px", fontSize: "1rem", fontWeight: isActive ? 700 : 500, color: isActive ? "#0e0e0e" : "#999", background: "none", border: "none", borderBottom: isActive ? "2px solid #F4A623" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap" }}
                  >{dietNavItem.name}</button>
                );
              })()}
              {hasPromos && (() => {
                const isActive = "promos" === activeCategory;
                return (
                  <button
                    key="promos"
                    ref={isActive ? activeCatRef : null}
                    onClick={() => { setActiveCategory("promos"); const el = document.getElementById("lista-cat-promos"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 52, behavior: "smooth" }); }}
                    className="shrink-0 font-[family-name:var(--font-dm)]"
                    style={{ height: "100%", display: "flex", alignItems: "center", padding: "0 2px", fontSize: "1rem", fontWeight: isActive ? 700 : 500, color: isActive ? "#0e0e0e" : "#999", background: "none", border: "none", borderBottom: isActive ? "2px solid #F4A623" : "2px solid transparent", cursor: "pointer" }}
                  >Ofertas</button>
                );
              })()}
              {categories.filter((c) => c.isActive).sort((a, b) => a.position - b.position).map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    ref={isActive ? activeCatRef : null}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      const el = document.getElementById(`lista-cat-${cat.id}`);
                      if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY - 52;
                        window.scrollTo({ top, behavior: "smooth" });
                      }
                    }}
                    className="shrink-0 font-[family-name:var(--font-dm)]"
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 2px",
                      fontSize: "1rem",
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#0e0e0e" : "#999",
                      background: "none",
                      border: "none",
                      borderBottom: isActive ? "2px solid #F4A623" : "2px solid transparent",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
            {/* Search + Sort */}
            <div style={{ flexShrink: 0, paddingRight: 12, paddingLeft: 4, display: "flex", alignItems: "center", gap: 6, height: "100%" }}>
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(14,14,14,0.06)", border: "none", cursor: "pointer" }}
                aria-label="Buscar"
              >
                <Search size={19} color="#666" />
              </button>
              <SortChip sortKey={sortKey} setSortKey={setSortKey} salesMode={rankings?.sales?.mode || null} />
            </div>
          </nav>
        )}
      </div>

      {/* Announcement banner — below nav */}
      {announcements && announcements.length > 0 && <AnnouncementBanner announcements={announcements} />}

      {/* EMPTY STATE */}
      {grouped.length === 0 && (
        <div style={{ padding: "64px 32px", textAlign: "center" }}>
          <p style={{ color: "rgba(14,14,14,0.45)", fontSize: "0.9rem" }}>
            No encontramos platos que coincidan.
          </p>
          <button
            onClick={() => { setQuery(""); }}
            style={{ marginTop: 12, fontSize: "0.88rem", color: "#F4A623", fontWeight: 600, background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* OFERTAS section */}
      {hasPromos && (
        <section id="lista-cat-promos" style={{ padding: "16px 12px 0" }}>
          <PromoCarousel restaurantId={restaurant.id} initialPromos={marketingPromos} compact onViewDish={(dishId) => {
            const dish = dishes.find(d => d.id === dishId);
            if (dish) setSelectedDish(dish);
          }} />
        </section>
      )}

      {/* Genio diet carousels */}
      {typeof window !== "undefined" && (() => {
        const diet = localStorage.getItem("qr_diet");
        const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
        const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
        const onDishClick = (dishId: string) => { const dish = dishes.find(d => d.id === dishId); if (dish) setSelectedDish(dish); };
        const activeRestrictions = restrictions.filter((r: string) => r !== "ninguna");
        const msgType = !mode || !hasMatchingDishes(dishes, categories, mode, diet, activeRestrictions) ? getDietMessage(diet, restrictions, (restaurant as any).dietType, dishes, categories) : null;
        if (msgType) return <div style={{ paddingTop: 20 }}><GenioDietMessage type={msgType} /></div>;
        if (!mode) return null;
        return (
          <div style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {mode === "vegan" && <GenioVeganCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "vegan+gf" && <GenioVeganCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} alsoGlutenFree />}
            {mode === "vegetarian" && <GenioVegetarianCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "vegetarian+gf" && <GenioVegetarianCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} alsoGlutenFree />}
            {mode === "glutenfree" && <GenioGlutenFreeCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "lactosefree" && <GenioLactoseFreeCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "soyfree" && <GenioSoyFreeCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "smart" && <GenioSmartCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} diet={diet || "omnivore"} restrictions={activeRestrictions} />}
          </div>
        );
      })()}

      {/* CATEGORIES */}
      {grouped.map(({ category, dishes: catDishes }, index) => (
        <section key={category.id} id={`lista-cat-${category.id}`} style={{ padding: "20px 12px 0" }}>
          {index === Math.max(2, Math.floor(grouped.length * 0.4)) && <div style={{ margin: "0 -4px 12px" }}><ExperienceBanner restaurantId={restaurant.id} /></div>}
          {index === Math.max(4, Math.floor(grouped.length * 0.75)) && <div style={{ margin: "-16px -12px 13px" }}><BirthdayBanner restaurantId={restaurant.id} restaurantName={restaurant.name} /></div>}
          <div style={{ padding: "0 8px", marginBottom: 8 }}>
            <h2
              className="font-[family-name:var(--font-playfair)]"
              style={{ fontSize: "1.1rem", fontWeight: 600, color: "#777" }}
            >
              {category.name}
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catDishes.map((dish) => {
              const entry = pMap?.get(dish.id);
              return (
                <DishListCard
                  key={dish.id}
                  dish={dish}
                  rating={ratingMap?.[dish.id]}
                  autoRecommended={entry?.autoRecommended}
                  isExploration={entry?.isExploration}
                  restaurantName={restaurant.name}
                  isPopular={popularDishIds.has(dish.id)}
                  onClick={() => {
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
                    handleDishClick(dish);
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}

      {/* Powered by footer */}
      <footer
        className="font-[family-name:var(--font-dm)]"
        style={{
          paddingBottom: 100, marginTop: 40,
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
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <span style={{ color: "#bbb", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span className="font-[family-name:var(--font-playfair)]" style={{ color: "#999", fontSize: "0.82rem", fontWeight: 700 }}>
            QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
          </span>
        </a>
        <span style={{ color: "#ccc", fontSize: "0.62rem" }}>© {new Date().getFullYear()}</span>
      </footer>

      {/* Floating diet pills */}
      {typeof window !== "undefined" && (() => {
        const diet = localStorage.getItem("qr_diet");
        const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
        const isOmnivoreRestaurant = (restaurant as any).dietType !== "VEGAN" && (restaurant as any).dietType !== "VEGETARIAN";
        return (
          <>
            {diet === "vegan" && isOmnivoreRestaurant && dishes.some(d => (d as any).dishDiet === "VEGAN") && <VeganFloatingPill />}
            {diet === "vegetarian" && isOmnivoreRestaurant && dishes.some(d => (d as any).dishDiet === "VEGETARIAN" || (d as any).dishDiet === "VEGAN") && <VegetarianFloatingPill />}
            {diet === "omnivore" && restrictions.includes("gluten") && dishes.some(d => (d as any).isGlutenFree) && <GlutenFreeFloatingPill />}
          </>
        );
      })()}

      {/* Floating buttons */}
      <div className="fixed z-50 flex flex-col items-end" style={{ right: 14, bottom: "calc(54px + env(safe-area-inset-bottom))", gap: 10 }}>
        <GenioFab hasCompletedGenio={hasCompletedGenio} onOpen={() => setGenioOpen(true)} />
        {showWaiter && <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />}
        {(restaurant as any).plan !== "FREE" && <ViewSelector restaurantId={restaurant.id} enabledLangs={(restaurant as any).enabledLangs} plan={(restaurant as any).plan} />}
      </div>
      <style>{`
        @keyframes genioFabFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      `}</style>

      <BirthdayAutoModal restaurantId={restaurant.id} restaurantName={restaurant.name} />

      {/* Genio */}
      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          qrUser={qrUser}
          restaurantDietType={(restaurant as any).dietType}
          onClose={() => { setGenioOpen(false); setProfileTrigger((n) => n + 1); }}
          onResult={(dish) => {
            setGenioOpen(false);
            setProfileTrigger((n) => n + 1);
            setTimeout(() => setSelectedDish(dish), 250);
          }}
        />
      )}

      {/* DishDetail modal */}
      {selectedDish && (
        <DishDetailErrorBoundary onClose={() => { setSelectedDish(null); setDishFromHero(false); }}>
        <DishDetail
          dish={selectedDish}
          allDishes={dishFromHero ? [selectedDish] : sortedDishes}
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
    </div>
  );
}



function DishListCard({
  dish,
  rating,
  onClick,
  autoRecommended,
  isExploration,
  restaurantName,
  isPopular,
}: {
  dish: Dish;
  rating?: { avg: number; count: number };
  onClick: () => void;
  autoRecommended?: boolean;
  isExploration?: boolean;
  restaurantName?: string;
  isPopular?: boolean;
}) {
  const photo = getDishPhoto(dish);
  const [imgLoaded, setImgLoaded] = useState(false);
  const geniePick = isGeniePick(dish);
  const isNew = dish.tags?.includes("NEW");
  const isPromo = dish.tags?.includes("PROMOTION");
  const isRec = dish.tags?.includes("RECOMMENDED");

  const cardBg = isRec ? "rgba(244,166,35,0.04)" : "white";
  const cardBorder = isRec ? "2px solid rgba(244,166,35,0.3)" : "1px solid rgba(0,0,0,0.04)";

  return (
    <button
      onClick={onClick}
      className="active:scale-[0.99] transition-transform"
      style={{
        width: "100%",
        display: "flex",
        gap: 0,
        padding: 0,
        overflow: "hidden",
        background: cardBg,
        borderRadius: 14,
        border: cardBorder,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div style={{ width: 140, minHeight: 140, alignSelf: "stretch", overflow: "hidden", flexShrink: 0, position: "relative", background: photo ? "#e8e4dc" : "linear-gradient(135deg, #f7f7f5, #e8e4d8)" }}>
        {photo ? (
          <>
            {!imgLoaded && <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)", animation: "shimmer 1.5s infinite" }} /></div>}
            <Image src={photo} alt={dish.name} fill className="object-cover" sizes="360px" quality={95} onLoad={() => setImgLoaded(true)} style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }} />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>🍽</div>
        )}
        {isNew && <span style={{ position: "absolute", top: 6, left: 6, fontSize: "9px", fontWeight: 700, color: "white", background: "#e85530", padding: "2px 7px", borderRadius: 50, letterSpacing: "0.05em", fontFamily: "var(--font-dm)" }}>NUEVO</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 12px" }}>
        {(isRec || isPopular) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 3 }}>
            {isRec && (
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50 }}>
                ⭐ Recomendado
              </span>
            )}
            {isPopular && (
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50 }}>
                🔥 Popular hoy
              </span>
            )}
          </div>
        )}
        <h3
          className="font-[family-name:var(--font-playfair)]"
          style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0e0e0e", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{dish.name}</span>
          {(dish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "12px", flexShrink: 0 }}>🌿</span>}
          {(dish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "12px", flexShrink: 0 }}>🥗</span>}
          {(dish as any).isSpicy && <span style={{ fontSize: "12px", flexShrink: 0 }}>🌶️</span>}
        </h3>
        {dish.description && (
          <p
            style={{
              fontSize: "1rem",
              color: "rgba(14,14,14,0.5)",
              lineHeight: 1.4,
              marginBottom: 6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {dish.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            className="font-[family-name:var(--font-dm)]"
            style={{ fontSize: "0.95rem", color: dish.discountPrice ? "#F4A623" : "#888" }}
          >
            ${(dish.discountPrice || dish.price)?.toLocaleString("es-CL") ?? "—"}
          </span>
          {dish.discountPrice && (
            <span style={{ fontSize: "0.78rem", color: "#999", textDecoration: "line-through" }}>
              ${dish.price?.toLocaleString("es-CL")}
            </span>
          )}
          {isPromo && (
            <span style={{ fontSize: "0.62rem", fontWeight: 600, padding: "2px 6px", background: "rgba(244,166,35,0.12)", color: "#F4A623", borderRadius: 4 }}>
              Promo
            </span>
          )}
          {rating && rating.count > 0 && (
            <span style={{ fontSize: "0.72rem", color: "rgba(14,14,14,0.45)" }}>
              ★ {rating.avg.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
