"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Globe } from "lucide-react";
import { trackCategoryDwell } from "@/lib/sessionTracker";
import { trackSearchPerformed, trackCartaDishOpenedInList } from "./utils/cartaAnalytics";
import { norm } from "@/lib/normalize";
import { useLang } from "@/contexts/LangContext";
import { t } from "@/lib/qr/i18n";
import type { Restaurant, Category, Dish, RestaurantPromotion } from "@prisma/client";
import ViewSelector from "./ViewSelector";
import { groupDishesByCategory, isGeniePick } from "./utils/dishHelpers";
import { getCarouselMode, hasMatchingDishes, getDietMessage } from "@/lib/qr/utils/carouselMode";
import DishDetailEsencial from "./DishDetailEsencial";
import FabSpeedDial from "./FabSpeedDial";
import ViewSelectorCompact from "./ViewSelectorCompact";
import GenioFab from "./GenioFab";
import GenioOnboarding from "../genio/GenioOnboarding";
import { canAccess, effectivePlan } from "@/lib/plans";

/* ─── palettes ─── */
const LIGHT = {
  bg: "#f7f1e7",
  paper: "#fffaf2",
  ink: "#15241b",
  muted: "#756b5f",
  gold: "#b88935",
  goldSoft: "#efe0c4",
  line: "#e2d2b8",
  green: "#10251a",
  green2: "#193624",
  desc: "#423a33",
  gradient: "linear-gradient(180deg, #fffaf2 0%, #f8efe2 100%)",
  headerBg: "rgba(255,250,242,0.92)",
  cardBg: "#fffaf2",
  heroBg: "linear-gradient(180deg, #fffaf2 0%, #f5ead8 100%)",
  pillBg: "#fff9ef",
  pillActive: "#15241b",
  pillActiveText: "#fffaf2",
  searchBg: "#fffaf2",
  circleBtnBg: "#fff7ea",
  tagPopularBg: "rgba(184,137,53,0.12)",
  tagPopularBorder: "rgba(184,137,53,0.25)",
  tagPopularColor: "#7f5100",
  rankNumBg: "#efe0c4",
  rankNumColor: "#7f5100",
} as const;

const DARK = {
  bg: "#0e0e0c",
  paper: "#161614",
  ink: "#e8dcc4",
  muted: "#8a7f72",
  gold: "#d4a84b",
  goldSoft: "#252018",
  line: "#282622",
  green: "#d4a84b",
  green2: "#c49a3d",
  desc: "#b8ad9e",
  gradient: "linear-gradient(180deg, #161614 0%, #0e0e0c 100%)",
  headerBg: "rgba(22,22,20,0.92)",
  cardBg: "#1c1c19",
  heroBg: "linear-gradient(180deg, #1c1c19 0%, #181816 100%)",
  pillBg: "#1c1c19",
  pillActive: "#d4a84b",
  pillActiveText: "#0e0e0c",
  searchBg: "#1c1c19",
  circleBtnBg: "rgba(255,255,255,0.08)",
  tagPopularBg: "rgba(212,168,75,0.15)",
  tagPopularBorder: "rgba(212,168,75,0.3)",
  tagPopularColor: "#d4a84b",
  rankNumBg: "rgba(212,168,75,0.2)",
  rankNumColor: "#d4a84b",
} as const;

type Palette = { [K in keyof typeof LIGHT]: string };

/* ─── interfaces ─── */
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

/* ─── category icons ─── */
function catIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("entrada") || n.includes("starter")) return "🥗";
  if (n.includes("sopa") || n.includes("soup")) return "🍜";
  if (n.includes("ensalad") || n.includes("salad")) return "🥬";
  if (n.includes("carne") || n.includes("meat") || n.includes("res")) return "🥩";
  if (n.includes("pollo") || n.includes("chicken") || n.includes("ave")) return "🍗";
  if (n.includes("pescado") || n.includes("fish") || n.includes("mar")) return "🐟";
  if (n.includes("pasta") || n.includes("noodle")) return "🍝";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("sushi") || n.includes("roll") || n.includes("japonés")) return "🍣";
  if (n.includes("postre") || n.includes("dessert") || n.includes("dulce")) return "🍰";
  if (n.includes("bebida") || n.includes("drink") || n.includes("jugo") || n.includes("trago")) return "🍹";
  if (n.includes("café") || n.includes("coffee")) return "☕";
  if (n.includes("cerveza") || n.includes("beer")) return "🍺";
  if (n.includes("vino") || n.includes("wine")) return "🍷";
  if (n.includes("cocktail") || n.includes("cóctel")) return "🍸";
  if (n.includes("hamburguesa") || n.includes("burger")) return "🍔";
  if (n.includes("taco") || n.includes("mexic")) return "🌮";
  if (n.includes("sandwich") || n.includes("sándwich")) return "🥪";
  if (n.includes("desayuno") || n.includes("breakfast")) return "🥞";
  if (n.includes("snack") || n.includes("piqueo") || n.includes("compartir")) return "🍿";
  return "🍽";
}

/* ─── lang names ─── */
const LANG_NAMES: Record<string, string> = {
  es: "Español", en: "English", pt: "Português", fr: "Français", de: "Deutsch", it: "Italiano", zh: "中文", ja: "日本語", ko: "한국어",
};

/* ─── circle button style (computed per render via C) ─── */
// Defined inside component as `circleBtn` local

/* ─── hero phrases ─── */
function heroPhrase(catName: string): string {
  const n = catName.toLowerCase();
  if (n.includes("entrada")) return "Para comenzar";
  if (n.includes("postre") || n.includes("dulce")) return "Dulce final";
  if (n.includes("bebida") || n.includes("trago") || n.includes("drink")) return "Para beber";
  if (n.includes("ensalad")) return "Frescura natural";
  if (n.includes("carne") || n.includes("res")) return "Sabor intenso";
  if (n.includes("pescado") || n.includes("mar")) return "Del mar a la mesa";
  if (n.includes("sushi") || n.includes("roll")) return "Arte japonés";
  if (n.includes("pasta")) return "Tradición italiana";
  if (n.includes("pizza")) return "Desde el horno";
  return catName;
}

/* ════════════════════════════════════════════════════════════════════════════ */

export default function CartaEsencial({
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
  timeOfDay,
  weather,
  popularDishIds: popularDishIdsProp,
  announcements,
}: Props) {
  const lang = useLang();
  const popularDishIds = popularDishIdsProp ?? new Set<string>();

  /* ─── dark mode detection ─── */
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => {
      const container = document.querySelector(".carta-dark");
      setIsDark(!!container);
    };
    check();
    // Re-check when theme toggles
    const obs = new MutationObserver(check);
    const target = document.querySelector(".carta-dark, .carta-light");
    if (target) obs.observe(target, { attributes: true, attributeFilter: ["class"] });
    // Also watch parent
    if (target?.parentElement) obs.observe(target.parentElement, { attributes: true, attributeFilter: ["class"], subtree: true });
    return () => obs.disconnect();
  }, []);
  const C: Palette = isDark ? DARK : LIGHT;
  const circleBtn: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%",
    border: `1px solid ${C.line}`, background: C.circleBtnBg,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: C.ink, textDecoration: "none",
  };

  /* ─── onboarding active detection ─── */
  const [onboardingActive, setOnboardingActive] = useState(false);
  useEffect(() => {
    const check = () => setOnboardingActive(document.body.hasAttribute("data-demo-onboarding"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-demo-onboarding"] });
    return () => obs.disconnect();
  }, []);

  /* ─── lang dropdown ─── */
  const [langOpen, setLangOpen] = useState(false);

  /* ─── genio diet state ─── */
  const [hasCompletedGenio, setHasCompletedGenio] = useState(false);
  useEffect(() => {
    const check = () => {
      setHasCompletedGenio(!!(localStorage.getItem("qr_diet") && localStorage.getItem("qr_restrictions")));
    };
    const onGenioUpdated = () => {
      check();
      setTimeout(() => {
        const el = document.getElementById("esencial-genio-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 500);
    };
    check();
    window.addEventListener("genio-updated", onGenioUpdated);
    return () => window.removeEventListener("genio-updated", onGenioUpdated);
  }, []);

  const genioDishes = useMemo(() => {
    if (!hasCompletedGenio || typeof window === "undefined") return [];
    const diet = localStorage.getItem("qr_diet");
    const restrictions: string[] = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const activeR = restrictions.filter(r => r !== "ninguna");

    return dishes.filter(d => {
      const dd = (d as any).dishDiet;
      const isGF = (d as any).isGlutenFree;
      const isLF = (d as any).isLactoseFree;
      if (diet === "vegan" && dd !== "VEGAN") return false;
      if (diet === "vegetarian" && dd !== "VEGAN" && dd !== "VEGETARIAN") return false;
      if (activeR.includes("sin gluten") && !isGF) return false;
      if (activeR.includes("sin lactosa") && !isLF) return false;
      return true;
    });
  }, [hasCompletedGenio, dishes]);

  /* ─── search ─── */
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

  /* ─── category nav ─── */
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const catScrollRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<HTMLButtonElement>(null);
  const catStartRef = useRef<{ id: string; start: number }>({ id: categories[0]?.id || "", start: Date.now() });

  // auto-scroll category pill into view
  useEffect(() => {
    if (activeCatRef.current && catScrollRef.current) {
      const container = catScrollRef.current;
      const el = activeCatRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [activeCategory]);

  // intersection observer for active category
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const cat of categories) {
      const el = document.getElementById(`esencial-cat-${cat.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveCategory(cat.id); },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((obs) => obs.disconnect());
  }, [categories]);

  // dwell tracking
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

  /* ─── genio modal ─── */
  const [genioOpen, setGenioOpen] = useState(false);

  /* ─── dish detail ─── */
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);

  const allSorted = useMemo(() => {
    const result: Dish[] = [];
    for (const cat of [...categories].sort((a, b) => a.position - b.position)) {
      result.push(...dishes.filter((d) => d.categoryId === cat.id).sort((a, b) => a.position - b.position));
    }
    return result;
  }, [categories, dishes]);

  const handleDishClick = (dish: Dish) => {
    setSelectedDish(dish);
    trackCartaDishOpenedInList(restaurant.id, dish.id, isGeniePick(dish));
  };

  /* ─── filtered + grouped ─── */
  const filtered = useMemo(() => {
    if (!query) return dishes;
    const q = norm(query.trim());
    return dishes.filter((d) => norm(d.name || "").includes(q) || norm(d.description || "").includes(q) || norm(d.ingredients || "").includes(q));
  }, [dishes, query]);

  const grouped = useMemo(() => groupDishesByCategory(filtered, categories), [filtered, categories]);

  /* ─── popular dishes for ranking ─── */
  const topPopular = useMemo(() => {
    if (!popularDishIds || popularDishIds.size === 0) return [];
    return dishes.filter((d) => popularDishIds.has(d.id)).slice(0, 3);
  }, [dishes, popularDishIds]);

  /* ─── active category data for hero ─── */
  const activeCat = useMemo(() => categories.find((c) => c.id === activeCategory), [categories, activeCategory]);

  /* ─── hero rotation ─── */
  const heroDishes = useMemo(() => {
    const rec = dishes.filter(d => d.tags?.includes("RECOMMENDED"));
    const pop = dishes.filter(d => popularDishIds.has(d.id) && !rec.some(r => r.id === d.id));
    const pool = [...rec, ...pop];
    return pool.length > 0 ? pool.slice(0, 5) : dishes.slice(0, 3);
  }, [dishes, popularDishIds]);
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    if (heroDishes.length <= 1) return;
    const timer = setInterval(() => setHeroIdx(i => (i + 1) % heroDishes.length), 5000);
    return () => clearInterval(timer);
  }, [heroDishes.length]);

  /* ─── onReady ─── */
  useEffect(() => { onReady?.(); }, [readyKey]);

  /* ──────────────────────────────── RENDER ──────────────────────────────── */
  return (
    <div className="esencial-view" style={{
      minHeight: "100vh",
      maxWidth: 520,
      margin: "0 auto",
      background: C.gradient,
      fontFamily: "Georgia, 'Times New Roman', serif",
      color: C.ink,
      paddingTop: (restaurant as any).isDemo && !onboardingActive ? 115 : 0,
    }}>

      {/* ══════ STICKY HEADER ══════ */}
      <header style={{
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: C.headerBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.line}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {/* logo circle */}
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: isDark ? "#1c1c19" : "#10251a", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, overflow: "hidden",
            boxShadow: "none",
          }}>
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            ) : (
              <span style={{ color: C.gold, fontSize: 20 }}>🍽</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 20, fontWeight: 400, lineHeight: 1.1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {restaurant.name}
            </div>
            {(restaurant as any).subtitle && (
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
                {(restaurant as any).subtitle}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {(restaurant as any).website && (
            <a href={(restaurant as any).website.startsWith("http") ? (restaurant as any).website : `https://${(restaurant as any).website}`} target="_blank" rel="noopener noreferrer" style={circleBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </a>
          )}
          {(restaurant as any).instagram && (
            <a href={(restaurant as any).instagram} target="_blank" rel="noopener noreferrer" style={circleBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
          )}
          <div style={{ position: "relative" }}>
            <button onClick={() => setLangOpen(o => !o)} style={circleBtn}>
              <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "system-ui, sans-serif", textTransform: "uppercase" }}>{lang}</span>
            </button>
            {langOpen && (
              <>
                <div onClick={() => setLangOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                  background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 14,
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 120,
                }}>
                  {(((restaurant as any).enabledLangs?.length > 1 ? (restaurant as any).enabledLangs : ["es", "en", "pt"]) as string[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setLangOpen(false);
                        const params = new URLSearchParams(window.location.search);
                        params.set("lang", l);
                        window.location.search = params.toString();
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "10px 14px", border: "none",
                        background: l === lang ? C.goldSoft : "transparent",
                        cursor: "pointer", fontSize: 13, fontWeight: l === lang ? 800 : 500,
                        color: C.ink, fontFamily: "system-ui, sans-serif",
                        borderBottom: `1px solid ${C.line}`,
                      }}
                    >
                      <span style={{ textTransform: "uppercase", fontWeight: 800, fontSize: 11, width: 22 }}>{l}</span>
                      <span>{LANG_NAMES[l] || l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {(restaurant as any).plan !== "FREE" && <ViewSelectorCompact restaurantId={restaurant.id} plan={(restaurant as any).plan} defaultView={(restaurant as any).defaultView} />}
        </div>
      </header>

      {/* ══════ HERO — featured dish card (rotates) ══════ */}
      {(() => {
        const heroDish = heroDishes[heroIdx];
        if (!heroDish) return null;
        return (
          <section style={{ padding: "20px 18px 12px" }}>
            <div
              onClick={() => handleDishClick(heroDish)}
              style={{
                background: isDark
                  ? "linear-gradient(180deg, #222220 0%, #1c1c19 100%)"
                  : "linear-gradient(180deg, #fff6e8 0%, #eedcbe 100%)",
                border: `1px solid ${isDark ? "rgba(212,168,75,0.15)" : "rgba(184,137,53,0.25)"}`,
                borderRadius: 30,
                padding: 20,
                boxShadow: isDark
                  ? "0 18px 44px rgba(0,0,0,0.2)"
                  : "0 18px 44px rgba(56,38,15,0.1)",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
            >
              {/* meta row */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 12, marginBottom: 14,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 999,
                  background: isDark ? "rgba(212,168,75,0.12)" : "rgba(184,137,53,0.1)",
                  border: `1px solid ${isDark ? "rgba(212,168,75,0.25)" : "rgba(184,137,53,0.2)"}`,
                  color: C.gold, letterSpacing: ".12em", textTransform: "uppercase",
                  fontSize: 11, fontWeight: 900,
                }}>
                  ★ Recomendado
                </span>
                <span style={{ color: C.muted, fontSize: 12, fontWeight: 800 }}>
                  Ver plato →
                </span>
              </div>
              {/* dish name */}
              <h1 style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 43, fontWeight: 400, lineHeight: .94, letterSpacing: "-.055em",
                margin: 0, maxWidth: 340, color: C.ink,
              }}>
                {heroDish.name}
              </h1>
              {/* gold line */}
              <div style={{ width: 54, height: 3, background: C.gold, margin: "24px 0 16px", borderRadius: 2 }} />
              {/* description */}
              <p style={{
                fontSize: 16, color: C.muted, lineHeight: 1.55, maxWidth: 340, margin: 0,
                fontFamily: "system-ui, -apple-system, sans-serif",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden",
              }}>
                {heroDish.description || "El favorito de la casa."}
              </p>
              {/* price + dots */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
                <strong style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 20, lineHeight: 1, color: C.ink,
                }}>
                  ${(heroDish.discountPrice || heroDish.price)?.toLocaleString("es-CL")}
                </strong>
                {heroDishes.length > 1 && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {heroDishes.map((_, i) => (
                      <div key={i} style={{
                        width: i === heroIdx ? 12 : 5, height: 5, borderRadius: 3,
                        background: i === heroIdx ? C.gold : isDark ? "rgba(212,168,75,0.3)" : "rgba(184,137,53,0.25)",
                        transition: "all 0.3s ease",
                      }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ══════ GENIO DIET SECTION ══════ */}
      {hasCompletedGenio && genioDishes.length > 0 && !query && (
        <section id="esencial-genio-section" style={{
          margin: "0 16px 14px",
          padding: "24px 20px",
          background: isDark
            ? "linear-gradient(135deg, #1a1510 0%, #231c12 100%)"
            : `linear-gradient(135deg, ${C.green} 0%, ${C.green2} 100%)`,
          borderRadius: 30,
          color: C.paper,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", width: 180, height: 180, borderRadius: "50%",
            background: isDark
              ? "radial-gradient(circle, rgba(212,168,75,0.2), transparent 66%)"
              : "radial-gradient(circle, rgba(184,137,53,0.28), transparent 66%)",
            right: -60, top: -70,
          }} />
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase",
            color: C.gold, marginBottom: 6, position: "relative",
          }}>
            🧞 Tu selección
          </div>
          <h2 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 24, fontWeight: 400, margin: "0 0 16px", color: isDark ? "#e8dcc4" : C.paper,
            position: "relative",
          }}>
            {(() => {
              const diet = localStorage.getItem("qr_diet");
              const restrictions: string[] = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
              const activeR = restrictions.filter(r => r !== "ninguna");
              const parts: string[] = [];
              if (diet === "vegan") parts.push("veganos");
              else if (diet === "vegetarian") parts.push("vegetarianos");
              activeR.forEach(r => parts.push(`sin ${r}`));
              return parts.length > 0 ? `Platos para ti ${parts.join(" y ")}` : "Platos para ti";
            })()}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
            {genioDishes.slice(0, 5).map(d => (
              <button
                key={d.id}
                onClick={() => handleDishClick(d)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  background: isDark ? "rgba(212,168,75,0.06)" : "rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  border: isDark ? "1px solid rgba(212,168,75,0.15)" : "1px solid rgba(184,137,53,0.25)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: isDark ? "#e8dcc4" : C.paper,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {d.name}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    {(d as any).dishDiet === "VEGAN" && <span style={{ fontSize: 10, fontWeight: 500, color: "#86efac" }}>🌿 Vegano</span>}
                    {(d as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: 10, fontWeight: 500, color: "#86efac" }}>🥬 Vegetariano</span>}
                    {(d as any).isGlutenFree && <span style={{ fontSize: 10, fontWeight: 500, color: "#fde68a" }}>Sin gluten</span>}
                    {(d as any).isSpicy && <span style={{ fontSize: 10, fontWeight: 500, color: "#fca5a5" }}>🌶 Picante</span>}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.gold, flexShrink: 0, fontFamily: "system-ui, sans-serif" }}>
                  ${(d.discountPrice || d.price)?.toLocaleString("es-CL") ?? "—"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ══════ OFERTAS ══════ */}
      {marketingPromos && marketingPromos.length > 0 && (
        <section id="esencial-cat-promos" style={{ padding: "10px 18px 0" }}>
          <div style={{
            padding: "16px 20px", borderRadius: 16,
            background: C.heroBg, border: `1px solid ${C.line}`,
          }}>
            <div style={{
              display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: ".18em",
              textTransform: "uppercase", color: C.paper, background: C.gold,
              padding: "4px 10px", borderRadius: 50, marginBottom: 12,
            }}>
              Ofertas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {marketingPromos.map((p: any, idx: number) => {
                const dish = p.dishes?.[0];
                const pct = p.originalPrice && p.promoPrice
                  ? Math.round(((p.originalPrice - p.promoPrice) / p.originalPrice) * 100)
                  : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => { if (dish) { const d = dishes.find((dd: any) => dd.id === dish.id); if (d) setSelectedDish(d); } }}
                    style={{
                      width: "100%", background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", padding: "10px 0",
                      borderBottom: idx < marketingPromos.length - 1 ? `1px solid ${C.line}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                        {p.originalPrice && (
                          <span style={{ fontSize: 13, color: C.muted, textDecoration: "line-through" }}>
                            ${p.originalPrice.toLocaleString("es-CL")}
                          </span>
                        )}
                        {p.promoPrice && (
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>
                            ${p.promoPrice.toLocaleString("es-CL")}
                          </span>
                        )}
                        {pct && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.paper, background: C.gold, padding: "2px 7px", borderRadius: 6 }}>
                            -{pct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════ CATEGORY PILLS ══════ */}
      <nav ref={catScrollRef} style={{
        position: onboardingActive ? "relative" : "sticky", top: onboardingActive ? undefined : ((restaurant as any).isDemo ? 115 : 0), zIndex: 15,
        display: "flex", gap: 10, overflowX: "auto", padding: "24px 18px 14px",
        scrollbarWidth: "none", msOverflowStyle: "none" as any,
        WebkitOverflowScrolling: "touch" as any,
        background: C.headerBg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      }}>
        <style>{`.esencial-cat-scroll::-webkit-scrollbar{display:none}`}</style>
        {categories.filter((c) => c.isActive).sort((a, b) => a.position - b.position).map((cat) => {
          const isActive = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              ref={isActive ? activeCatRef : null}
              onClick={() => {
                setActiveCategory(cat.id);
                const el = document.getElementById(`esencial-cat-${cat.id}`);
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 100;
                  window.scrollTo({ top, behavior: "smooth" });
                }
              }}
              style={{
                flexShrink: 0,
                display: "flex", alignItems: "center",
                padding: "9px 14px",
                borderRadius: 0,
                border: "none",
                background: "transparent",
                color: isActive ? C.ink : C.muted,
                fontSize: 12, fontWeight: isActive ? 800 : 500,
                letterSpacing: ".06em",
                textTransform: "uppercase" as const,
                fontFamily: "system-ui, -apple-system, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
                borderBottom: isActive ? `2px solid ${C.gold}` : "2px solid transparent",
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </nav>

      {/* ══════ SEARCH BAR (when open) ══════ */}
      {searchOpen && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: "0 16px 12px", padding: "10px 14px",
          background: C.searchBg, borderRadius: 16,
          border: `1px solid ${C.line}`,
        }}>
          <Search size={16} color={C.muted} style={{ flexShrink: 0 }} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "search") || "Buscar plato..."}
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 16,
              color: C.ink, background: "transparent",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          />
          <button
            onClick={() => { setSearchOpen(false); setQuery(""); }}
            style={{ background: "none", border: "none", padding: 4, cursor: "pointer", flexShrink: 0 }}
          >
            <X size={18} color={C.muted} />
          </button>
        </div>
      )}

      {/* ══════ EMPTY STATE ══════ */}
      {grouped.length === 0 && (
        <div style={{ padding: "64px 32px", textAlign: "center" }}>
          <p style={{ color: C.muted, fontSize: 15 }}>No encontramos platos que coincidan.</p>
          <button
            onClick={() => setQuery("")}
            style={{ marginTop: 12, fontSize: 14, color: C.gold, fontWeight: 600, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ══════ DISH CATEGORIES + CARDS ══════ */}
      {grouped.map(({ category, dishes: catDishes }) => (
        <section key={category.id} id={`esencial-cat-${category.id}`} style={{ padding: "0 18px 24px" }}>
          {/* category header */}
          <div style={{ padding: "20px 0 12px", marginLeft: 10, borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
            <div style={{
              fontSize: 13, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase",
              color: C.gold, marginBottom: 4,
            }}>
              {category.name}
            </div>
            {(category as any).description && (
              <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.4 }}>
                {(category as any).description}
              </p>
            )}
          </div>

          {/* dish cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {catDishes.map((dish) => {
              const isPopular = popularDishIds.has(dish.id);
              const isHighlight = isPopular || dish.tags?.includes("RECOMMENDED");
              return (
                <button
                  key={dish.id}
                  onClick={() => handleDishClick(dish)}
                  style={{
                    width: "100%",
                    padding: "16px 18px",
                    borderRadius: 26,
                    border: `1px solid ${isHighlight ? C.goldSoft : C.line}`,
                    background: isHighlight
                      ? (isDark ? `linear-gradient(135deg, ${C.cardBg} 0%, ${C.goldSoft} 100%)` : `linear-gradient(135deg, ${C.paper} 0%, ${C.goldSoft} 100%)`)
                      : C.cardBg,
                    boxShadow: isHighlight
                      ? `0 4px 16px rgba(184,137,53,0.12), 0 1px 3px rgba(0,0,0,0.04)`
                      : `0 1px 4px rgba(0,0,0,0.04)`,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    transition: "transform 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  {/* highlight badges */}
                  {(isHighlight || isPopular || (dish.discountPrice && dish.discountPrice < dish.price)) && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
                    }}>
                      {dish.discountPrice && dish.discountPrice < dish.price && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 50,
                          background: C.gold, color: C.paper,
                          fontSize: 10, fontWeight: 800,
                          letterSpacing: ".05em", textTransform: "uppercase",
                          fontFamily: "system-ui, sans-serif",
                        }}>
                          -{Math.round(((dish.price - dish.discountPrice) / dish.price) * 100)}% OFF
                        </span>
                      )}
                      {isHighlight && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 50,
                          background: C.tagPopularBg, border: `1px solid ${C.tagPopularBorder}`,
                          fontSize: 10, fontWeight: 800, color: C.tagPopularColor,
                          letterSpacing: ".05em", textTransform: "uppercase",
                          fontFamily: "system-ui, sans-serif",
                        }}>
                          ★ Destacado
                        </span>
                      )}
                      {isPopular && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 50,
                          background: isDark ? "rgba(251,146,60,0.12)" : "rgba(234,88,12,0.08)",
                          border: `1px solid ${isDark ? "rgba(251,146,60,0.25)" : "rgba(234,88,12,0.2)"}`,
                          fontSize: 10, fontWeight: 800, color: isDark ? "#fb923c" : "#c2410c",
                          letterSpacing: ".05em", textTransform: "uppercase",
                          fontFamily: "system-ui, sans-serif",
                        }}>
                          🔥 Popular
                        </span>
                      )}
                    </div>
                  )}
                  {/* name + price row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <span style={{
                      fontSize: 16, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase",
                      color: C.ink, lineHeight: 1.3, flex: 1, minWidth: 0,
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}>
                      {dish.name}
                    </span>
                    <span style={{
                      fontSize: 15, fontWeight: 500, color: C.ink, flexShrink: 0, whiteSpace: "nowrap",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}>
                      {dish.discountPrice && (
                        <span style={{ fontSize: 12, color: C.muted, textDecoration: "line-through", marginRight: 6 }}>
                          ${dish.price?.toLocaleString("es-CL")}
                        </span>
                      )}
                      ${(dish.discountPrice || dish.price)?.toLocaleString("es-CL") ?? "—"}
                    </span>
                  </div>

                  {/* description */}
                  {dish.description && (
                    <p style={{
                      fontSize: 17, color: C.desc, lineHeight: 1.45, margin: 0,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden",
                    }}>
                      {dish.description}
                    </p>
                  )}

                  {/* tags row */}
                  {(
                    (dish as any).dishDiet === "VEGAN" ||
                    (dish as any).dishDiet === "VEGETARIAN" ||
                    (dish as any).isSpicy ||
                    isPopular ||
                    (dish as any).isGlutenFree
                  ) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      {(dish as any).dishDiet === "VEGAN" && (
                        <span style={tagStyle(isDark ? "#86efac" : "#2d6a4f", isDark ? "rgba(134,239,172,0.1)" : "#d8f3dc")}>🌿 Vegano</span>
                      )}
                      {(dish as any).dishDiet === "VEGETARIAN" && (
                        <span style={tagStyle(isDark ? "#86efac" : "#2d6a4f", isDark ? "rgba(134,239,172,0.1)" : "#d8f3dc")}>🥬 Vegetariano</span>
                      )}
                      {(dish as any).isSpicy && (
                        <span style={tagStyle(isDark ? "#fca5a5" : "#9d0208", isDark ? "rgba(252,165,165,0.1)" : "#ffd6d6")}>🌶 Picante</span>
                      )}
                      {(dish as any).isGlutenFree && (
                        <span style={tagStyle(isDark ? "#fde68a" : "#5a4a00", isDark ? "rgba(253,230,138,0.1)" : "#fef3c7")}>🌾 Sin gluten</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* ══════ FOOTER ══════ */}
      <footer style={{ padding: "28px 24px 24px", textAlign: "center" }}>
        <a
          href="https://quierocomer.cl"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <span style={{ color: "rgba(117,107,95,0.6)", fontSize: 12 }}>Powered by</span>
          <span style={{ color: "rgba(21,36,27,0.5)", fontSize: 14, fontWeight: 700, fontFamily: "Georgia, 'Times New Roman', serif" }}>
            QuieroComer<span style={{ color: "rgba(184,137,53,0.6)" }}>.cl</span>
          </span>
        </a>
      </footer>

      {/* spacer for FAB */}
      <div style={{ height: 40 }} />

      {/* Force dark FAB on light background */}
      <style>{`
        .esencial-view [aria-label="Cambiar vista"] {
          background: rgba(255,255,255,0.55) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          border: 1px solid ${C.line} !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important;
          color: ${C.ink} !important;
        }
        .esencial-view [aria-label="Cambiar vista"] svg {
          color: ${C.ink} !important;
          stroke: ${C.ink} !important;
        }
      `}</style>

      {/* ══════ FAB: lamp (Genio) + views (demo) ══════ */}
      <FabSpeedDial
        onLampClick={() => setGenioOpen(true)}
        pinned={undefined}
      />

      {/* ══════ GENIO ONBOARDING MODAL ══════ */}
      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          qrUser={qrUser}
          restaurantDietType={(restaurant as any).dietType}
          onClose={() => { setGenioOpen(false); window.dispatchEvent(new Event("genio-closed")); }}
          onResult={(dish) => {
            setGenioOpen(false);
            setTimeout(() => setSelectedDish(dish), 250);
          }}
        />
      )}

      {/* ══════ DISH DETAIL MODAL ══════ */}
      {selectedDish && (
        <DishDetailEsencial
          dish={selectedDish}
          allDishes={allSorted}
          categories={categories}
          restaurantId={restaurant.id}
          ratingMap={ratingMap}
          onClose={() => setSelectedDish(null)}
          onChangeDish={(d) => setSelectedDish(d)}
          restaurantName={restaurant.name}
          popularDishIds={popularDishIds}
          isDark={isDark}
        />
      )}
    </div>
  );
}

/* ─── helpers ─── */

function tagStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    padding: "3px 8px",
    borderRadius: 50,
    fontFamily: "system-ui, -apple-system, sans-serif",
  };
}
