"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";

import { Search, X, Globe } from "lucide-react";
import { trackCategoryDwell } from "@/lib/sessionTracker";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import { trackSearchPerformed, trackCartaDishOpenedInList } from "./utils/cartaAnalytics";
import { getPersonalizedDishes, type PersonalizationMap } from "@/lib/qr/utils/getPersonalizedDishes";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { ScoringDish } from "@/lib/qr/utils/dishScoring";
import { getGuestId } from "@/lib/guestId";
import PromoCarousel from "../capture/PromoCarousel";
import ExperienceBanner from "../capture/ExperienceBanner";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import { groupDishesByCategory, getDishPhoto } from "./utils/dishHelpers";
import DishDetail from "./DishDetail";
import DishDetailErrorBoundary from "./DishDetailErrorBoundary";
import BirthdayAutoModal from "../capture/BirthdayAutoModal";
import { useClientAvoidsSpicy } from "./SpicyStamp";
import DishPlaceholderIcon from "./DishPlaceholderIcon";
import WaiterButton from "../garzon/WaiterButton";
import { norm } from "@/lib/normalize";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";
import AnnouncementBanner from "./AnnouncementBanner";

interface Review { id: string; dishId: string; rating: number; customerId: string; createdAt: Date; }

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

/* ═══════════════════════════════════════════
   HERO FULL-BLEED
   ═══════════════════════════════════════════ */
function FeedHero({ dishes, restaurant, onDishSelect }: { dishes: Dish[]; restaurant: Restaurant; onDishSelect: (d: Dish) => void }) {
  const lang = useLang();
  const heroDishes = useMemo(() => {
    const withPhoto = (arr: Dish[]) => arr.filter(d => d.photos?.[0]);
    const isFree = (((restaurant as any).plan) || 'FREE') === 'FREE'
    if (isFree) {
      const pool = withPhoto(dishes)
      if (pool.length === 0) return dishes.slice(0, 1)
      return [pool[Math.floor(Date.now() / 86400000) % pool.length]]
    }
    const recommended = dishes.filter(d => d.tags?.includes("RECOMMENDED"));
    const recWithPhoto = withPhoto(recommended);
    if (recWithPhoto.length > 0) return recWithPhoto;
    if (recommended.length > 0) return recommended;
    return withPhoto(dishes).slice(0, 3);
  }, [dishes, restaurant]);

  const [activeIdx, setActiveIdx] = useState(0);
  const touchStartX = useRef(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paused = useRef(false);

  const count = heroDishes.length;
  const dish = heroDishes[activeIdx] || heroDishes[0];

  // Auto-rotate
  useEffect(() => {
    if (count <= 1) return;
    autoRef.current = setInterval(() => {
      if (!paused.current) setActiveIdx(prev => (prev + 1) % count);
    }, 5000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [count]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; paused.current = true; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      setActiveIdx(prev => diff < 0 ? (prev + 1) % count : (prev - 1 + count) % count);
    }
    setTimeout(() => { paused.current = false; }, 8000);
  };

  if (!dish) return null;

  const r = restaurant as any;
  const initial = r.name?.charAt(0) || "Q";
  const hasInsta = !!r.instagram;
  const hasWeb = !!r.website;

  // Tag for hero eyebrow
  const eyebrow = dish.tags?.includes("NEW")
    ? { emoji: "✨", text: t(lang, "feedHeroNew" as any) || "Nuevo en la carta" }
    : { emoji: "⭐", text: t(lang, "recommended" as any) || "Recomendado" };

  return (
    <div
      onClick={() => onDishSelect(dish)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: "relative", width: "100%", height: 460, overflow: "hidden", cursor: "pointer" }}
    >
      {/* Photo or gradient fallback */}
      {dish.photos?.[0] ? (
        <img
          src={getDishPhoto(dish, "hero") || dish.photos[0]}
          alt={dish.name}
          loading="eager"
          fetchPriority="high"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.5s ease" }}
        />
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-accent, #F4A623) 18%, #1a1a2e), color-mix(in srgb, var(--carta-accent, #F4A623) 6%, #0f3460))",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <DishPlaceholderIcon size={80} opacity={0.35} />
        </div>
      )}

      {/* Gradient */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "75%",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0.95) 100%)",
        zIndex: 1, pointerEvents: "none",
      }} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
        {/* Restaurant pill */}
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          padding: "5px 12px 5px 5px", borderRadius: 999,
        }}>
          {r.logoUrl ? (
            <img src={r.logoUrl} alt="" loading="lazy" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#1a1a1a" }}>
              {initial}
            </div>
          )}
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "-0.1px" }}>{r.name}</span>
        </div>

      </div>

      {/* Hero content */}
      <div style={{ position: "absolute", bottom: 28, left: 18, right: 18, zIndex: 3 }}>
        {/* Eyebrow */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "#EF9F27", color: "#1a1a1a",
          fontSize: 9, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
          letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 14,
        }}>
          {eyebrow.emoji} {eyebrow.text}
        </span>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-playfair)]" style={{
          color: "#fff", fontSize: 34, fontWeight: 600, margin: "0 0 6px",
          lineHeight: 1.05, letterSpacing: "-0.8px",
          textShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {dish.name}
        </h1>

        {/* Description */}
        {dish.description && (
          <p className="font-[family-name:var(--font-dm)]" style={{
            color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 1.45,
            margin: "0 0 20px", maxWidth: "92%",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            display: "-webkit-box", WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as any, overflow: "hidden",
          }}>
            {dish.description}
          </p>
        )}

        {/* Dots */}
        {count > 1 && (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {heroDishes.map((_, i) => (
              <div key={i} onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }} style={{
                width: i === activeIdx ? 22 : 6, height: 6,
                borderRadius: i === activeIdx ? 3 : "50%",
                background: i === activeIdx ? "#fff" : "rgba(255,255,255,0.35)",
                transition: "all 0.3s ease", cursor: "pointer",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FEED DISH CARD
   ═══════════════════════════════════════════ */
function FeedDishCard({ dish, onClick, isPopular, pEntry }: {
  dish: Dish; onClick: () => void;
  isPopular?: boolean;
  pEntry?: { autoRecommended?: boolean; reason?: string | null } | null;
}) {
  const lang = useLang();
  const photo = getDishPhoto(dish, "card");
  const isRec = dish.tags?.includes("RECOMMENDED");
  const isNew = dish.tags?.includes("NEW");
  const d = dish as any;
  const isVegan = d.dishDiet === "VEGAN";
  const isVegetarian = d.dishDiet === "VEGETARIAN";
  const isSpicy = d.isSpicy;
  const hasDiscount = !!dish.discountPrice && dish.discountPrice < dish.price;

  // Attribute circles
  const attrs: { emoji: string; title: string }[] = [];
  if (isVegan) attrs.push({ emoji: "🌿", title: "Vegano" });
  else if (isVegetarian) attrs.push({ emoji: "🥗", title: "Vegetariano" });
  if (isSpicy) attrs.push({ emoji: "🌶️", title: "Picante" });
  const visibleAttrs = attrs.slice(0, 3);

  return (
    <button
      onClick={onClick}
      className="active:scale-[0.985] transition-transform"
      style={{
        display: "block", width: "100%", background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.06)", borderRadius: 14,
        overflow: "hidden", cursor: "pointer", textAlign: "left",
        padding: 0, marginBottom: 20,
      }}
    >
      {/* Photo */}
      {photo ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10" }}>
          <img src={photo} alt={dish.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          {/* En CartaFeed el indicador de picante ya esta en los attribute circles
             abajo de la foto, no agregamos un SpicyStamp adicional. */}

          {/* Badges top-left */}
          {(isRec || isPopular || pEntry?.autoRecommended) && (
            <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 5, flexWrap: "wrap", maxWidth: "calc(100% - 60px)" }}>
              {isRec && (
                <span style={{ fontSize: 13, fontWeight: 700, padding: "5px 11px", borderRadius: 7, letterSpacing: "0.2px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(255,244,221,0.95)", color: "#854F0B" }}>
                  ⭐ {t(lang, "recommended" as any) || "Recomendado"}
                </span>
              )}
              {isPopular && (
                <span style={{ fontSize: 13, fontWeight: 700, padding: "5px 11px", borderRadius: 7, letterSpacing: "0.2px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(250,238,218,0.95)", color: "#C04A1B" }}>
                  🔥 {t(lang, "feedPopular" as any) || "Popular hoy"}
                </span>
              )}
              {pEntry?.autoRecommended && (
                <span style={{ fontSize: 13, fontWeight: 700, padding: "5px 11px", borderRadius: 7, letterSpacing: "0.2px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(255,244,221,0.95)", color: "#854F0B" }}>
                  🧞 Para ti
                </span>
              )}
            </div>
          )}

          {/* Attribute circles bottom-right */}
          {visibleAttrs.length > 0 && (
            <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
              {visibleAttrs.map((a, i) => (
                <div key={i} title={a.title} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.95)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                }}>
                  {a.emoji}
                </div>
              ))}
            </div>
          )}

          {/* Discount badge top-left */}
          {hasDiscount && (
            <span style={{
              position: "absolute", top: isNew ? 34 : 10, left: 10,
              fontSize: 13, fontWeight: 800, color: "#fff",
              background: "var(--carta-accent, #F4A623)", padding: "4px 12px", borderRadius: 50,
              letterSpacing: "0.3px",
            }}>
              -{Math.round(100 - (dish.discountPrice! / dish.price) * 100)}% OFF
            </span>
          )}
        </div>
      ) : (
        <div style={{ width: "100%", aspectRatio: "16 / 10", background: "#f5f3ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", color: "#ddd" }}>
          🍽
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "12px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + NEW pill */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: 19, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.2px" }}>
              {dish.name}
            </span>
            {isNew && (
              <span style={{ display: "inline-block", background: "var(--carta-accent, #e85530)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.3px", verticalAlign: "middle" }}>
                {t(lang, "new" as any) || "NUEVO"}
              </span>
            )}
          </div>
          {/* Description */}
          {dish.description && (
            <p className="font-[family-name:var(--font-dm)]" style={{
              fontSize: 17, color: "#5a5a5a", lineHeight: 1.5, margin: 0,
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as any, overflow: "hidden",
            }}>
              {dish.description}
            </p>
          )}
        </div>
        {/* Price */}
        <div style={{ flexShrink: 0 }}>
          {hasDiscount ? (
            <div style={{ textAlign: "right" }}>
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: 15, fontWeight: 600, color: "var(--carta-accent, #F4A623)", letterSpacing: "-0.2px" }}>
                ${dish.discountPrice!.toLocaleString("es-CL")}
              </span>
              <br />
              <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: 12, color: "#999", textDecoration: "line-through" }}>
                ${dish.price.toLocaleString("es-CL")}
              </span>
            </div>
          ) : (
            <span className="font-[family-name:var(--font-dm)]" style={{ fontSize: 17, fontWeight: 500, color: "rgb(151,151,151)", letterSpacing: "-0.2px", whiteSpace: "nowrap" }}>
              ${dish.price.toLocaleString("es-CL")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function CartaFeed({
  restaurant, categories, dishes: rawDishes, promotions, ratingMap, reviews,
  tableId, qrUser, onProfileOpen, onReady, readyKey, showWaiter,
  marketingPromos, timeOfDay: timeOfDayProp, weather: weatherProp,
  popularDishIds: popularDishIdsProp, announcements,
}: Props) {
  const isFree = ((restaurant as any).plan || 'FREE') === 'FREE'
  const dishes = useMemo(
    () => isFree
      ? rawDishes.map((d: any) => d.tags?.includes('RECOMMENDED') ? { ...d, tags: (d.tags as string[]).filter(t => t !== 'RECOMMENDED') } : d)
      : rawDishes,
    [isFree, rawDishes],
  )
  const lang = useLang();
  const { hasNewLikes, clearNewLikes } = useFavorites();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { sortKey, setSortKey, rankings } = useCartaSort(restaurant.id, "feed");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!query || query.length < 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const results = dishes.filter(d => norm(d.name || "").includes(norm(query)) || norm(d.description || "").includes(norm(query)));
      trackSearchPerformed(restaurant.id, query, results.length);
    }, 1500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, restaurant.id]);

  const catNames = useMemo(() => { const m: Record<string, string> = {}; for (const c of categories) m[c.id] = c.name; return m; }, [categories]);
  const scoringCtx = useMemo(() => ({ timeOfDay: timeOfDayProp || "LUNCH", weather: weatherProp || "CLEAR", categoryNames: catNames }), [timeOfDayProp, weatherProp, catNames]);

  const pMapLocal = useMemo(() => {
    if (typeof window === "undefined") return null;
    const diet = localStorage.getItem("qr_diet");
    const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const dislikes = (() => { try { return JSON.parse(localStorage.getItem("qr_dislikes") || "[]"); } catch { return []; } })();
    if (!diet && restrictions.length === 0 && dislikes.length === 0) return null;
    const localProfile = { dietType: diet, restrictions, dislikedIngredients: dislikes, likedIngredients: {}, viewHistory: [], visitCount: 0, visitedCategoryIds: [], lastSessionDate: null };
    const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, localProfile, scoringCtx);
    return result.hasPersonalization ? result.map : null;
  }, [dishes, categories, scoringCtx]);
  const [pMap, setPMap] = useState<PersonalizationMap | null>(pMapLocal);
  const [profileTrigger, setProfileTrigger] = useState(0);
  const popularDishIds = popularDishIdsProp ?? new Set<string>();

  useEffect(() => {
    const guestId = getGuestId();
    if (!guestId && !qrUser?.id) return;
    fetch(`/api/qr/profile?restaurantId=${restaurant.id}&guestId=${guestId}`).then(r => r.json())
      .then(d => {
        if (!d.profile) return;
        const result = getPersonalizedDishes(dishes as unknown as ScoringDish[], categories, d.profile, scoringCtx);
        if (result.hasPersonalization) setPMap(result.map);
      })
      .catch(() => {});
  }, [restaurant.id, categories, dishes, qrUser?.id, scoringCtx, profileTrigger]);

  const hasPromos = marketingPromos && marketingPromos.length > 0;

  const clientAvoidsSpicyForSort = useClientAvoidsSpicy();
  const grouped = useMemo(() => {
    const base = groupDishesByCategory(
      query ? dishes.filter(d => norm(d.name || "").includes(norm(query)) || norm(d.description || "").includes(norm(query))) : dishes,
      categories,
    );
    let result = sortKey === "default" ? base : base.map((g) => ({ ...g, dishes: applyCartaSort(g.dishes, sortKey, rankings) }));
    // Hard rule: si el cliente filtra "sin picante", los picantes van al
    // final de la categoria sin importar score, RECOMMENDED u orden manual.
    if (clientAvoidsSpicyForSort) {
      result = result.map((g) => ({
        ...g,
        dishes: [...g.dishes].sort((a, b) => {
          const aSpicy = (a as any).isSpicy ? 1 : 0;
          const bSpicy = (b as any).isSpicy ? 1 : 0;
          return aSpicy - bSpicy; // 0 first, 1 last
        }),
      }));
    }
    return result;
  }, [dishes, categories, query, sortKey, rankings, clientAvoidsSpicyForSort]);

  const sortedDishes = useMemo(() => grouped.flatMap(g => g.dishes), [grouped]);

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishFromHero, setDishFromHero] = useState(false);

  // Sticky bar + scroll spy
  const [activeCategory, setActiveCategory] = useState(hasPromos ? "promos" : (categories[0]?.id || ""));
  const catScrollRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<HTMLButtonElement>(null);
  const catStartRef = useRef<{ id: string; start: number } | null>(null);

  useEffect(() => {
    if (activeCatRef.current && catScrollRef.current) {
      const container = catScrollRef.current;
      const btn = activeCatRef.current;
      container.scrollTo({ left: btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2, behavior: "smooth" });
    }
  }, [activeCategory]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const sections = grouped.map(g => {
        const el = document.getElementById(`feed-cat-${g.category.id}`);
        return el ? { id: g.category.id, top: el.offsetTop } : null;
      }).filter(Boolean) as { id: string; top: number }[];

      for (let i = sections.length - 1; i >= 0; i--) {
        if (y >= sections[i].top - 200) {
          if (activeCategory !== sections[i].id) {
            if (catStartRef.current) trackCategoryDwell(catStartRef.current.id, Date.now() - catStartRef.current.start);
            catStartRef.current = { id: sections[i].id, start: Date.now() };
            setActiveCategory(sections[i].id);
          }
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [grouped, activeCategory]);

  const handleDishClick = useCallback((dish: Dish) => {
    setSelectedDish(dish);
    trackCartaDishOpenedInList(restaurant.id, dish.id, false);
  }, [restaurant.id]);

  // Progressive loading: render categories in batches
  const INITIAL_CATS = 3;
  const BATCH_SIZE = 3;
  const [visibleCats, setVisibleCats] = useState(INITIAL_CATS);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when grouped changes (e.g. search)
  useEffect(() => { setVisibleCats(query ? grouped.length : INITIAL_CATS); }, [query, grouped.length]);

  useEffect(() => {
    if (visibleCats >= grouped.length) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCats(v => Math.min(v + BATCH_SIZE, grouped.length)); },
      { rootMargin: "600px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [visibleCats, grouped.length]);

  useEffect(() => { onReady?.(); }, [readyKey]);

  return (
    <div className="font-[family-name:var(--font-dm)]" style={{ background: "#fff", minHeight: "100vh", paddingBottom: 80 }}>
      {/* ═══ HERO ═══ */}
      <FeedHero dishes={dishes} restaurant={restaurant} onDishSelect={(d) => { setDishFromHero(true); setSelectedDish(d); }} />

      {/* ═══ STICKY BAR ═══ */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20, background: "#fff",
        borderBottom: "0.5px solid rgba(0,0,0,0.06)", padding: "12px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {searchOpen ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={14} color="#5a5a5a" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t(lang, "search") || "Buscar plato..."}
                  autoFocus
                  style={{ width: "100%", padding: "8px 10px 8px 32px", background: "#F5F4F1", border: "none", borderRadius: 999, fontSize: 16, color: "#1a1a1a", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <button onClick={() => { setSearchOpen(false); setQuery(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} color="#999" />
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setSearchOpen(true)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F1", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Search size={14} color="#5a5a5a" />
              </button>
              <SortChip sortKey={sortKey} setSortKey={setSortKey} salesMode={rankings?.sales?.mode || null} />
              <div ref={catScrollRef} className="hide-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
                {hasPromos && (
                  <button
                    onClick={() => { setActiveCategory("promos"); document.getElementById("feed-cat-promos")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    style={{ padding: "7px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeCategory === "promos" ? 500 : 400, whiteSpace: "nowrap", background: activeCategory === "promos" ? "rgba(239,159,39,0.12)" : "#F5F4F1", color: activeCategory === "promos" ? "#92400e" : "#5a5a5a" }}
                  >
                    🔥 {t(lang, "offers" as any) || "Ofertas"}
                  </button>
                )}
                {categories.map((cat, ci) => (
                  <button
                    key={cat.id}
                    ref={activeCategory === cat.id ? activeCatRef : undefined}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      // Ensure category is rendered before scrolling
                      const catIdx = grouped.findIndex(g => g.category.id === cat.id);
                      if (catIdx >= 0 && catIdx >= visibleCats) {
                        setVisibleCats(catIdx + 1);
                        requestAnimationFrame(() => { setTimeout(() => { document.getElementById(`feed-cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); });
                      } else {
                        document.getElementById(`feed-cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                    style={{
                      padding: "7px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                      fontSize: 13, fontWeight: activeCategory === cat.id ? 500 : 400, whiteSpace: "nowrap",
                      background: activeCategory === cat.id ? "rgba(239,159,39,0.12)" : "#F5F4F1",
                      color: activeCategory === cat.id ? "#92400e" : "#5a5a5a",
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ ANNOUNCEMENTS — sticky below category nav ═══ */}
      {announcements && announcements.length > 0 && (
        <div style={{ position: "sticky", top: 44, zIndex: 39 }}>
          <AnnouncementBanner announcements={announcements} accentColor={(restaurant as any).cartaAccentColor} />
        </div>
      )}

      {/* ═══ EMPTY SEARCH ═══ */}
      {query && grouped.every(g => g.dishes.length === 0) && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "2rem", marginBottom: 8 }}>🔍</p>
          <p style={{ fontSize: "0.92rem", color: "#999" }}>No encontramos platos para &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {/* ═══ PROMOS ═══ */}
      {hasPromos && (
        <section id="feed-cat-promos" style={{ padding: "18px 14px 0" }}>
          <PromoCarousel restaurantId={restaurant.id} initialPromos={marketingPromos} compact onViewDish={(dishId) => {
            const dish = dishes.find(d => d.id === dishId);
            if (dish) setSelectedDish(dish);
          }} />
        </section>
      )}

      {/* ═══ CATEGORIES + FEED CARDS ═══ */}
      {grouped.slice(0, visibleCats).map(({ category, dishes: catDishes }, index) => (
        <section key={category.id} id={`feed-cat-${category.id}`}>
          {/* Interstitial banners */}
          {index === Math.max(2, Math.floor(grouped.length * 0.4)) && <div style={{ margin: "0 10px 8px" }}><ExperienceBanner restaurantId={restaurant.id} /></div>}

          {/* Section header */}
          <div style={{ padding: "28px 16px 14px" }}>
            <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: 26, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.5px", lineHeight: 1.1, margin: 0 }}>
              {category.name}
            </h2>
            <div style={{ width: 32, height: 2, background: "#EF9F27", borderRadius: 1, marginTop: 10 }} />
          </div>

          {/* Cards */}
          <div style={{ padding: "4px 14px 8px" }}>
            {catDishes.map(dish => (
              <FeedDishCard
                key={dish.id}
                dish={dish}
                onClick={() => handleDishClick(dish)}
                isPopular={popularDishIds.has(dish.id)}
                pEntry={pMap?.get(dish.id)}
              />
            ))}
          </div>
        </section>
      ))}
      {/* Sentinel for progressive loading */}
      {visibleCats < grouped.length && <div ref={sentinelRef} style={{ height: 1 }} />}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 0 16px", marginTop: 40 }}>
        <span style={{ fontSize: "0.72rem", color: "#ccc" }}>Powered by </span>
        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.78rem", color: "#F4A623", fontWeight: 700 }}>
          QuieroComer.com
        </span>
      </div>

      {/* ═══ FLOATING ELEMENTS ═══ */}
      {showWaiter && (
        <div className="fixed z-50" style={{ right: 14, bottom: "calc(16px + env(safe-area-inset-bottom)" }}>
          <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />
        </div>
      )}

      {!(restaurant as any).isDemo && <BirthdayAutoModal restaurantId={restaurant.id} restaurantName={restaurant.name} birthdayPerk={(restaurant as any).birthdayPerk} logoUrl={restaurant.logoUrl} />}

      {/* ═══ MODALS ═══ */}
      {selectedDish && (
        <DishDetailErrorBoundary onClose={() => setSelectedDish(null)}>
          <DishDetail
            dish={selectedDish}
            allDishes={dishFromHero ? [selectedDish] : sortedDishes}
            categories={categories}
            restaurantId={restaurant.id}
            reviews={reviews}
            ratingMap={ratingMap}
            onClose={() => { setSelectedDish(null); setDishFromHero(false); }}
            onChangeDish={(d) => { setDishFromHero(false); setSelectedDish(d); }}
            personalizationMap={pMap}
            restaurantName={restaurant.name}
            restaurantPlan={(restaurant as any).plan}
            popularDishIds={popularDishIds}
          />
        </DishDetailErrorBoundary>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
