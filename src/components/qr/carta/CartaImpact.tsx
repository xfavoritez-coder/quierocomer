"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import DishDetail from "./DishDetail";
import DishDetailErrorBoundary from "./DishDetailErrorBoundary";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import WaiterButton from "../garzon/WaiterButton";
import BirthdayAutoModal from "../capture/BirthdayAutoModal";
import { norm } from "@/lib/normalize";
import DishPlaceholderIcon from "./DishPlaceholderIcon";
import SpicyStamp, { useClientAvoidsSpicy } from "./SpicyStamp";
import { canAccess, effectivePlan } from "@/lib/plans";
import { getGuestId } from "@/lib/guestId";
import { trackCategoryDwell } from "@/lib/sessionTracker";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import { trackSearchPerformed, track, flushEvents } from "./utils/cartaAnalytics";
import { getPersonalizedDishes, type PersonalizationMap } from "@/lib/qr/utils/getPersonalizedDishes";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { ScoringDish } from "@/lib/qr/utils/dishScoring";
import PromoCarousel from "../capture/PromoCarousel";
import ExperienceBanner from "../capture/ExperienceBanner";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";
import type { Lang } from "@/lib/qr/i18n";
import AnnouncementBanner from "./AnnouncementBanner";
import HappyHourBanner, { getActiveHappyHour } from "./HappyHourBanner";
import { getDishPhoto } from "./utils/dishHelpers";
import CartaFilterBar, { applyCartaFilter } from "./CartaFilterBar";
import type { CartaFilterKey } from "./CartaFilterBar";

/* ─── Multi-menu switcher (inline for Impact header) ─── */

function ImpactMenuSwitcher({ menuGroups, activeMenuSlug, accent }: {
  menuGroups: { slug: string; name: string }[];
  activeMenuSlug: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const activeName = menuGroups.find(g => g.slug === activeMenuSlug)?.name || activeMenuSlug;

  const navigate = (slug: string | null) => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("menu", slug);
    else url.searchParams.delete("menu");
    window.location.href = url.toString();
  };

  return (
    <div style={{ padding: "0 0 8px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => navigate(null)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: accent, fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 3,
          fontFamily: "var(--font-dm)",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Menús
        </button>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>·</span>
        <button onClick={() => setOpen(!open)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: "var(--carta-text, #fff)", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "var(--font-dm)",
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeName}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            zIndex: 61, marginTop: 4,
            background: "rgba(10,10,10,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)", padding: 6,
          }}>
            {menuGroups.map(g => (
              <button key={g.slug}
                onClick={() => { setOpen(false); if (g.slug !== activeMenuSlug) navigate(g.slug); }}
                style={{
                  width: "100%", padding: "11px 14px",
                  background: g.slug === activeMenuSlug ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent",
                  border: "none", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  fontFamily: "var(--font-dm)", fontSize: 14,
                  fontWeight: g.slug === activeMenuSlug ? 700 : 500,
                  color: g.slug === activeMenuSlug ? accent : "var(--carta-text, #fff)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                {g.slug === activeMenuSlug && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {g.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  happyHours?: any[];
  menuGroups?: { slug: string; name: string }[];
  activeMenuSlug?: string;
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
  const badge = isRec ? t(lang, "recommended") : isPop ? t(lang, "feedPopular") : null;

  return (
    <section
      style={{
        minHeight: 420,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        padding: "72px 20px 16px",
        margin: "0 14px",
        borderRadius: 28,
        isolation: "isolate",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
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
      {/* Photos or placeholder fallback */}
      {heroDishes.map((dish, i) => {
        const p = getDishPhoto(dish);
        return (
          <div key={dish.id} style={{
            position: "absolute", inset: 0, zIndex: -3,
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.8s ease",
          }}>
            {p ? (
              <img
                src={p} alt={dish.name}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.03)", filter: "saturate(1.1) contrast(1.08)", objectPosition: "center 60%" }}
              />
            ) : (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-accent) 18%, #1a1a2e), color-mix(in srgb, var(--carta-accent) 6%, #0f3460))",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <DishPlaceholderIcon size={90} opacity={0.35} />
              </div>
            )}
          </div>
        );
      })}

      {/* Dark overlays — always dark regardless of theme */}
      <div style={{
        position: "absolute", inset: 0, zIndex: -2,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.25) 36%, rgba(0,0,0,0.72) 78%, #030303 100%), linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.05))",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: -1, height: "50%", zIndex: -1,
        background: "linear-gradient(to top, #030303 0%, #030303 8%, rgba(3,3,3,0.85) 38%, rgba(3,3,3,0.4) 72%, transparent 100%)",
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
              ? <span key={i} style={{ display: "inline-block", color: "var(--carta-accent)", fontSize: 58, fontWeight: 900, textShadow: "0 0 20px color-mix(in srgb, var(--carta-accent) 50%, transparent), 0 0 50px color-mix(in srgb, var(--carta-accent) 22%, transparent)" }}>{w}</span>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {d.discountPrice && d.discountPrice < d.price && (
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: "var(--carta-accent)", padding: "4px 11px", borderRadius: 50 }}>
              -{Math.round(((d.price - d.discountPrice) / d.price) * 100)}%
            </span>
          )}
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--carta-accent)", letterSpacing: "-0.8px" }}>
            ${(d.discountPrice || d.price)?.toLocaleString("es-CL") ?? ""}
          </span>
          {d.discountPrice && d.discountPrice < d.price && (
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>
              ${d.price?.toLocaleString("es-CL")}
            </span>
          )}
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
      .filter((m) => dishes.some(d => d.categoryId === m.id && d.isActive)); // Show all categories with active dishes
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
        color: "var(--impact-section-title)",
      }}>
        {t(useLang(), "impactCraving" as any)}
      </h2>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 10, overflowX: "auto",
            padding: "4px 0 16px", scrollbarWidth: "none",
            msOverflowStyle: "none", WebkitOverflowScrolling: "touch",
          }}
        >
          {moods.map((m) => {
            const isActive = active === m.id;
            return (
              <button key={m.id} onClick={() => handleTap(m.id)} style={{
                width: 128, minWidth: 128, height: 148, borderRadius: 28, position: "relative", overflow: "hidden",
                padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                border: isActive
                  ? "1px solid color-mix(in srgb, var(--carta-accent) 90%, transparent)"
                  : "1px solid color-mix(in srgb, var(--carta-text) 14%, transparent)",
                background: "var(--carta-surface)", cursor: "pointer",
                boxShadow: isActive
                  ? "0 0 28px color-mix(in srgb, var(--carta-accent) 20%, transparent), 0 4px 16px rgba(0,0,0,0.12)"
                  : "0 4px 16px rgba(0,0,0,0.08)",
                flexShrink: 0,
              }}>
                {m.photo ? (
                  <img src={m.photo} alt={m.label} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent) 15%, var(--carta-surface)), color-mix(in srgb, var(--carta-accent) 5%, var(--carta-surface)))",
                  }}>
                    <DishPlaceholderIcon size={40} opacity={0.35} />
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, background: m.photo ? "linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.7))" : "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.5))" }} />
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
            position: "absolute", top: 0, left: 0, bottom: 8, width: 20,
            background: "linear-gradient(to left, transparent, var(--carta-bg))",
            pointerEvents: "none", opacity: 0.6,
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
    return dishes.filter((d) => d.tags?.includes("RECOMMENDED"));
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
        color: "var(--impact-section-title)",
      }}>{t(useLang(), "impactFeatured" as any)}</h2>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 13, overflowX: "auto",
            scrollSnapType: "x mandatory", scrollbarWidth: "none",
            padding: "4px 0 16px", msOverflowStyle: "none",
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
                  boxShadow: "0 6px 24px rgba(0,0,0,0.15), 0 0 24px color-mix(in srgb, var(--carta-accent) 8%, transparent)",
                }}
              >
                {photo ? (
                  <img src={photo} alt={f.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent) 15%, var(--carta-surface)), color-mix(in srgb, var(--carta-accent) 5%, var(--carta-surface)))",
                  }}>
                    <DishPlaceholderIcon size={56} opacity={0.35} />
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, background: photo ? "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.18) 62%, transparent)" : "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4))" }} />
                <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", color: "white" }}>⭐ {f.name}</h3>
                  {f.description && (
                    <p style={{
                      margin: "0 0 9px", color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.35,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{f.description}</p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {f.discountPrice && f.discountPrice < f.price && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "var(--carta-accent)", padding: "3px 10px", borderRadius: 50 }}>
                        -{Math.round(((f.price - f.discountPrice) / f.price) * 100)}%
                      </span>
                    )}
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--carta-accent)", letterSpacing: "-0.5px" }}>
                      ${(f.discountPrice || f.price)?.toLocaleString("es-CL") ?? ""}
                    </span>
                    {f.discountPrice && f.discountPrice < f.price && (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>
                        ${f.price?.toLocaleString("es-CL")}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {scrolled && (
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 8, width: 20,
            background: "linear-gradient(to left, transparent, var(--carta-bg))",
            pointerEvents: "none", opacity: 0.6,
          }} />
        )}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 8, width: 40,
          background: "linear-gradient(to right, transparent, var(--carta-bg))",
          pointerEvents: "none", opacity: 0.7,
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
  const lang = useLang();
  const photo = getDishPhoto(dish);
  const [imgLoaded, setImgLoaded] = useState(false);
  const isRec = dish.tags?.includes("RECOMMENDED");
  const isNew = dish.createdAt && (Date.now() - new Date(dish.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000;

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
        background: "rgba(244,166,35,0.03)", filter: "blur(10px)",
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
            <img
              src={photo} alt={dish.name} loading="lazy"
              onLoad={() => setImgLoaded(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
            />
          </>
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent) 15%, var(--carta-surface)), color-mix(in srgb, var(--carta-accent) 5%, var(--carta-surface)))",
            position: "relative", overflow: "hidden",
          }}>
            <DishPlaceholderIcon size={36} />
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 70% 30%, color-mix(in srgb, var(--carta-accent) 12%, transparent), transparent 60%)",
            }} />
          </div>
        )}
        {isNew && (
          <div style={{
            position: "absolute", top: 7, left: 7, zIndex: 2,
            background: "linear-gradient(135deg, #e8292c, #c41c1f)",
            color: "#fff", fontSize: 9, fontWeight: 900,
            letterSpacing: "0.06em", textTransform: "uppercase",
            padding: "3px 7px", borderRadius: 6,
            boxShadow: "0 2px 8px rgba(200,28,31,0.55)",
          }}>NUEVO</div>
        )}
        <SpicyStamp isSpicy={!!(dish as any).isSpicy} size={24} top={6} right={6} />
      </div>
      {/* Info */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        {(isRec || isPopular) && (
          <div style={{ marginBottom: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {isRec && (
              <span style={{
                fontSize: "0.72rem", fontWeight: 700,
                color: "#F4A623",
                background: "rgba(244,166,35,0.12)",
                padding: "2px 8px", borderRadius: 50,
              }}>
                {"⭐ " + t(lang, "recommended")}
              </span>
            )}
            {isPopular && (
              <span style={{
                fontSize: "0.72rem", fontWeight: 700,
                color: "#e85530",
                background: "rgba(232,85,48,0.12)",
                padding: "2px 8px", borderRadius: 50,
              }}>
                🔥 {t(lang, "feedPopular")}
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
          {(dish as any).isGlutenFree && <span style={{ fontSize: "16px", flexShrink: 0 }} title="Sin gluten">🌾</span>}
        </h4>
        {dish.description && (
          <p style={{
            margin: 0, color: "var(--carta-text-muted, #888)", fontSize: 14, lineHeight: 1.42,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>{dish.description}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {dish.discountPrice && dish.discountPrice < dish.price && (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "var(--carta-accent)", padding: "3px 10px", borderRadius: 50 }}>
              -{Math.round(((dish.price - dish.discountPrice) / dish.price) * 100)}%
            </span>
          )}
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
  dishes: rawDishes,
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
  happyHours,
  menuGroups,
  activeMenuSlug,
}: CartaProps) {
  const isFree = ((restaurant as any).plan || 'FREE') === 'FREE'
  const dishes = useMemo(
    () => isFree
      ? rawDishes.map((d: any) => d.tags?.includes('RECOMMENDED') ? { ...d, tags: (d.tags as string[]).filter(t => t !== 'RECOMMENDED') } : d)
      : rawDishes,
    [isFree, rawDishes],
  )
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasNewLikes, clearNewLikes } = useFavorites();

  // Happy hour banner
  const hasActiveHH = !!getActiveHappyHour(happyHours || []);
  const hasBannerActive = hasActiveHH || !!(announcements && announcements.length > 0);

  // Language select — multilang is Gold+ only
  const planKey = effectivePlan((restaurant as any).plan, (restaurant as any).subscriptionStatus);
  const hasMultilang = canAccess(planKey, "multilang");
  const enabledLangs: string[] = hasMultilang ? ((restaurant as any).enabledLangs || ["es"]) : ["es"];
  const [langOpen, setLangOpen] = useState(false);
  const LANG_FLAG_IMG: Record<string, string> = {
    es: "https://purecatamphetamine.github.io/country-flag-icons/3x2/ES.svg",
    en: "https://purecatamphetamine.github.io/country-flag-icons/3x2/GB.svg",
    pt: "https://purecatamphetamine.github.io/country-flag-icons/3x2/PT.svg",
    it: "https://purecatamphetamine.github.io/country-flag-icons/3x2/IT.svg",
    th: "https://purecatamphetamine.github.io/country-flag-icons/3x2/TH.svg",
  };
  const selectLang = useCallback((next: string) => {
    setLangOpen(false);
    if (next === lang) return;
    localStorage.setItem("qc_lang", next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.location.href = url.toString();
  }, [lang]);
  const popularDishIds = popularDishIdsProp ?? new Set<string>();
  const hasPromos = marketingPromos && marketingPromos.length > 0;

  /* ─── Active category tracking ─── */
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [showFixedCatNav, setShowFixedCatNav] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const fixedChipsRef = useRef<HTMLDivElement>(null);
  const fixedActiveChipRef = useRef<HTMLButtonElement>(null);
  const impactHeaderRef = useRef<HTMLDivElement>(null);
  const [impactHeaderH, setImpactHeaderH] = useState(65);

  // Auto-scroll fixed nav to active chip
  useEffect(() => {
    const chip = fixedActiveChipRef.current;
    const container = fixedChipsRef.current;
    if (chip && container) {
      const left = chip.offsetLeft - container.offsetWidth / 2 + chip.offsetWidth / 2;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [activeCategory, showFixedCatNav]);

  useEffect(() => {
    let shown = false;
    let scrolled = false; // require at least one real scroll before activating
    const check = () => {
      scrolled = true;
      const el = menuAnchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!shown && rect.top < 60) { shown = true; setShowFixedCatNav(true); }
      else if (shown && rect.top > 110) { shown = false; setShowFixedCatNav(false); }
    };
    // Delay attaching listener so iOS address-bar-hide scroll events don't trigger early
    const tid = setTimeout(() => {
      window.addEventListener("scroll", check, { passive: true });
    }, 400);
    return () => { clearTimeout(tid); window.removeEventListener("scroll", check); };
  }, []);
  // Measure real header height (includes safe-area-inset-top on iPhone)
  useEffect(() => {
    const el = impactHeaderRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setImpactHeaderH(el.offsetHeight));
    obs.observe(el);
    setImpactHeaderH(el.offsetHeight);
    return () => obs.disconnect();
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
    return () => observers.forEach((o) => o.disconnect());
  }, [categories, hasPromos]);

  /* ─── Dish / modal state ─── */
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishFromHero, setDishFromHero] = useState(false);
  const [openPromo, setOpenPromo] = useState<any>(null);
  const [qrUserLocal, setQrUserLocal] = useState<any>(null);
  const [profileOpenLocal, setProfileOpenLocal] = useState(false);
  const qrUser = qrUserProp ?? qrUserLocal;
  const handleProfileOpen = onProfileOpenProp ?? (() => setProfileOpenLocal(true));

  /* ─── Filter ─── */
  const [activeFilter, setActiveFilter] = useState<CartaFilterKey[]>([]);
  const toggleFilter = (key: CartaFilterKey) => setActiveFilter(f => {
    const next = f.includes(key) ? f.filter(k => k !== key) : [...f, key];
    if (next.length > 0) { track(restaurant.id, "FILTER_APPLIED", { query: next.join(",") }); flushEvents(); }
    return next;
  });
  const dishesFiltered = useMemo(
    () => applyCartaFilter(dishes, activeFilter, new Set(popularDishIds || [])),
    [dishes, activeFilter, popularDishIds],
  );

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

  // Background fetch for personalization (skip for demo)
  useEffect(() => {
    if ((restaurant as any).isDemo) return;
    const guestId = getGuestId();
    if (!guestId && !qrUser?.id) return;
    setPersonalizing(true);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 5000);
    fetch(`/api/qr/profile?restaurantId=${restaurant.id}&guestId=${guestId}`, { signal: abort.signal }).then((r) => r.json())
      .then((d) => {
        clearTimeout(timer);
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
      .catch(() => { clearTimeout(timer); setPersonalizing(false); });
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
            track(restaurant.id, "RECOMMENDATION_SHOWN", { dishId, metadata: { score: entry.score, reason: entry.reason, wasAutomatic: true } });
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
    const isFree = ((restaurant as any).plan || 'FREE') === 'FREE'
    if (isFree) {
      const pool = dishes.filter(d => d.photos?.[0])
      if (pool.length === 0) return dishes.slice(0, 1)
      return [pool[Math.floor(Date.now() / 86400000) % pool.length]]
    }
    // When viewing in non-Spanish lang, prefer dishes that have translations
    const preferTranslated = lang !== "es";
    const isTranslated = (d: any) => !preferTranslated || d._hasTranslation !== false;

    const withPhoto = (arr: Dish[]) => arr.filter((d) => d.photos?.[0]);
    const recommended = dishes.filter((d) => d.tags?.includes("RECOMMENDED"));
    const popular = dishes.filter((d) => popularDishIds.has(d.id) && !d.tags?.includes("RECOMMENDED"));

    // Mix: up to 2 recommended + up to 2 popular, intercalated
    // Prefer dishes with photos, but allow without photos if none have them
    const sortPriority = (arr: Dish[]) => [...arr].sort((a, b) => {
      return (isTranslated(b) ? 1 : 0) - (isTranslated(a) ? 1 : 0);
    });
    const mixed: Dish[] = [];
    const maxEach = 2;
    const recsWithPhoto = sortPriority(withPhoto(recommended));
    const recs = (recsWithPhoto.length > 0 ? recsWithPhoto : sortPriority(recommended)).slice(0, maxEach);
    const popsWithPhoto = sortPriority(withPhoto(popular));
    const pops = (popsWithPhoto.length > 0 ? popsWithPhoto : sortPriority(popular)).slice(0, maxEach);
    for (let i = 0; i < Math.max(recs.length, pops.length); i++) {
      if (i < recs.length) mixed.push(recs[i]);
      if (i < pops.length) mixed.push(pops[i]);
    }
    if (mixed.length > 0) return mixed.slice(0, 4);

    // Fallback: any dishes with photos, or just first dishes if none have photos
    const anyWithPhoto = withPhoto(dishes);
    return (anyWithPhoto.length > 0 ? anyWithPhoto : dishes).slice(0, 4);
  }, [dishes, popularDishIds, lang, restaurant]);

  /* ─── Sorted dishes ─── */
  const sortedDishes = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of categories) {
      const catDishes = dishesFiltered.filter((d) => d.categoryId === cat.id && d.isActive);
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
  }, [categories, dishesFiltered, pMap, sortKey, rankings, clientAvoidsSpicyForSort]);

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
      const top = el.getBoundingClientRect().top + window.scrollY - 106;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const handleDishClick = useCallback((dish: Dish) => {
    const entry = pMap?.get(dish.id);
    if (entry?.autoRecommended) {
      track(restaurant.id, "RECOMMENDATION_TAPPED", { dishId: dish.id, metadata: { score: entry.score, wasAutomatic: true } });
    }
    setSelectedDish(dish);
  }, [pMap, restaurant.id]);

  /* ─── Build filtered menu sections ─── */
  const menuSections = useMemo(() => {
    return categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.position - b.position)
      .map((cat) => {
        let catDishes = dishesFiltered
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
  }, [categories, dishesFiltered, searchQuery, sortKey, rankings, pMap, clientAvoidsSpicyForSort]);

  const allChipCats = useMemo(() => {
    const cats: { id: string; name: string }[] = [];
    // Ofertas has its own section above menu, not in chips
    for (const s of menuSections) cats.push({ id: s.category.id, name: s.category.name });
    return cats;
  }, [hasPromos, menuSections]);

  return (
    <div
      className="min-h-screen font-[family-name:var(--font-dm)]"
      style={{ background: "var(--carta-bg)", position: "relative", paddingTop: (restaurant as any).isDemo ? 105 : 0 }}
    >
      {/* Ambient background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle at 70% 0%, var(--impact-ambient-1, rgba(244,166,35,0.33)), transparent 30%), radial-gradient(circle at 8% 28%, var(--impact-ambient-2, rgba(244,166,35,0.28)), transparent 36%), radial-gradient(circle at 90% 72%, var(--impact-ambient-3, rgba(244,166,35,0.04)), transparent 26%), linear-gradient(var(--carta-bg), var(--carta-bg))",
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
        background: "radial-gradient(ellipse at 50% 8%, color-mix(in srgb, var(--carta-accent) 16%, transparent), transparent 32%), radial-gradient(ellipse at 70% 24%, color-mix(in srgb, var(--carta-accent) 10%, transparent), transparent 28%)",
        filter: "blur(10px)",
      }} />

      {/* Wrapper: nav + banner — fixed al tope */}
      <div ref={impactHeaderRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(3,3,3,0.32)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>

      {/* Nav: logo + botones */}
      <header style={{
        padding: "calc(10px + env(safe-area-inset-top)) 16px 0",
        pointerEvents: "auto",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(restaurant as any).logoUrl ? (
            <img
              src={(restaurant as any).logoUrl} alt={restaurant.name}
              loading="lazy"
              style={{ width: 34, height: 34, borderRadius: 10, objectFit: "contain" }}
            />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--carta-accent, #F4A623)", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800, color: "#0e0e0e", flexShrink: 0 }}>
              {restaurant.name?.charAt(0)?.toUpperCase() || "Q"}
            </div>
          )}
          <span style={{ fontWeight: 800, fontSize: 18, color: showFixedCatNav ? "var(--carta-text)" : "var(--carta-text, white)", letterSpacing: "-0.3px", transition: "color 0.3s ease" }}>
            {restaurant.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {enabledLangs.length > 1 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setLangOpen(!langOpen)} style={{ width: 40, height: 40, borderRadius: "50%", border: showFixedCatNav ? "1px solid var(--impact-chip-inactive-border)" : "1px solid var(--impact-chip-inactive-border, rgba(255,255,255,0.18))", background: showFixedCatNav ? "var(--impact-chip-inactive-bg)" : "var(--impact-chip-inactive-bg, rgba(255,255,255,0.08))", backdropFilter: "blur(10px)", cursor: "pointer", display: "grid", placeItems: "center", transition: "all 0.3s ease" }}>
                {LANG_FLAG_IMG[lang] ? <img src={LANG_FLAG_IMG[lang]} alt={lang} style={{ width: 22, height: 22, objectFit: "cover", borderRadius: "50%" }} /> : <span style={{ color: "var(--carta-text, #fff)", fontSize: 11, fontWeight: 900 }}>{lang.toUpperCase()}</span>}
              </button>
              <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, background: "rgba(0,0,0,0.9)",
                  opacity: langOpen ? 1 : 0, pointerEvents: langOpen ? "auto" : "none",
                  transform: langOpen ? "translateY(0)" : "translateY(-8px)",
                  transition: "opacity 0.15s ease, transform 0.15s ease",
                  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                  borderRadius: 14, padding: 4, border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 65,
                }}>
                  {/* Arrow */}
                  <div style={{ position: "absolute", top: -5, right: 14, width: 10, height: 10, background: "rgba(0,0,0,0.9)", transform: "rotate(45deg)", border: "1px solid rgba(255,255,255,0.12)", borderRight: "none", borderBottom: "none" }} />
                  {enabledLangs.map(l => (
                    <button key={l} onClick={() => selectLang(l)} style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 40, height: 40, border: "none", borderRadius: "50%", cursor: "pointer",
                      background: l === lang ? "rgba(255,255,255,0.15)" : "transparent",
                      margin: "2px 4px",
                    }}>
                      {LANG_FLAG_IMG[l] ? <img src={LANG_FLAG_IMG[l]} alt={l} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }} /> : <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{l.toUpperCase()}</span>}
                    </button>
                  ))}
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Announcement banner — between logo row and category chips */}
      {hasBannerActive && (
        <div style={{ padding: `6px 0 ${showFixedCatNav ? "10px" : "4px"}` }}>
          {announcements && announcements.length > 0
            ? <AnnouncementBanner announcements={announcements} variant="glass" accentColor={(restaurant as any).cartaAccentColor} />
            : <HappyHourBanner happyHours={happyHours || []} />}
        </div>
      )}

      {/* Multi-menu switcher */}
      {menuGroups && activeMenuSlug && menuGroups.length > 1 && (
        <ImpactMenuSwitcher menuGroups={menuGroups} activeMenuSlug={activeMenuSlug} accent={(restaurant as any).cartaAccentColor || "var(--carta-accent, #F4A623)"} />
      )}

      {/* Fixed category nav — slides in when menu section reaches header */}
      <div style={{
        overflow: "hidden",
        maxHeight: showFixedCatNav ? 50 : 0,
        transition: "max-height 0.25s ease",
        willChange: "max-height",
      }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <div ref={fixedChipsRef} style={{ padding: "0 0 10px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 20px), transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 20px), transparent)" }}>
              {allChipCats.map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    ref={isActive ? fixedActiveChipRef : null}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      scrollToCategory(cat.id);
                    }}
                    className="font-[family-name:var(--font-dm)]"
                    style={{
                      whiteSpace: "nowrap", flexShrink: 0,
                      border: isActive
                        ? "1px solid color-mix(in srgb, var(--carta-accent) 55%, transparent)"
                        : "1px solid var(--impact-chip-inactive-border)",
                      background: isActive
                        ? "color-mix(in srgb, var(--carta-accent) 10%, transparent)"
                        : "var(--impact-chip-inactive-bg)",
                      borderRadius: 999, padding: "7px 12px",
                      color: isActive ? "var(--impact-chip-active-text, var(--carta-accent))" : "var(--impact-chip-inactive-text)",
                      fontSize: 13, fontWeight: 800, cursor: "pointer",
                    }}
                  >{cat.name}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </header>

      </div>{/* end fixed wrapper */}

      {/* Spacer: reserva el espacio del nav fixed para que el contenido no quede debajo */}
      <div style={{ height: impactHeaderH }} />

      {/* Search overlay */}

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
          cycleLang={() => setLangOpen(!langOpen)}
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
            color: "var(--impact-section-title)",
          }}>{t(lang, "impactOffers" as any)}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(marketingPromos || []).map((p: any) => {
              const dish = p.dishes?.[0];
              const photo = p.imageUrl || dish?.photos?.[0];
              const words = p.name.split(" ");
              return (
                <button
                  key={p.id}
                  onClick={() => setOpenPromo(p)}
                  style={{
                    width: "100%", height: 220, borderRadius: 26, overflow: "hidden", position: "relative",
                    background: "#111", border: "none",
                    boxShadow: "0 6px 24px rgba(0,0,0,0.2)",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  {/* Foto fondo con overlay */}
                  {photo && (
                    <div style={{ position: "absolute", inset: 0, transform: "scale(1.04)" }}>
                      <img src={photo} alt={p.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center right" }} />
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
                      fontSize: 36, lineHeight: 0.85, letterSpacing: "0.5px",
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
                          margin: "0 0 12px", color: "var(--impact-offer-desc, #b0a89e)", fontSize: 14, lineHeight: 1.42,
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


      {/* Personalización ocurre en background sin bloquear la UI */}

      {/* ═══════ MENÚ ═══════ */}
      <div style={{ padding: "24px 14px 14px", position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 8 }}>
        {/* Título — se oculta cuando busca */}
        <h2 style={{
          fontFamily: "var(--font-bebas), 'Bebas Neue', Impact, sans-serif", fontSize: 32,
          letterSpacing: "0.8px", margin: 0, lineHeight: 0.9,
          color: "var(--impact-section-title)",
          flex: searchOpen ? "0 0 0" : 1,
          overflow: "hidden",
          opacity: searchOpen ? 0 : 1,
          transition: "flex 0.22s ease, opacity 0.15s ease",
          whiteSpace: "nowrap",
        }}>
          {t(lang, "impactMenu" as any)}
        </h2>

        {/* Input inline — se expande desde la derecha */}
        <div style={{
          flex: searchOpen ? 1 : "0 0 0",
          overflow: "hidden",
          opacity: searchOpen ? 1 : 0,
          transition: "flex 0.22s ease, opacity 0.18s ease",
          display: "flex", alignItems: "center",
          minWidth: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, background: "var(--impact-chip-inactive-bg, rgba(255,255,255,0.1))", borderRadius: 999, padding: "0 12px", border: "1px solid var(--impact-chip-inactive-border, rgba(255,255,255,0.18))", width: "100%" }}>
            <Search size={14} color="var(--carta-text-muted, rgba(255,255,255,0.5))" style={{ flexShrink: 0 }} />
            <input
              id="impact-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && menuAnchorRef.current) {
                  menuAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              placeholder={t(lang, "search")}
              className="font-[family-name:var(--font-dm)]"
              style={{ flex: 1, border: "none", outline: "none", fontSize: "15px", color: "var(--carta-text, #fff)", background: "transparent", minWidth: 0 }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (searchOpen) {
              setSearchOpen(false);
              setSearchQuery("");
            } else {
              setSearchOpen(true);
              setTimeout(() => document.getElementById("impact-search-input")?.focus(), 250);
            }
          }}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--impact-chip-inactive-border, rgba(255,255,255,0.18))", background: searchOpen ? "var(--impact-chip-inactive-bg, rgba(255,255,255,0.15))" : "var(--impact-chip-inactive-bg, rgba(255,255,255,0.08))", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}
        >
          {searchOpen
            ? <X size={15} color="var(--carta-text, white)" />
            : <Search size={15} color="var(--carta-text, white)" />}
        </button>
      </div>
      {/* Filter bar — solo Gold y Premium */}
      {(restaurant as any).plan !== "FREE" && (
        <div style={{ padding: "8px 14px 0", position: "relative", zIndex: 2 }}>
          <CartaFilterBar active={activeFilter} onToggle={toggleFilter} />
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "0 14px 16px" }}>
        {/* Category chips + search */}
        <div ref={menuAnchorRef} style={{ paddingTop: 6, paddingBottom: 6, marginBottom: 0 }}>
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
                        if (cat.id === "promos") {
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
                          : "1px solid var(--impact-chip-inactive-border)",
                        background: isActive
                          ? "color-mix(in srgb, var(--carta-accent) 10%, transparent)"
                          : "var(--impact-chip-inactive-bg)",
                        borderRadius: 999, padding: "10px 16px",
                        color: isActive ? "var(--impact-chip-active-text, var(--carta-accent))" : "var(--impact-chip-inactive-text)",
                        fontSize: 15, fontWeight: 800, cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >{cat.name}</button>
                  );
                })}
              </div>
              {/* Fade left — only when scrolled */}
              {chipsRef.current && chipsRef.current.scrollLeft > 10 && (
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0, width: 20,
                  background: "linear-gradient(to left, transparent, var(--carta-bg))",
                  pointerEvents: "none", opacity: 0.6,
                }} />
              )}
              {/* Fade right */}
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: 24,
                background: "linear-gradient(to right, transparent, var(--carta-bg))",
                pointerEvents: "none", opacity: 0.8,
              }} />
            </div>
          </div>
        </div>


        {/* Empty state — búsqueda */}
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

        {/* Empty state — filtro activo sin resultados */}
        {activeFilter.length > 0 && !searchQuery && menuSections.length === 0 && (
          <div className="font-[family-name:var(--font-dm)]" style={{ padding: "64px 28px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
            <p style={{ color: "var(--carta-text)", fontSize: "0.95rem", fontWeight: 600, marginBottom: 6 }}>
              Sin resultados para los filtros seleccionados
            </p>
            <p style={{ color: "var(--carta-text-muted)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: 16 }}>
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

        {/* Category sections */}
        {menuSections.map(({ category, dishes: catDishes }, index) => (
          <div key={category.id}>
            {index === Math.max(2, Math.floor(menuSections.length * 0.4)) && (
              <ExperienceBanner restaurantId={restaurant.id} />
            )}
            <div id={`impact-cat-${category.id}`} style={{ marginBottom: 20 }}>
              <h3 style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26,
                color: "var(--impact-section-title)", margin: "33px 0 14px", letterSpacing: "0.6px", lineHeight: 0.9, opacity: 0.8,
              }}>{category.name}</h3>
              {category.description && category.description.length <= 60 && (
                <p style={{ fontSize: "0.8rem", color: "var(--carta-text3, #999)", marginTop: -6, marginBottom: 8 }}>
                  {category.description}
                </p>
              )}
              {catDishes.map((dish, dishIdx) => {
                // Check if this is the last translated dish followed by untranslated ones
                const showTranslationBanner = (restaurant as any).isDemo && lang !== "es"
                  && (dish as any)._hasTranslation
                  && catDishes[dishIdx + 1] && !(catDishes[dishIdx + 1] as any)._hasTranslation;
                return (
                  <div key={dish.id}>
                    <div data-dish-id={dish.id}>
                      <ImpactDishCard
                        dish={dish}
                        rating={ratingMap[dish.id]}
                        isPopular={popularDishIds.has(dish.id)}
                        autoRecommended={pMap?.get(dish.id)?.autoRecommended}
                        onClick={() => handleDishClick(dish)}
                      />
                    </div>
                    {showTranslationBanner && (
                      <div
                        className="font-[family-name:var(--font-dm)]"
                        style={{
                          margin: "4px 0 14px", padding: "12px 14px",
                          background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03))",
                          border: "1px solid rgba(59,130,246,0.15)", borderRadius: 14,
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>🌍</span>
                        <span style={{ fontSize: "0.85rem", color: "var(--carta-text2, rgba(255,255,255,0.55))", lineHeight: 1.45 }}>
                          Tradujimos los primeros platos para que lo veas. Al activar tu carta, se traduce completa.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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
          href="https://quierocomer.com" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <span style={{ color: "var(--carta-text3, #555)", fontSize: "0.72rem", fontWeight: 500 }}>Powered by</span>
          <span
            className="font-[family-name:var(--font-playfair)]"
            style={{ color: "var(--carta-accent)", fontSize: "0.82rem", fontWeight: 700 }}
          >
            QuieroComer.com
          </span>
        </a>
        <span style={{ color: "var(--carta-text3, #555)", fontSize: "0.62rem" }}>&copy; {new Date().getFullYear()}</span>
      </footer>

      {/* FAB: waiter button */}
      {!(restaurant as any).isDemo && showWaiter && (
        <div className="fixed z-50" style={{ right: 14, bottom: "calc(16px + env(safe-area-inset-bottom)" }}>
          <WaiterButton restaurantId={restaurant.id} tableId={tableId || undefined} waiterPanelActive={showWaiter} />
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes genioFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes impactShimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      `}</style>

      {/* DishDetail modal */}
      {selectedDish && (
        <DishDetailErrorBoundary onClose={() => { setSelectedDish(null); setDishFromHero(false); }}>
          <DishDetail
            dish={selectedDish}
            allDishes={dishes}
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

      {/* Birthday auto-modal */}
      {!(restaurant as any).isDemo && <BirthdayAutoModal restaurantId={restaurant.id} restaurantName={restaurant.name} birthdayPerk={(restaurant as any).birthdayPerk} logoUrl={restaurant.logoUrl} />}

    </div>
  );
}
