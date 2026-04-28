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
import ExperienceBanner from "../capture/ExperienceBanner";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import ViewSelector from "./ViewSelector";
import { groupDishesByCategory, isGeniePick, getDishPhoto } from "./utils/dishHelpers";
import { trackCartaDishOpenedInList } from "./utils/cartaAnalytics";
import DishDetail from "./DishDetail";
import BirthdayBanner from "../capture/BirthdayBanner";
import GenioOnboarding from "../genio/GenioOnboarding";
import WaiterButton from "../garzon/WaiterButton";
import { norm } from "@/lib/normalize";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";


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
}: Props) {
  const lang = useLang();
  const { hasNewLikes, clearNewLikes } = useFavorites();
  const hasCompletedGenio = typeof window !== "undefined" && !!(localStorage.getItem("qr_diet") && localStorage.getItem("qr_restrictions"));
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
    return () => observers.forEach(obs => obs.disconnect());
  }, [categories, hasPromos]);

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
  }, [filtered, categories, pMap]);

  const handleDishClick = (dish: Dish) => {
    setSelectedDish(dish);
    trackCartaDishOpenedInList(restaurant.id, dish.id, isGeniePick(dish));
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-dm)]" style={{ background: "#f7f7f5" }}>
      {/* TOP BAR: mini hero oscuro */}
      <div style={{ position: "relative", background: "#1a1a1a", overflow: "hidden" }}>
        {/* Background photo blur */}
        {(() => {
          const bgPhoto = dishes.find(d => d.photos?.[0])?.photos?.[0];
          return bgPhoto ? (
            <div style={{ position: "absolute", inset: -20, zIndex: 0 }}>
              <Image src={bgPhoto} alt="" fill className="object-cover" sizes="100vw" style={{ filter: "blur(20px) brightness(0.3)", transform: "scale(1.2)" }} />
            </div>
          ) : null;
        })()}
        <div style={{ position: "relative", zIndex: 1, padding: "16px 16px 14px", display: "flex", alignItems: "center" }}>
          {/* Left: logo + name — click reloads page */}
          <button onClick={() => window.location.reload()} className="flex items-center gap-2" style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {restaurant.logoUrl ? (
              <Image src={restaurant.logoUrl} alt={restaurant.name} width={30} height={30} className="rounded-full" style={{ flexShrink: 0, border: "1px solid rgba(255,255,255,0.12)" }} />
            ) : (
              <div className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: "rgba(255,255,255,0.12)", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.8)", flexShrink: 0 }}>
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "1.14rem", fontWeight: 400, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
              {restaurant.name}
            </span>
          </button>
        </div>
        {/* Bottom accent line */}
        <div style={{ position: "relative", zIndex: 1, height: 2, background: "linear-gradient(90deg, #F4A623, rgba(244,166,35,0.2), transparent)" }} />
      </div>

      {/* Promos */}
      {/* STICKY NAV: search overlay or category tabs with search icon */}
      {searchOpen ? (
        <div
          className="sticky top-0 z-20"
          style={{ background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
        >
          <Search size={16} color="rgba(14,14,14,0.35)" style={{ flexShrink: 0 }} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "search")}
            className="font-[family-name:var(--font-dm)]"
            style={{ flex: 1, border: "none", outline: "none", fontSize: "0.92rem", color: "#0e0e0e", background: "transparent", fontFamily: "inherit" }}
          />
          <button onClick={() => { setSearchOpen(false); setQuery(""); }} style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}>
            <X size={18} color="rgba(14,14,14,0.4)" />
          </button>
        </div>
      ) : (
        <nav
          className="sticky top-0 z-20"
          style={{ background: "#ffffff", borderBottom: "1px solid #f0f0f0", height: 44, display: "flex", alignItems: "center", transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
        >
          {/* Category tabs */}
          <div
            ref={catScrollRef}
            className="flex overflow-x-auto"
            style={{ flex: 1, height: "100%", paddingLeft: 12, paddingRight: 4, gap: 20, scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
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
          {/* Search icon */}
          <div style={{ flexShrink: 0, paddingRight: 12, paddingLeft: 4, display: "flex", alignItems: "center", height: "100%" }}>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(14,14,14,0.06)", border: "none", cursor: "pointer" }}
              aria-label="Buscar"
            >
              <Search size={19} color="#666" />
            </button>
          </div>
        </nav>
      )}

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
        <section id="lista-cat-promos" style={{ padding: "12px 12px 0" }}>
          <PromoCarousel restaurantId={restaurant.id} initialPromos={marketingPromos} onViewDish={(dishId) => {
            const dish = dishes.find(d => d.id === dishId);
            if (dish) setSelectedDish(dish);
          }} />
        </section>
      )}

      {false && personalizing && (
        <div />
      )}

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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

      {/* Genio nudge — compact if completed */}
      {hasCompletedGenio ? (
        <button
          onClick={() => setGenioOpen(true)}
          className="font-[family-name:var(--font-dm)] active:scale-[0.98] transition-transform"
          style={{
            margin: "32px 20px 0", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
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
            margin: "55px 20px 0", padding: "24px 20px", textAlign: "center",
            background: "linear-gradient(135deg, #FFF7E8 0%, #FFEDD0 100%)",
            border: "1px solid rgba(244,166,35,0.2)", borderRadius: 20,
          }}
        >
          <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "16px", fontWeight: 600, color: "#0e0e0e", margin: "0 0 2px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span>🧞</span> {t(lang, "dontKnowWhat")} {restaurant.name}?
          </h3>
          <p style={{ fontSize: "14.5px", color: "#8a5a2c", margin: "0 0 16px" }}>{t(lang, "gBannerSub")}</p>
          <button
            onClick={() => setGenioOpen(true)}
            className="active:scale-[0.97] transition-transform"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#F4A623",
              color: "white", padding: "11px 22px", borderRadius: 100,
              fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "0 8px 20px rgba(244,166,35,0.3)", fontFamily: "inherit",
            }}
          >
            {t(lang, "askGenieShort")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      )}

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
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <span style={{ color: "#bbb", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span className="font-[family-name:var(--font-playfair)]" style={{ color: "#999", fontSize: "0.82rem", fontWeight: 700 }}>
            QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
          </span>
        </a>
        <span style={{ color: "#ccc", fontSize: "0.62rem" }}>© {new Date().getFullYear()}</span>
      </footer>

      {/* Floating buttons */}
      <div className="fixed z-50 flex flex-col items-end" style={{ right: 14, bottom: "calc(54px + env(safe-area-inset-bottom))", gap: 10 }}>
        <button
          onClick={() => setGenioOpen(true)}
          className="flex items-center justify-center rounded-full active:scale-95"
          style={{ height: 60, width: 60, background: "#F4A623", boxShadow: "0 4px 18px rgba(244,166,35,0.35)", borderRadius: 50, transition: "box-shadow 0.3s ease", position: "relative" }}
        >
          <span style={{ fontSize: "26px", lineHeight: 1, flexShrink: 0, animation: "genioFabFloat 1.5s ease-in-out infinite" }}>🧞</span>
          {hasCompletedGenio && <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", lineHeight: 1, color: "white", fontWeight: 700 }}>✓</span>}
        </button>
        {showWaiter && <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />}
        <ViewSelector restaurantId={restaurant.id} />
      </div>
      <style>{`@keyframes genioFabFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }`}</style>

      {/* Genio */}
      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          qrUser={qrUser}
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
        <DishDetail
          dish={selectedDish}
          allDishes={sortedDishes}
          categories={categories}
          restaurantId={restaurant.id}
          reviews={reviews}
          ratingMap={ratingMap}
          onClose={() => { setSelectedDish(null); if (hasNewLikes) { clearNewLikes(); setProfileTrigger((n) => n + 1); } }}
          onChangeDish={setSelectedDish}
          personalizationMap={pMap}
          restaurantName={restaurant.name}
          popularDishIds={popularDishIds}
        />
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
  const geniePick = isGeniePick(dish);
  const isNew = dish.tags?.includes("NEW");
  const isPromo = dish.tags?.includes("PROMOTION");
  const isRec = dish.tags?.includes("RECOMMENDED");

  const hasAutoLabel = autoRecommended && !isRec;
  const cardBg = isRec
    ? "rgba(244,166,35,0.04)"
    : hasAutoLabel
    ? (isExploration ? "rgba(99,102,241,0.04)" : "rgba(244,166,35,0.06)")
    : "white";
  const cardBorder = isRec
    ? "2px solid rgba(244,166,35,0.3)"
    : hasAutoLabel
    ? `1.5px solid ${isExploration ? "rgba(99,102,241,0.2)" : "rgba(244,166,35,0.2)"}`
    : "1px solid rgba(0,0,0,0.04)";

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
      <div style={{ width: 130, minHeight: 120, alignSelf: "stretch", overflow: "hidden", flexShrink: 0, position: "relative", background: photo ? "#f0f0f0" : "linear-gradient(135deg, #f7f7f5, #e8e4d8)" }}>
        {photo ? (
          <Image src={photo} alt={dish.name} fill className="object-cover" sizes="360px" quality={95} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>🍽</div>
        )}
        {isNew && <span style={{ position: "absolute", top: 6, left: 6, fontSize: "9px", fontWeight: 700, color: "white", background: "#e85530", padding: "2px 7px", borderRadius: 50, letterSpacing: "0.05em", fontFamily: "var(--font-dm)" }}>NUEVO</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2 }}>
          <h3
            className="font-[family-name:var(--font-playfair)] flex items-center gap-1"
            style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0e0e0e", flex: 1, minWidth: 0 }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dish.name}</span>
            {(dish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "12px", flexShrink: 0 }}>🌿</span>}
            {(dish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "12px", flexShrink: 0 }}>🌱</span>}
            {(dish as any).isSpicy && <span style={{ fontSize: "12px", flexShrink: 0 }}>🌶️</span>}
            {hasAutoLabel && (
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50, flexShrink: 0 }}>
                ✨ Para ti
              </span>
            )}
            {isRec && !hasAutoLabel && (
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50, flexShrink: 0 }}>
                ⭐ Recomendado
              </span>
            )}
            {isPopular && (
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#d97706", background: "rgba(244,166,35,0.12)", padding: "2px 8px", borderRadius: 50, flexShrink: 0 }}>
                🔥 Popular hoy
              </span>
            )}
          </h3>
        </div>
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
            className="font-[family-name:var(--font-playfair)]"
            style={{ fontSize: "1.1rem", fontWeight: 400, color: dish.discountPrice ? "#F4A623" : "#0e0e0e" }}
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
