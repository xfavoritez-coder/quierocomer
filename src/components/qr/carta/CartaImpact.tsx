"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import DishDetail from "./DishDetail";
import DishDetailErrorBoundary from "./DishDetailErrorBoundary";
import GenioOnboarding from "../genio/GenioOnboarding";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import WaiterButton from "../garzon/WaiterButton";
import BirthdayBanner from "../capture/BirthdayBanner";
import BirthdayAutoModal from "../capture/BirthdayAutoModal";
import { norm } from "@/lib/normalize";
import ViewSelector from "./ViewSelector";
import GenioFab from "./GenioFab";
import SpicyStamp, { useClientAvoidsSpicy } from "./SpicyStamp";
import { canAccess, effectivePlan } from "@/lib/plans";
import { getGuestId } from "@/lib/guestId";
import { trackCategoryDwell } from "@/lib/sessionTracker";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import { trackSearchPerformed } from "./utils/cartaAnalytics";
import { getPersonalizedDishes, type PersonalizationMap } from "@/lib/qr/utils/getPersonalizedDishes";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { ScoringDish } from "@/lib/qr/utils/dishScoring";
import PromoCarousel from "../capture/PromoCarousel";
import ExperienceBanner from "../capture/ExperienceBanner";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";
import type { Lang } from "@/lib/qr/i18n";
import AnnouncementBanner from "./AnnouncementBanner";
import GenioVeganCarousel from "./GenioVeganCarousel";
import GenioVegetarianCarousel from "./GenioVegetarianCarousel";
import GenioGlutenFreeCarousel from "./GenioGlutenFreeCarousel";
import GenioLactoseFreeCarousel from "./GenioLactoseFreeCarousel";
import GenioSoyFreeCarousel from "./GenioSoyFreeCarousel";
import GenioNutsCarousel from "./GenioNutsCarousel";
import GenioSmartCarousel from "./GenioSmartCarousel";
import { getCarouselMode, getCarouselScrollId, getCarouselNavName, hasMatchingDishes, getDietMessage } from "@/lib/qr/utils/carouselMode";
import GenioDietMessage from "./GenioDietMessage";
import VeganFloatingPill from "./VeganFloatingPill";
import VegetarianFloatingPill from "./VegetarianFloatingPill";
import GlutenFreeFloatingPill from "./GlutenFreeFloatingPill";
import { getDishPhoto } from "./utils/dishHelpers";

/* ─── Types ─── */

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

/* ─── Hero Slider (always dark overlay on photos) ─── */

function ImpactHeroSlider({
  heroDishes,
  restaurant,
  popularDishIds,
  onDishSelect,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  lang,
}: {
  heroDishes: Dish[];
  restaurant: Restaurant;
  popularDishIds: Set<string>;
  onDishSelect: (d: Dish) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  lang: Lang;
  cycleLang: () => void;
  enabledLangs: string[];
}) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const touchStartX = useRef(0);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % heroDishes.length), 5000);
  }, [heroDishes.length]);

  useEffect(() => {
    if (heroDishes.length <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [heroDishes.length, resetTimer]);

  if (heroDishes.length === 0) return null;
  const d = heroDishes[current];
  const photo = getDishPhoto(d);
  const isRec = d.tags?.includes("RECOMMENDED");
  const isPop = popularDishIds.has(d.id);
  const badge = isRec ? "Recomendado" : isPop ? "Popular" : null;

  return (
    <section
      style={{
        minHeight: 520,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        padding: "92px 20px 34px",
        margin: "0 14px",
        borderRadius: 28,
        isolation: "isolate",
        overflow: "hidden",
      }}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(diff) > 50) {
          const next = diff < 0
            ? (current + 1) % heroDishes.length
            : (current - 1 + heroDishes.length) % heroDishes.length;
          setCurrent(next);
          resetTimer();
        }
      }}
    >
      {/* Photos */}
      {heroDishes.map((dish, i) => {
        const p = getDishPhoto(dish);
        return p ? (
          <div key={dish.id} style={{
            position: "absolute", inset: 0, zIndex: -3,
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.8s ease",
          }}>
            <Image
              src={p} alt={dish.name} fill className="object-cover" sizes="100vw"
              style={{ transform: "scale(1.03)", filter: "saturate(1.1) contrast(1.08)" }}
              quality={90} priority={i === 0}
            />
          </div>
        ) : null;
      })}

      {/* Dark overlays */}
      <div style={{
        position: "absolute", inset: 0, zIndex: -2,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0.25) 36%, rgba(0,0,0,0.78) 78%, var(--carta-bg) 100%), linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3) 58%, rgba(0,0,0,0.15))",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: -1, height: "55%", zIndex: -1,
        background: "linear-gradient(to top, var(--carta-bg) 0%, var(--carta-bg) 10%, color-mix(in srgb, var(--carta-bg) 90%, transparent) 38%, color-mix(in srgb, var(--carta-bg) 50%, transparent) 72%, transparent 100%)",
      }} />

      {/* Nav is now fixed outside hero */}

      {/* Content — clickable to open dish */}
      <div onClick={() => onDishSelect(d)} style={{ width: "100%", padding: "0 0 8px", position: "relative", zIndex: 2, cursor: "pointer" }}>
        {badge && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "none",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            color: "white", fontSize: 10, fontWeight: 900, textTransform: "uppercase",
            letterSpacing: "0.4px", borderRadius: 999, padding: "6px 12px", marginBottom: 13,
          }}>
            {isRec ? "⭐" : "🔥"} {badge}
          </div>
        )}
        <h1 style={{
          margin: 0, fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: 62, lineHeight: 0.82, letterSpacing: "0.5px",
          textShadow: "0 5px 30px rgba(0,0,0,0.92)", color: "white",
        }}>
          {d.name.split(" ").map((w, i, arr) =>
            i === arr.length - 1
              ? <span key={i} style={{ display: "block", color: "var(--carta-accent)", fontSize: 58, fontWeight: 900, textShadow: "0 0 24px color-mix(in srgb, var(--carta-accent) 32%, transparent)" }}>{w}</span>
              : <span key={i}>{w} </span>
          )}
        </h1>
        {d.description && (
          <p style={{
            maxWidth: 300, margin: "15px 0 16px", color: "#b0a89e",
            fontSize: 15, lineHeight: 1.52,
            textShadow: "0 1px 8px rgba(0,0,0,0.6)",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{d.description}</p>
        )}
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--carta-accent)", letterSpacing: "-0.8px" }}>
          ${(d.discountPrice || d.price)?.toLocaleString("es-CL") ?? ""}
        </div>
        {heroDishes.length > 1 && (
          <div style={{ display: "flex", gap: 7, marginTop: 17 }}>
            {heroDishes.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); resetTimer(); }}
                style={{
                  width: i === current ? 22 : 7, height: 7, borderRadius: 50,
                  background: i === current ? "var(--carta-accent)" : "rgba(255,255,255,0.38)",
                  border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Mood / "Que se te antoja?" Section ─── */

function MoodSection({
  categories,
  dishes,
  onCategoryTap,
}: {
  categories: Category[];
  dishes: Dish[];
  onCategoryTap: (catId: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Build mood cards from real categories — use first dish photo per category
  const moods = useMemo(() => {
    return categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.position - b.position)
      .map((cat) => {
        const catDishes = dishes.filter((d) => d.categoryId === cat.id && d.isActive)
          .sort((a, b) => (b.tags?.includes("RECOMMENDED") ? 1 : 0) - (a.tags?.includes("RECOMMENDED") ? 1 : 0));
        const photo = catDishes.find((d) => d.photos?.[0])?.photos?.[0] || null;
        return { id: cat.id, label: cat.name, photo };
      })
      .filter((m) => m.photo); // Only show categories with at least one photo
  }, [categories, dishes]);

  if (moods.length === 0) return null;

  const handleTap = (id: string) => {
    setActive(id);
    onCategoryTap(id);
  };

  return (
    <section style={{ padding: "24px 14px 0", position: "relative", zIndex: 1 }}>
      <h2 style={{
        fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32,
        letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9,
        color: "#fff7ed",
      }}>
        {"Que se te antoja?"}
      </h2>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 10, overflowX: "auto",
            padding: "2px 0 8px", scrollbarWidth: "none",
            msOverflowStyle: "none", WebkitOverflowScrolling: "touch",
          }}
        >
          {moods.map((m) => {
            const isActive = active === m.id;
            return (
              <button key={m.id} onClick={() => handleTap(m.id)} style={{
                width: 116, minWidth: 116, height: 140, borderRadius: 28, position: "relative", overflow: "hidden",
                padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                border: isActive
                  ? "1px solid color-mix(in srgb, var(--carta-accent) 90%, transparent)"
                  : "1px solid color-mix(in srgb, var(--carta-text) 14%, transparent)",
                background: "var(--carta-surface)", cursor: "pointer",
                boxShadow: isActive
                  ? "0 0 28px color-mix(in srgb, var(--carta-accent) 20%, transparent), inset 0 0 28px color-mix(in srgb, var(--carta-accent) 8%, transparent)"
                  : "inset 0 0 28px color-mix(in srgb, var(--carta-text) 2.5%, transparent)",
                flexShrink: 0,
              }}>
                {m.photo && (
                  <Image src={m.photo!} alt={m.label} fill className="object-cover" sizes="116px" />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.7))" }} />
                <b style={{
                  position: "relative", zIndex: 1, fontSize: 14, lineHeight: 1.15,
                  textShadow: "0 2px 14px #000", color: "white", textAlign: "left",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  display: "block", width: "100%",
                }}>{m.label}</b>
              </button>
            );
          })}
        </div>
        {scrolled && (
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 8, width: 30,
            background: "linear-gradient(to left, transparent, var(--carta-bg))",
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 8, width: 40,
          background: "linear-gradient(to right, transparent, var(--carta-bg))",
          pointerEvents: "none",
        }} />
      </div>
    </section>
  );
}

/* ─── Featured / Destacados Section ─── */

function FeaturedSection({
  dishes,
  popularDishIds,
  onDishSelect,
}: {
  dishes: Dish[];
  popularDishIds: Set<string>;
  onDishSelect: (d: Dish) => void;
}) {
  const featured = useMemo(() => {
    return dishes.filter((d) => d.tags?.includes("RECOMMENDED") && d.photos?.[0]);
  }, [dishes]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || featured.length === 0) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / (el.scrollWidth / featured.length));
      setActiveIdx(Math.min(idx, featured.length - 1));
      setScrolled(el.scrollLeft > 10);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [featured.length]);

  if (featured.length === 0) return null;

  return (
    <section style={{ padding: "24px 14px 0", position: "relative", zIndex: 1 }}>
      <h2 style={{
        fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32,
        letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9,
        color: "#fff7ed",
      }}>Destacados</h2>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 13, overflowX: "auto",
            scrollSnapType: "x mandatory", scrollbarWidth: "none",
            padding: "0 0 8px", msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {featured.map((f) => {
            const photo = getDishPhoto(f);
            return (
              <article
                key={f.id}
                onClick={() => onDishSelect(f)}
                style={{
                  flex: "0 0 85%", minWidth: "85%", scrollSnapAlign: "start",
                  height: 260, borderRadius: 31, overflow: "hidden", position: "relative",
                  cursor: "pointer",
                  border: "1px solid color-mix(in srgb, var(--carta-accent) 25%, transparent)",
                  background: "var(--carta-surface)",
                  boxShadow: "0 0 24px color-mix(in srgb, var(--carta-accent) 12%, transparent), 0 0 48px color-mix(in srgb, var(--carta-accent) 6%, transparent)",
                }}
              >
                {photo && <Image src={photo} alt={f.name} fill className="object-cover" sizes="100vw" />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.18) 62%, transparent)" }} />
                <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", color: "white" }}>⭐ {f.name}</h3>
                  {f.description && (
                    <p style={{
                      margin: "0 0 9px", color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.35,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{f.description}</p>
                  )}
                  <div style={{ fontSize: 19, fontWeight: 800, color: "var(--carta-accent)", letterSpacing: "-0.5px" }}>
                    ${(f.discountPrice || f.price)?.toLocaleString("es-CL") ?? ""}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {scrolled && (
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 8, width: 30,
            background: "linear-gradient(to left, transparent, var(--carta-bg))",
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 8, width: 50,
          background: "linear-gradient(to right, transparent, var(--carta-bg))",
          pointerEvents: "none",
        }} />
      </div>
      {featured.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {featured.map((_, i) => (
            <div key={i} style={{
              width: i === activeIdx ? 18 : 6, height: 6, borderRadius: 50,
              background: i === activeIdx ? "var(--carta-accent)" : "color-mix(in srgb, var(--carta-text) 25%, transparent)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Menu Dish Card (horizontal layout: photo left 108px, info right) ─── */

function ImpactDishCard({
  dish,
  rating,
  isPopular,
  autoRecommended,
  onClick,
}: {
  dish: Dish;
  rating?: { avg: number; count: number };
  isPopular?: boolean;
  autoRecommended?: boolean;
  onClick: () => void;
}) {
  const photo = getDishPhoto(dish);
  const [imgLoaded, setImgLoaded] = useState(false);
  const isRec = dish.tags?.includes("RECOMMENDED");

  return (
    <button
      onClick={onClick}
      className="active:scale-[0.99] transition-transform"
      style={{
        width: "100%", display: "grid", gridTemplateColumns: "118px 1fr",
        gap: 16, padding: 10, marginBottom: 11, borderRadius: 26,
        background: isRec
          ? "linear-gradient(135deg, color-mix(in srgb, var(--carta-accent) 12%, transparent), color-mix(in srgb, var(--carta-accent) 4%, transparent))"
          : "linear-gradient(135deg, color-mix(in srgb, var(--carta-text) 7.5%, transparent), color-mix(in srgb, var(--carta-text) 2.5%, transparent))",
        border: isRec
          ? "1px solid color-mix(in srgb, var(--carta-accent) 30%, transparent)"
          : "1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)",
        boxShadow: isRec ? "0 0 16px color-mix(in srgb, var(--carta-accent) 12%, transparent)" : "none",
        position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {/* Ambient glow on card */}
      <div style={{
        position: "absolute", right: -35, top: -35, width: 90, height: 90, borderRadius: "50%",
        background: "color-mix(in srgb, var(--carta-accent) 8%, transparent)", filter: "blur(10px)",
      }} />
      {/* Photo */}
      <div style={{
        position: "relative", width: 118, height: 118, borderRadius: 20, overflow: "hidden",
        background: photo ? "var(--carta-img-placeholder, #222)" : "linear-gradient(135deg, var(--carta-bg), var(--carta-surface))",
      }}>
        {photo ? (
          <>
            {!imgLoaded && (
              <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)", animation: "impactShimmer 1.5s infinite" }} />
              </div>
            )}
            <Image
              src={photo} alt={dish.name} fill className="object-cover" sizes="108px"
              onLoad={() => setImgLoaded(true)}
              style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
            />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>🍽</div>
        )}
        <SpicyStamp isSpicy={!!(dish as any).isSpicy} size={24} top={6} right={6} />
      </div>
      {/* Info */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        {(isRec || autoRecommended || isPopular) && (
          <div style={{ marginBottom: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(isRec || autoRecommended) && (
              <span style={{
                fontSize: "0.72rem", fontWeight: 700,
                color: "#F4A623",
                background: "rgba(244,166,35,0.12)",
                padding: "2px 8px", borderRadius: 50,
              }}>
                {autoRecommended ? "✨ Para ti" : "⭐ Recomendado"}
              </span>
            )}
            {isPopular && (
              <span style={{
                fontSize: "0.72rem", fontWeight: 700,
                color: "#e85530",
                background: "rgba(232,85,48,0.12)",
                padding: "2px 8px", borderRadius: 50,
              }}>
                🔥 Popular
              </span>
            )}
          </div>
        )}
        <h4 style={{
          margin: "0 0 4px", fontSize: 18, fontWeight: 700,
          color: "var(--carta-text)", display: "flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{dish.name}</span>
          {(dish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "16px", flexShrink: 0 }}>🌿</span>}
          {(dish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "16px", flexShrink: 0 }}>🥗</span>}
          {(dish as any).isSpicy && <span style={{ fontSize: "16px", flexShrink: 0 }}>🌶️</span>}
        </h4>
        {dish.description && (
          <p style={{
            margin: 0, color: "var(--carta-text-muted, #888)", fontSize: 14, lineHeight: 1.42,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>{dish.description}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <b style={{ color: "var(--carta-accent)", fontSize: 16 }}>
            ${(dish.discountPrice || dish.price)?.toLocaleString("es-CL") ?? ""}
          </b>
          {dish.discountPrice && (
            <span style={{ fontSize: "0.78rem", color: "var(--carta-text3, #666)", textDecoration: "line-through" }}>
              ${dish.price?.toLocaleString("es-CL")}
            </span>
          )}
          {rating && rating.count > 0 && (
            <span style={{ fontSize: "0.72rem", color: "var(--carta-text-muted, #888)" }}>
              ★ {rating.avg.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Main Component ─── */

export default function CartaImpact({
  restaurant,
  categories,
  dishes,
  promotions,
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasNewLikes, clearNewLikes } = useFavorites();

  // Language cycling
  const enabledLangs: string[] = (restaurant as any).enabledLangs || ["es"];
  const cycleLang = useCallback(() => {
    const currentIdx = enabledLangs.indexOf(lang);
    const next = enabledLangs[(currentIdx + 1) % enabledLangs.length] as Lang;
    localStorage.setItem("qc_lang", next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [lang, enabledLangs, pathname, router, searchParams]);
  const popularDishIds = popularDishIdsProp ?? new Set<string>();
  const hasPromos = marketingPromos && marketingPromos.length > 0;

  /* ─── Genio state ─── */
  const [hasCompletedGenio, setHasCompletedGenio] = useState(false);
  useEffect(() => {
    const check = () => setHasCompletedGenio(!!(localStorage.getItem("qr_diet") && localStorage.getItem("qr_restrictions")));
    const onGenioUpdated = () => {
      check();
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

  /* ─── Diet nav item for category chips ─── */
  const dietNavItem = useMemo(() => {
    if (typeof window === "undefined") return null;
    const diet = localStorage.getItem("qr_diet");
    const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
    if (!mode) return null;
    if (!hasMatchingDishes(dishes, categories, mode, diet, restrictions.filter((r: string) => r !== "ninguna"))) return null;
    return { id: "diet-carousel", name: getCarouselNavName(mode), scrollTo: getCarouselScrollId(mode) };
  }, [restaurant, hasCompletedGenio, dishes, categories]);

  /* ─── Active category tracking ─── */
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
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

  /* ─── IntersectionObserver for active category detection ─── */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const allCats = [...categories];
    for (const cat of allCats) {
      const el = document.getElementById(`impact-cat-${cat.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveCategory(cat.id); },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    }
    if (dietNavItem) {
      const dietEl = document.getElementById(dietNavItem.scrollTo);
      if (dietEl) {
        const dietObs = new IntersectionObserver(
          ([entry]) => { if (entry.isIntersecting) setActiveCategory("diet-carousel"); },
          { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
        );
        dietObs.observe(dietEl);
        observers.push(dietObs);
      }
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [categories, hasPromos, dietNavItem]);

  /* ─── Dish / modal state ─── */
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishFromHero, setDishFromHero] = useState(false);
  const [genioOpen, setGenioOpen] = useState(false);
  const [qrUserLocal, setQrUserLocal] = useState<any>(null);
  const [profileOpenLocal, setProfileOpenLocal] = useState(false);
  const qrUser = qrUserProp ?? qrUserLocal;
  const handleProfileOpen = onProfileOpenProp ?? (() => setProfileOpenLocal(true));

  /* ─── Search ─── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { sortKey, setSortKey, rankings } = useCartaSort(restaurant.id, "impact");
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

  /* ─── Birthday / user data ─── */
  const [birthdayCountdown, setBirthdayCountdown] = useState<number | null>(null);

  useEffect(() => {
    const cookieKey = `qr_visited_${restaurant.id}`;
    const visited = localStorage.getItem(cookieKey);
    if (!visited) localStorage.setItem(cookieKey, String(Date.now()));

    fetch("/api/qr/user/me")
      .then((r) => r.json())
      .then((d) => {
        if (qrUserProp === undefined && d.user) setQrUserLocal(d.user);
        if (d.user?.birthDate) {
          const today = new Date();
          const birth = new Date(d.user.birthDate);
          const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
          if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
          const days = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 30) setBirthdayCountdown(days);
        }
      })
      .catch(() => {});
  }, [restaurant.id, qrUserProp]);

  useEffect(() => { onReady?.(); }, [readyKey]);

  /* ─── Personalization ─── */
  const catNames = useMemo(() => { const m: Record<string, string> = {}; for (const c of categories) m[c.id] = c.name; return m; }, [categories]);
  const scoringCtx = useMemo(() => ({ timeOfDay: timeOfDayProp || "LUNCH", weather: weatherProp || "CLEAR", categoryNames: catNames }), [timeOfDayProp, weatherProp, catNames]);

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
  const recShownRef = useRef(new Set<string>());
  const clientAvoidsSpicyForSort = useClientAvoidsSpicy();

  // Background fetch for personalization
  useEffect(() => {
    const guestId = getGuestId();
    if (!guestId && !qrUser?.id) return;
    setPersonalizing(true);
    fetch(`/api/qr/profile?restaurantId=${restaurant.id}&guestId=${guestId}`).then((r) => r.json())
      .then((d) => {
        if (!d.profile) { setPersonalizing(false); return; }
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

  // Track RECOMMENDATION_SHOWN
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
                eventType: "RECOMMENDATION_SHOWN", dishId, restaurantId: restaurant.id,
                guestId: getGuestId(),
                metadata: { score: entry.score, reason: entry.reason, wasAutomatic: true },
              }),
            }).catch(() => {});
          }
        },
        { threshold: 0.5 },
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [pMap, restaurant.id]);

  /* ─── Hero dishes ─── */
  const heroDishes = useMemo(() => {
    const recommendedWithPhotos = dishes.filter((d) => d.tags?.includes("RECOMMENDED") && d.photos?.[0]);
    if (recommendedWithPhotos.length > 0) return recommendedWithPhotos.slice(0, 3);
    const popularWithPhotos = dishes.filter((d) => popularDishIds.has(d.id) && d.photos?.[0]).slice(0, 3);
    if (popularWithPhotos.length > 0) return popularWithPhotos;
    const withPhotos = dishes.filter((d) => d.photos?.[0]);
    if (withPhotos.length <= 3) return withPhotos;
    return [...withPhotos].sort((a, b) => a.position - b.position).slice(0, 3);
  }, [dishes, popularDishIds]);

  /* ─── Sorted dishes ─── */
  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of categories) {
      const catDishes = dishes.filter((d) => d.categoryId === cat.id && d.isActive);
      if (sortKey !== "default") {
        result.push(...applyCartaSort(catDishes, sortKey, rankings));
        continue;
      }
      catDishes.sort((a, b) => {
        if (clientAvoidsSpicyForSort) {
          const aSpicy = (a as any).isSpicy ? 1 : 0;
          const bSpicy = (b as any).isSpicy ? 1 : 0;
          if (aSpicy !== bSpicy) return aSpicy - bSpicy;
        }
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
  }, [categories, dishes, pMap, sortKey, rankings, clientAvoidsSpicyForSort]);

  /* ─── Category chips scroll ─── */
  const chipsRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeChipRef.current && chipsRef.current) {
      const container = chipsRef.current;
      const el = activeChipRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [activeCategory]);

  /* ─── Helpers ─── */
  const scrollToCategory = useCallback((catId: string) => {
    const el = document.getElementById(`impact-cat-${catId}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 52;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const handleDishClick = useCallback((dish: Dish) => {
    const entry = pMap?.get(dish.id);
    if (entry?.autoRecommended) {
      fetch("/api/qr/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "RECOMMENDATION_TAPPED", dishId: dish.id,
          restaurantId: restaurant.id, guestId: getGuestId(),
          metadata: { score: entry.score, wasAutomatic: true },
        }),
      }).catch(() => {});
    }
    setSelectedDish(dish);
  }, [pMap, restaurant.id]);

  /* ─── Build filtered menu sections ─── */
  const menuSections = useMemo(() => {
    return categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.position - b.position)
      .map((cat) => {
        let catDishes = dishes
          .filter((d) => d.categoryId === cat.id && d.isActive)
          .filter((d) => {
            if (!searchQuery) return true;
            const q = norm(searchQuery.trim());
            return norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q);
          });

        // Sort
        if (sortKey !== "default") {
          catDishes = applyCartaSort(catDishes, sortKey, rankings);
        } else {
          catDishes.sort((a, b) => {
            if (clientAvoidsSpicyForSort) {
              const aSpicy = (a as any).isSpicy ? 1 : 0;
              const bSpicy = (b as any).isSpicy ? 1 : 0;
              if (aSpicy !== bSpicy) return aSpicy - bSpicy;
            }
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
        }

        return { category: cat, dishes: catDishes };
      })
      .filter((s) => s.dishes.length > 0);
  }, [categories, dishes, searchQuery, sortKey, rankings, pMap, clientAvoidsSpicyForSort]);

  const allChipCats = useMemo(() => {
    const cats: { id: string; name: string }[] = [];
    if (dietNavItem) cats.push({ id: dietNavItem.id, name: dietNavItem.name });
    // Ofertas has its own section above menu, not in chips
    for (const s of menuSections) cats.push({ id: s.category.id, name: s.category.name });
    return cats;
  }, [dietNavItem, hasPromos, menuSections]);

  return (
    <div
      className="min-h-screen font-[family-name:var(--font-dm)]"
      style={{ background: "var(--carta-bg)", position: "relative" }}
    >
      {/* Ambient background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle at 70% 0%, rgba(244,166,35,0.33), transparent 27%), radial-gradient(circle at 8% 28%, rgba(155,92,255,0.18), transparent 30%), radial-gradient(circle at 90% 72%, rgba(244,166,35,0.14), transparent 24%), linear-gradient(var(--carta-bg), var(--carta-bg))",
      }} />
      {/* Grid texture */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.22,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "38px 38px",
        maskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)",
      }} />
      {/* Smoke / warm glow */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5,
        background: "radial-gradient(ellipse at 50% 8%, rgba(244,166,35,0.16), transparent 32%), radial-gradient(ellipse at 70% 24%, rgba(244,166,35,0.10), transparent 28%)",
        filter: "blur(10px)",
      }} />

      {/* Fixed top nav */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        padding: "calc(10px + env(safe-area-inset-top)) 16px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.4), transparent)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        pointerEvents: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(restaurant as any).logoUrl && (
            <Image
              src={(restaurant as any).logoUrl} alt={restaurant.name}
              width={34} height={34}
              style={{ borderRadius: 10, objectFit: "contain" }}
            />
          )}
          <span style={{ fontWeight: 800, fontSize: 17, color: "white", letterSpacing: "-0.3px" }}>
            {restaurant.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => { setSearchOpen(true); setTimeout(() => document.getElementById("impact-search-input")?.focus(), 100); }}
            style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(10px)" }}
          >
            <Search size={15} color="white" />
          </button>
          {enabledLangs.length > 1 && (
            <button onClick={() => { alert("Lang: " + lang + " | enabled: " + enabledLangs.join(",")); cycleLang(); }} style={{ height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", padding: "0 12px", fontSize: 11, fontWeight: 900, letterSpacing: "0.3px", backdropFilter: "blur(10px)", cursor: "pointer", position: "relative", zIndex: 50 }}>
              {lang.toUpperCase()}
            </button>
          )}
        </div>
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          padding: "calc(10px + env(safe-area-inset-top)) 16px 12px",
          background: "var(--carta-bg)", borderBottom: "1px solid var(--carta-card-border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44, background: "var(--carta-surface)", borderRadius: 999, padding: "0 14px", border: "1px solid var(--carta-card-border)" }}>
            <Search size={16} color="var(--carta-text-muted)" style={{ flexShrink: 0 }} />
            <input
              id="impact-search-input"
              autoFocus type="search" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(lang, "search")}
              className="font-[family-name:var(--font-dm)]"
              style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "var(--carta-text)", background: "transparent", fontFamily: "inherit" }}
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              style={{ flexShrink: 0, background: "none", border: "none", padding: 4, cursor: "pointer" }}>
              <X size={18} color="var(--carta-text-muted)" />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <ImpactHeroSlider
          heroDishes={heroDishes}
          restaurant={restaurant}
          popularDishIds={popularDishIds}
          onDishSelect={(d) => { setDishFromHero(true); setSelectedDish(d); }}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          lang={lang}
          cycleLang={cycleLang}
          enabledLangs={enabledLangs}
        />
      </div>

      {/* Mood / "Que se te antoja?" */}
      <MoodSection
        categories={categories}
        dishes={dishes}
        onCategoryTap={(catId) => {
          setActiveCategory(catId);
          scrollToCategory(catId);
        }}
      />

      {/* Genio diet carousels */}
      {hasCompletedGenio && (() => {
        const diet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
        const restrictions = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })() : [];
        const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
        const onDishClick = (dishId: string) => { const dish = dishes.find((d) => d.id === dishId); if (dish) setSelectedDish(dish); };
        const activeRestrictions = restrictions.filter((r: string) => r !== "ninguna");
        const dietMsg = getDietMessage(diet, restrictions, (restaurant as any).dietType, dishes, categories);
        const msgType = (dietMsg === "reordered-spicy" || dietMsg === "redundant-vegan" || dietMsg === "redundant-vegetarian") ? null : (!mode || !hasMatchingDishes(dishes, categories, mode, diet, activeRestrictions)) ? dietMsg : null;
        if (msgType) return <div style={{ marginTop: 10, paddingTop: 10, position: "relative", zIndex: 1 }}><GenioDietMessage type={msgType} diet={diet} restrictions={activeRestrictions} restaurantName={restaurant.name} /></div>;
        if (!mode) return null;
        return (
          <div style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
            {mode === "vegan" && <GenioVeganCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "vegan+gf" && <GenioVeganCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} alsoGlutenFree />}
            {mode === "vegetarian" && <GenioVegetarianCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "vegetarian+gf" && <GenioVegetarianCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} alsoGlutenFree />}
            {mode === "glutenfree" && <GenioGlutenFreeCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "lactosefree" && <GenioLactoseFreeCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "soyfree" && <GenioSoyFreeCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "nuts" && <GenioNutsCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} />}
            {mode === "smart" && <GenioSmartCarousel dishes={dishes} categories={categories} onDishClick={onDishClick} diet={diet || "omnivore"} restrictions={activeRestrictions} />}
          </div>
        );
      })()}

      {/* Featured / Destacados */}
      <FeaturedSection
        dishes={dishes}
        popularDishIds={popularDishIds}
        onDishSelect={(d) => setSelectedDish(d)}
      />

      {/* Promos */}
      {hasPromos && (
        <section id="impact-cat-promos" style={{ padding: "24px 14px 24px", position: "relative", zIndex: 1 }}>
          <h2 style={{
            fontFamily: "var(--font-bebas), 'Bebas Neue', Impact, sans-serif", fontSize: 32,
            letterSpacing: "0.8px", margin: "0 0 14px", lineHeight: 0.9,
            color: "#fff7ed",
          }}>Ofertas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(marketingPromos || []).map((p: any) => {
              const dish = p.dishes?.[0];
              const photo = p.imageUrl || dish?.photos?.[0];
              const words = p.name.split(" ");
              const firstWords = words.slice(0, -1).join(" ");
              const lastWord = words[words.length - 1];
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (dish) setSelectedDish(dishes.find(d => d.id === dish.id) || null);
                  }}
                  style={{
                    width: "100%", height: 220, borderRadius: 26, overflow: "hidden", position: "relative",
                    background: "#111", border: "1px solid color-mix(in srgb, var(--carta-accent) 32%, transparent)",
                    boxShadow: "0 28px 80px rgba(0,0,0,0.65), inset 0 0 34px color-mix(in srgb, var(--carta-accent) 6%, transparent)",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  {/* Foto fondo con overlay */}
                  {photo && (
                    <div style={{ position: "absolute", inset: 0, transform: "scale(1.04)" }}>
                      <Image src={photo} alt={p.name} fill className="object-cover" sizes="430px" style={{ objectPosition: "center right" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.78) 43%, rgba(0,0,0,0.12) 100%), linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 58%)" }} />
                    </div>
                  )}
                  {/* Badge día */}
                  {(() => {
                    const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
                    const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
                    const label = p.daysOfWeek?.length ? `Hoy ${DAY_NAMES[todayDow].charAt(0) + DAY_NAMES[todayDow].slice(1).toLowerCase()}` : "Oferta";
                    return (
                      <span style={{
                        position: "absolute", top: 15, right: 15, zIndex: 2,
                        fontSize: 11, fontWeight: 900, color: "white",
                        background: "var(--carta-accent)", padding: "9px 13px",
                        borderRadius: 999, letterSpacing: "0.6px", textTransform: "uppercase",
                      }}>{label}</span>
                    );
                  })()}
                  {/* Contenido abajo izquierda */}
                  <div style={{ position: "absolute", left: 18, right: 18, bottom: 30, zIndex: 2, maxWidth: 200 }}>
                    <h3 style={{
                      margin: "0 0 14px", fontFamily: "var(--font-bebas), 'Bebas Neue', Impact, sans-serif",
                      fontSize: 34, lineHeight: 0.85, letterSpacing: "0.5px",
                      textShadow: "0 6px 28px rgba(0,0,0,0.9)", color: "white",
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                    }}>
                      <span style={{ color: "var(--carta-accent)" }}>{words[0]}</span>{words.length > 1 ? " " + words.slice(1).join(" ") : ""}
                    </h3>
                    {(() => {
                      const desc = p.description
                        || (p.dishes?.length > 1 ? p.dishes.map((d: any) => d.name).join(" + ") : null)
                        || dish?.description;
                      if (!desc) return null;
                      return (
                        <p style={{
                          margin: "0 0 12px", color: "#b0a89e", fontSize: 14, lineHeight: 1.42,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden",
                        }}>{desc}</p>
                      );
                    })()}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                      {p.promoPrice && (
                        <span style={{ color: "var(--carta-accent)", fontSize: 19, fontWeight: 900, letterSpacing: "-0.5px" }}>
                          ${p.promoPrice.toLocaleString("es-CL")}
                        </span>
                      )}
                      {p.originalPrice && p.promoPrice && (
                        <del style={{ color: "#888", fontSize: 15, fontWeight: 800 }}>
                          ${p.originalPrice.toLocaleString("es-CL")}
                        </del>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Announcement banner */}
      {announcements && announcements.length > 0 && (
        <div style={{ position: "relative", zIndex: 1 }}>
          <AnnouncementBanner announcements={announcements} />
        </div>
      )}

      {/* Personalizing overlay */}
      {personalizing && Date.now() - mountedAt.current > 500 && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            background: "color-mix(in srgb, var(--carta-bg, #030303) 92%, transparent)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: "1.5rem", animation: "genioFloat 1.5s ease-in-out infinite" }}>✨</span>
          <span style={{ fontSize: "0.95rem", color: "var(--carta-text)", fontWeight: 500 }}>Personalizando la carta para ti...</span>
        </div>
      )}

      {/* ═══════ MENÚ ═══════ */}
      <div style={{ padding: "24px 14px 4px", position: "relative", zIndex: 1 }}>
        <h2 style={{
          fontFamily: "var(--font-bebas), 'Bebas Neue', Impact, sans-serif", fontSize: 32,
          letterSpacing: "0.8px", margin: 0, lineHeight: 0.9,
          color: "#fff7ed",
        }}>
          {"Menú"}
        </h2>
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "0 14px 16px" }}>
        {/* Category chips + search — sticky */}
        <div style={{ paddingTop: 10, paddingBottom: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <div
                ref={chipsRef}
                style={{
                  display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
                  msOverflowStyle: "none", WebkitOverflowScrolling: "touch", padding: "4px 0",
                }}
              >
                {allChipCats.map((cat) => {
                  const isActive = cat.id === activeCategory;
                  return (
                    <button
                      key={cat.id}
                      ref={isActive ? activeChipRef : null}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        if (cat.id === "diet-carousel" && dietNavItem) {
                          const el = document.getElementById(dietNavItem.scrollTo);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        } else if (cat.id === "promos") {
                          const el = document.getElementById("impact-cat-promos");
                          if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 52, behavior: "smooth" });
                        } else {
                          scrollToCategory(cat.id);
                        }
                      }}
                      className="font-[family-name:var(--font-dm)]"
                      style={{
                        whiteSpace: "nowrap", flexShrink: 0,
                        border: isActive
                          ? "1px solid color-mix(in srgb, var(--carta-accent) 55%, transparent)"
                          : "1px solid color-mix(in srgb, var(--carta-text) 13%, transparent)",
                        background: isActive
                          ? "color-mix(in srgb, var(--carta-accent) 10%, transparent)"
                          : "color-mix(in srgb, var(--carta-text) 5.5%, transparent)",
                        borderRadius: 999, padding: "10px 16px",
                        color: isActive ? "white" : "var(--carta-text3, #777)",
                        fontSize: 15, fontWeight: 800, cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >{cat.name}</button>
                  );
                })}
                <SortChip sortKey={sortKey} setSortKey={setSortKey} salesMode={rankings?.sales?.mode || null} />
              </div>
              {/* Fade right */}
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: 30,
                background: "linear-gradient(to right, transparent, var(--carta-bg))",
                pointerEvents: "none",
              }} />
            </div>
          </div>
        </div>

        {/* Empty state */}
        {searchQuery && menuSections.length === 0 && (
          <div className="font-[family-name:var(--font-dm)]" style={{ padding: "64px 32px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
            <p style={{ color: "var(--carta-text-muted)", fontSize: "0.95rem" }}>
              No encontramos platos con &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="font-[family-name:var(--font-dm)]"
              style={{ marginTop: 12, fontSize: "0.88rem", color: "var(--carta-accent)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Limpiar busqueda
            </button>
          </div>
        )}

        {/* Category sections */}
        {menuSections.map(({ category, dishes: catDishes }, index) => (
          <div key={category.id}>
            {index === Math.max(2, Math.floor(menuSections.length * 0.4)) && (
              <ExperienceBanner restaurantId={restaurant.id} />
            )}
            {index === Math.max(4, Math.floor(menuSections.length * 0.8)) && (
              <BirthdayBanner restaurantId={restaurant.id} restaurantName={restaurant.name} birthdayPerk={(restaurant as any).birthdayPerk} />
            )}
            <div id={`impact-cat-${category.id}`} style={{ marginBottom: 20 }}>
              <h3 style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20,
                color: "var(--carta-text, #ccc)", margin: "0 0 10px", letterSpacing: "0.4px", opacity: 0.4,
              }}>{category.name}</h3>
              {category.description && category.description.length <= 60 && (
                <p style={{ fontSize: "0.8rem", color: "var(--carta-text3, #999)", marginTop: -6, marginBottom: 8 }}>
                  {category.description}
                </p>
              )}
              {catDishes.map((dish) => (
                <div key={dish.id} data-dish-id={dish.id}>
                  <ImpactDishCard
                    dish={dish}
                    rating={ratingMap[dish.id]}
                    isPopular={popularDishIds.has(dish.id)}
                    autoRecommended={pMap?.get(dish.id)?.autoRecommended}
                    onClick={() => handleDishClick(dish)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Birthday countdown */}
      {birthdayCountdown !== null && (
        <div
          className="font-[family-name:var(--font-dm)]"
          style={{
            margin: "20px 14px 12px", padding: "12px 16px",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-accent) 12%, transparent), color-mix(in srgb, var(--carta-accent) 6%, transparent))",
            border: "1px solid color-mix(in srgb, var(--carta-accent) 20%, transparent)", borderRadius: 12,
            display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1,
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>🎁</span>
          <span style={{ fontSize: "0.82rem", color: "var(--carta-text)", fontWeight: 600 }}>
            {(() => {
              const firstName = (qrUser?.name || "").split(" ")[0];
              if (birthdayCountdown === 0) return firstName ? `Feliz cumple, ${firstName}! 🎉` : "Hoy es tu cumple! 🎉";
              return firstName
                ? `${firstName}, tu regalo llega en ${birthdayCountdown} dia${birthdayCountdown !== 1 ? "s" : ""}`
                : `Tu regalo llega en ${birthdayCountdown} dia${birthdayCountdown !== 1 ? "s" : ""}`;
            })()}
          </span>
        </div>
      )}

      {/* Footer */}
      <footer
        className="font-[family-name:var(--font-dm)]"
        style={{
          paddingBottom: 100, marginTop: 40, paddingTop: 8,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          position: "relative", zIndex: 1,
        }}
      >
        <a
          href="https://quierocomer.cl" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <span style={{ color: "var(--carta-text3, #555)", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span
            className="font-[family-name:var(--font-playfair)]"
            style={{ color: "var(--carta-text3, #555)", fontSize: "0.82rem", fontWeight: 700 }}
          >
            QuieroComer<span style={{ color: "var(--carta-accent)" }}>.cl</span>
          </span>
        </a>
        <span style={{ color: "var(--carta-text3, #555)", fontSize: "0.62rem" }}>&copy; {new Date().getFullYear()}</span>
      </footer>

      {/* Floating diet pills */}
      {hasCompletedGenio && (() => {
        const diet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
        const restrictions = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })() : [];
        const isOmnivoreRestaurant = (restaurant as any).dietType !== "VEGAN" && (restaurant as any).dietType !== "VEGETARIAN";
        return (
          <>
            {diet === "vegan" && isOmnivoreRestaurant && dishes.some((d) => (d as any).dishDiet === "VEGAN") && <VeganFloatingPill />}
            {diet === "vegetarian" && isOmnivoreRestaurant && dishes.some((d) => (d as any).dishDiet === "VEGETARIAN" || (d as any).dishDiet === "VEGAN") && <VegetarianFloatingPill />}
            {diet === "omnivore" && restrictions.includes("gluten") && dishes.some((d) => (d as any).isGlutenFree) && <GlutenFreeFloatingPill />}
          </>
        );
      })()}

      {/* FABs */}
      <div className="fixed z-50 flex flex-col items-end" style={{ right: 14, bottom: "calc(16px + env(safe-area-inset-bottom))", gap: 10 }}>
        {canAccess(effectivePlan((restaurant as any).plan, (restaurant as any).subscriptionStatus), "genio") && (() => {
          const diet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
          const restrictions = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })() : [];
          const dietMsg = getDietMessage(diet, restrictions, (restaurant as any).dietType, dishes, categories);
          return (
            <GenioFab
              hasCompletedGenio={hasCompletedGenio}
              onOpen={() => setGenioOpen(true)}
              spicyReordered={dietMsg === "reordered-spicy"}
              redundantDiet={dietMsg === "redundant-vegan" || dietMsg === "redundant-vegetarian" ? dietMsg : null}
              restaurantName={restaurant.name}
            />
          );
        })()}
        {showWaiter && <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />}
        {(restaurant as any).plan !== "FREE" && (
          <ViewSelector
            restaurantId={restaurant.id}
            enabledLangs={(restaurant as any).enabledLangs}
            plan={(restaurant as any).plan}
            defaultView={(restaurant as any).defaultView}
          />
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes genioFabFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes genioFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes impactShimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      `}</style>

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
            onClose={() => {
              setSelectedDish(null);
              setDishFromHero(false);
              if (hasNewLikes) { clearNewLikes(); setProfileTrigger((n) => n + 1); }
            }}
            onChangeDish={(d) => { setDishFromHero(false); setSelectedDish(d); }}
            personalizationMap={pMap}
            restaurantName={restaurant.name}
            restaurantPlan={(restaurant as any).plan}
            popularDishIds={popularDishIds}
          />
        </DishDetailErrorBoundary>
      )}

      {/* Birthday auto-modal */}
      <BirthdayAutoModal restaurantId={restaurant.id} restaurantName={restaurant.name} birthdayPerk={(restaurant as any).birthdayPerk} />

      {/* Genio onboarding */}
      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          qrUser={qrUser}
          restaurantDietType={(restaurant as any).dietType}
          onClose={() => { setGenioOpen(false); setProfileTrigger((n) => n + 1); window.dispatchEvent(new Event("genio-closed")); }}
          onResult={(dish) => {
            setGenioOpen(false);
            setProfileTrigger((n) => n + 1);
            setTimeout(() => {
              const el = document.querySelector(`[data-dish-id="${dish.id}"]`);
              if (el) {
                const section = el.closest("[id^='impact-cat-']");
                const target = section || el;
                const top = target.getBoundingClientRect().top + window.scrollY - 48;
                window.scrollTo({ top, behavior: "smooth" });
              }
              setTimeout(() => setSelectedDish(dish), 500);
            }, 250);
          }}
        />
      )}
    </div>
  );
}
