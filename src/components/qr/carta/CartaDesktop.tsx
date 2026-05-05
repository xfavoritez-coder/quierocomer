"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import { Globe } from "lucide-react";
import type { Restaurant, Category, Dish } from "@prisma/client";
import type { Lang } from "@/lib/qr/i18n";
import { SUPPORTED_LANGS, LANG_FLAGS } from "@/lib/qr/i18n";
import { norm } from "@/lib/normalize";
import { getDishPhoto, groupDishesByCategory } from "./utils/dishHelpers";
import { setMesaToken, hasMesaToken } from "@/lib/mesaToken";
import SortChip from "./SortChip";
import { useCartaSort, applyCartaSort } from "./hooks/useCartaSort";
import { startSession, trackDetailOpen, trackDetailClose, trackCategoryDwell, setCartaLang } from "@/lib/sessionTracker";
import WaiterButton from "../garzon/WaiterButton";
import GenioOnboarding from "../genio/GenioOnboarding";
import GenioFab from "./GenioFab";
import PromoCarousel from "../capture/PromoCarousel";
import GenioVeganCarousel from "./GenioVeganCarousel";
import GenioVegetarianCarousel from "./GenioVegetarianCarousel";
import GenioGlutenFreeCarousel from "./GenioGlutenFreeCarousel";
import GenioLactoseFreeCarousel from "./GenioLactoseFreeCarousel";
import GenioSoyFreeCarousel from "./GenioSoyFreeCarousel";
import GenioNutsCarousel from "./GenioNutsCarousel";
import GenioSmartCarousel from "./GenioSmartCarousel";
import { getCarouselMode, getCarouselScrollId, getCarouselNavName, hasMatchingDishes, getDietMessage } from "@/lib/qr/utils/carouselMode";
import GenioDietMessage from "./GenioDietMessage";

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  popularDishIds?: Set<string>;
  tableId?: string;
  isQrScan?: boolean;
  lang?: Lang;
  marketingPromos?: any[];
}

const LANG_STORAGE_KEY = "qc_lang";

export default function CartaDesktop({ restaurant, categories, dishes, popularDishIds, tableId, isQrScan, lang: initialLang, marketingPromos }: Props) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [hasCompletedGenio, setHasCompletedGenio] = useState(false);

  const dietNavItem = useMemo(() => {
    if (typeof window === "undefined") return null;
    const diet = localStorage.getItem("qr_diet");
    const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
    const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
    if (!mode) return null;
    if (!hasMatchingDishes(dishes, categories, mode, diet, restrictions.filter((r: string) => r !== "ninguna"))) return null;
    return { id: "diet-carousel", name: getCarouselNavName(mode), scrollTo: getCarouselScrollId(mode) };
  }, [restaurant, hasCompletedGenio, dishes, categories]);

  const [query, setQuery] = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const { sortKey, setSortKey, rankings } = useCartaSort(restaurant.id, "desktop");
  const [genioOpen, setGenioOpen] = useState(false);
  const [modalImgLoaded, setModalImgLoaded] = useState(false);
  useEffect(() => { setModalImgLoaded(false); }, [selectedDish?.id]);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lang = initialLang || "es";
  const [optimisticLang, setOptimisticLang] = useState<Lang | null>(null);
  const activeLang = optimisticLang || lang;

  // Waiter visibility
  const waiterEnabled = (restaurant as any).waiterPanelActive !== false;
  const [showWaiter, setShowWaiter] = useState(false);
  useEffect(() => {
    if (!waiterEnabled) { setShowWaiter(false); return; }
    if (tableId) {
      const params = new URLSearchParams(window.location.search);
      const isDemo = params.get("demo") === "true";
      setMesaToken(restaurant.id, tableId, isDemo);
      setShowWaiter(true);
    } else if (isQrScan) {
      setShowWaiter(true);
    } else {
      setShowWaiter(hasMesaToken(restaurant.id));
    }
  }, [restaurant.id, tableId, isQrScan, waiterEnabled]);

  // Start session tracking (same as CartaRouter does for mobile)
  useEffect(() => {
    startSession(restaurant.id, tableId, !!isQrScan);
    setCartaLang(lang);
  }, [restaurant.id, tableId, isQrScan, lang]);

  // Track category dwell time
  const lastCatRef = useRef<{ id: string; start: number }>({ id: activeCategory, start: Date.now() });
  useEffect(() => {
    const prev = lastCatRef.current;
    if (prev.id && prev.id !== activeCategory) {
      const dwell = Date.now() - prev.start;
      if (dwell > 1000) trackCategoryDwell(prev.id, dwell);
    }
    lastCatRef.current = { id: activeCategory, start: Date.now() };
  }, [activeCategory]);

  // Track dish detail open/close
  useEffect(() => {
    if (selectedDish) {
      trackDetailOpen(selectedDish.id);
      return () => { trackDetailClose(); };
    }
  }, [selectedDish?.id]);

  // Check if genio was completed
  useEffect(() => {
    const check = () => setHasCompletedGenio(!!localStorage.getItem("qr_diet"));
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

  // Close lang dropdown on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handle = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [langOpen]);

  const handleLangChange = useCallback((next: Lang) => {
    if (next === lang && !optimisticLang) return;
    setOptimisticLang(next);
    setLangOpen(false);
    localStorage.setItem(LANG_STORAGE_KEY, next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [lang, optimisticLang, pathname, router, searchParams]);

  useEffect(() => { setOptimisticLang(null); }, [lang]);

  const filtered = useMemo(() => {
    if (!query) return dishes;
    const q = norm(query.trim());
    return dishes.filter(d => norm(d.name || "").includes(q) || norm(d.description || "").includes(q));
  }, [dishes, query]);

  const grouped = useMemo(() => {
    const base = groupDishesByCategory(filtered, categories);
    if (sortKey === "default") return base;
    return base.map((g) => ({ ...g, dishes: applyCartaSort(g.dishes, sortKey, rankings) }));
  }, [filtered, categories, sortKey, rankings]);

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById(`desktop-cat-${catId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", fontFamily: "var(--font-dm)" }}>
      {/* Header */}
      <header style={{ background: "white", borderBottom: "1px solid #e8e4dc", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          {/* Top row: logo + name + search */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0" }}>
            {restaurant.logoUrl ? (
              <Image src={restaurant.logoUrl} alt="" width={40} height={40} className="rounded-full" style={{ border: "1px solid #e8e4dc" }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 700, color: "white" }}>
                {restaurant.name.charAt(0)}
              </div>
            )}
            <h1 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a", flex: 1 }}>
              {restaurant.name}
            </h1>
            {/* Search */}
            <div style={{ position: "relative", width: 260 }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en el menú..."
                style={{
                  width: "100%", padding: "10px 14px 10px 38px", borderRadius: 10,
                  border: "1px solid #e0dcd4", background: "#faf9f6", fontSize: "0.88rem",
                  color: "#333", outline: "none",
                }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <SortChip sortKey={sortKey} setSortKey={setSortKey} salesMode={rankings?.sales?.mode || null} />
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin", scrollbarColor: "#ccc transparent" }}>
            {dietNavItem && (
              <button
                onClick={() => { setActiveCategory("diet-carousel"); const el = document.getElementById(dietNavItem.scrollTo); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap",
                  background: activeCategory === "diet-carousel" ? "#1a1a1a" : "transparent",
                  color: activeCategory === "diet-carousel" ? "white" : "#888",
                  transition: "all 0.15s",
                }}
              >
                {dietNavItem.name}
              </button>
            )}
            {categories.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap",
                    background: isActive ? "#1a1a1a" : "transparent",
                    color: isActive ? "white" : "#888",
                    transition: "all 0.15s",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={contentRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 40px 80px" }}>
        {/* Promos banner */}
        {marketingPromos && marketingPromos.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <PromoCarousel restaurantId={restaurant.id} initialPromos={marketingPromos} onViewDish={(dishId) => {
              const dish = dishes.find(d => d.id === dishId);
              if (dish) setSelectedDish(dish);
            }} />
          </div>
        )}

        {/* Diet carousels */}
        {typeof window !== "undefined" && (() => {
          const diet = localStorage.getItem("qr_diet");
          const restrictions = (() => { try { return JSON.parse(localStorage.getItem("qr_restrictions") || "[]"); } catch { return []; } })();
          const mode = getCarouselMode(diet, restrictions, (restaurant as any).dietType);
          const onDishClick = (dishId: string) => { const dish = dishes.find(d => d.id === dishId); if (dish) setSelectedDish(dish); };
          const activeRestrictions = restrictions.filter((r: string) => r !== "ninguna");
          const msgType = !mode || !hasMatchingDishes(dishes, categories, mode, diet, activeRestrictions) ? getDietMessage(diet, restrictions, (restaurant as any).dietType, dishes, categories) : null;
          if (msgType) return <div style={{ marginBottom: 32 }}><GenioDietMessage type={msgType} diet={diet} restrictions={activeRestrictions} /></div>;
          if (!mode) return null;
          return (
            <div style={{ marginBottom: 32, display: "flex", flexDirection: "column", gap: 8 }}>
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

        {grouped.map(group => {
          if (group.dishes.length === 0) return null;
          return (
            <section key={group.category.id} id={`desktop-cat-${group.category.id}`} style={{ marginBottom: 48 }}>
              <h2 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 20, paddingBottom: 10, borderBottom: "2px solid #e8e4dc" }}>
                {group.category.name}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                {group.dishes.map(dish => (
                  <DesktopDishCard
                    key={dish.id}
                    dish={dish}
                    isPopular={popularDishIds?.has(dish.id)}
                    onClick={() => setSelectedDish(dish)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && query && (
          <p style={{ textAlign: "center", color: "#999", fontSize: "1rem", padding: 60 }}>
            No se encontraron resultados para &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Dish detail modal */}
      {selectedDish && (
        <div
          onClick={() => setSelectedDish(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, maxWidth: 520, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
          >
            {/* Photo + close button + badges */}
            <div style={{
              aspectRatio: selectedDish.photos?.[0] ? "4 / 3" : undefined,
              height: selectedDish.photos?.[0] ? undefined : 160,
              position: "relative", overflow: "hidden", borderRadius: "20px 20px 0 0",
              background: "linear-gradient(135deg, #f5f0e8 0%, #e8e0d0 100%)",
              display: selectedDish.photos?.[0] ? undefined : "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              {!selectedDish.photos?.[0] && <span style={{ fontSize: "2.5rem", opacity: 0.2 }}>🍽</span>}
              {/* Layer 1: Next.js optimized — instant from cache */}
              {selectedDish.photos?.[0] && (
                <Image
                  src={selectedDish.photos[0]}
                  alt={selectedDish.name}
                  fill
                  className="object-cover"
                  sizes="520px"
                />
              )}
              {/* Layer 2: raw original — fades in when loaded */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {selectedDish.photos?.[0] && (
                <img
                  src={selectedDish.photos[0]}
                  alt=""
                  loading="eager"
                  decoding="async"
                  onLoad={() => setModalImgLoaded(true)}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: modalImgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
                />
              )}
              {/* Close X */}
              <button
                onClick={() => setSelectedDish(null)}
                style={{
                  position: "absolute", top: 12, right: 12, width: 36, height: 36,
                  borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: "18px", fontWeight: 300, lineHeight: 1, zIndex: 2,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; }}
              >
                ✕
              </button>
              {/* Badges on photo */}
              <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, zIndex: 1 }}>
                {selectedDish.tags?.includes("NEW") && <span style={{ fontSize: "11px", fontWeight: 700, color: "white", background: "#e85530", padding: "4px 10px", borderRadius: 50, letterSpacing: "0.05em" }}>NUEVO</span>}
                {popularDishIds?.has(selectedDish.id) && <span style={{ fontSize: "11px", fontWeight: 600, color: "white", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "4px 10px", borderRadius: 50 }}>🔥 Popular</span>}
                {selectedDish.tags?.includes("RECOMMENDED") && <span style={{ fontSize: "11px", fontWeight: 600, color: "white", background: "rgba(244,166,35,0.85)", padding: "4px 10px", borderRadius: 50 }}>⭐ Recomendado</span>}
              </div>
              {/* Diet badges bottom-right */}
              <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", gap: 5 }}>
                {(selectedDish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "12px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 6, color: "white" }}>🌿</span>}
                {(selectedDish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "12px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 6, color: "white" }}>🥗</span>}
                {(selectedDish as any).isSpicy && <span style={{ fontSize: "12px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 6, color: "white" }}>🌶️</span>}
              </div>
            </div>
            <div style={{ padding: "24px 28px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a", flex: 1 }}>
                  {selectedDish.name}
                </h3>
                <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.3rem", fontWeight: 600, color: "#F4A623", flexShrink: 0, marginLeft: 16 }}>
                  ${(selectedDish.discountPrice || selectedDish.price)?.toLocaleString("es-CL")}
                </span>
              </div>
              {selectedDish.description && (
                <p style={{ fontSize: "1rem", color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
                  {selectedDish.description}
                </p>
              )}
              {/* Diet labels below description */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(selectedDish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "0.82rem", padding: "4px 12px", borderRadius: 50, background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>🌿 Vegano</span>}
                {(selectedDish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "0.82rem", padding: "4px 12px", borderRadius: 50, background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>🥗 Vegetariano</span>}
                {(selectedDish as any).isSpicy && <span style={{ fontSize: "0.82rem", padding: "4px 12px", borderRadius: 50, background: "rgba(232,85,48,0.1)", color: "#e85530" }}>🌶️ Picante</span>}
              </div>

              {/* Modifier groups & options (todos los grupos del template, ordenados por position) */}
              {(() => {
                const templates = (selectedDish as any).modifierTemplates || [];
                const allGroups = templates.flatMap((t: any) => t.groups || []);
                if (allGroups.length === 0) return null;
                return (
                  <div style={{ marginTop: 24 }}>
                    {allGroups.map((g: any) => {
                      const options = g.options || [];
                      if (options.length === 0) return null;
                      return (
                        <div key={g.id} style={{ marginBottom: 18 }}>
                          <p style={{ color: "#888", fontSize: "0.78rem", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{g.name}</p>
                          <div>
                            {options.map((opt: any, i: number) => (
                              <div key={opt.id} style={{ padding: "10px 0", borderBottom: i < options.length - 1 ? "1px solid #eee" : "none" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {opt.imageUrl && (
                                    <img src={opt.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                  )}
                                  <span style={{ color: "#333", fontSize: "0.95rem", fontWeight: 600, flex: 1 }}>{opt.name}</span>
                                  {opt.priceAdjustment !== 0 && (
                                    <span style={{ color: "#999", fontSize: "0.88rem", fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>
                                      {opt.priceAdjustment > 0 ? "+" : "-"}${Math.abs(opt.priceAdjustment).toLocaleString("es-CL")}
                                    </span>
                                  )}
                                </div>
                                {opt.description && (
                                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "4px 0 0", lineHeight: 1.4 }}>{opt.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Floating buttons — bottom right */}
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <GenioFab hasCompletedGenio={hasCompletedGenio} onOpen={() => setGenioOpen(true)} />

        {/* Waiter button */}
        {showWaiter && (
          <WaiterButton
            restaurantId={restaurant.id}
            tableId={tableId || undefined}
            waiterPanelActive={showWaiter}
            size={48}
          />
        )}

        {/* Language selector — hidden for FREE plan */}
        {(restaurant as any).plan !== "FREE" && <div ref={langRef} style={{ position: "relative" }}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            title="Cambiar idioma"
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: langOpen ? "rgba(244,166,35,0.15)" : "white",
              border: langOpen ? "1px solid rgba(244,166,35,0.4)" : "1px solid #e0dcd4",
              cursor: "pointer",
              boxShadow: langOpen ? "0 0 12px rgba(244,166,35,0.2)" : "0 2px 10px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!langOpen) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)"; }}
            onMouseLeave={e => { if (!langOpen) e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)"; }}
          >
            <Globe size={20} color={langOpen ? "#F4A623" : "#666"} strokeWidth={1.75} />
          </button>

          {/* Language dropdown — opens to the left */}
          {langOpen && (
            <div style={{
              position: "absolute", right: 58, top: "50%", transform: "translateY(-50%)",
              display: "flex", alignItems: "center", gap: 4,
              background: "white", borderRadius: 50,
              padding: "4px 6px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              border: "1px solid #e8e4dc",
              animation: "dkLangSlide 0.2s ease-out",
              whiteSpace: "nowrap",
            }}>
              {(((restaurant as any).enabledLangs?.length ? SUPPORTED_LANGS.filter(l => (restaurant as any).enabledLangs.includes(l)) : SUPPORTED_LANGS)).map((l) => {
                const isActive = activeLang === l;
                return (
                  <button
                    key={l}
                    onClick={() => handleLangChange(l)}
                    style={{
                      padding: "7px 14px", borderRadius: 50,
                      border: "none", cursor: "pointer",
                      fontSize: "0.78rem", fontWeight: 700,
                      letterSpacing: "0.04em",
                      transition: "all 0.15s",
                      background: isActive ? "#F4A623" : "transparent",
                      color: isActive ? "white" : "#888",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f5f3ef"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    {LANG_FLAGS[l]}
                  </button>
                );
              })}
              {/* Arrow pointing right */}
              <div style={{
                position: "absolute", right: -5, top: "50%",
                transform: "translateY(-50%) rotate(45deg)",
                width: 10, height: 10,
                background: "white",
                border: "1px solid #e8e4dc",
                borderLeft: "none", borderBottom: "none",
              }} />
            </div>
          )}
        </div>}
      </div>

      {/* Genio modal */}
      {genioOpen && (
        <GenioOnboarding
          restaurantId={restaurant.id}
          dishes={dishes}
          categories={categories}
          restaurantDietType={(restaurant as any).dietType}
          onClose={() => { setGenioOpen(false); setHasCompletedGenio(!!localStorage.getItem("qr_diet")); }}
          onResult={(dish) => {
            setGenioOpen(false);
            setHasCompletedGenio(true);
            setTimeout(() => {
              const el = document.getElementById(`desktop-cat-${(dish as any).categoryId}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              setTimeout(() => setSelectedDish(dish), 400);
            }, 200);
          }}
        />
      )}

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "20px 0 30px" }}>
        <span style={{ fontSize: "0.78rem", color: "#bbb" }}>Powered by </span>
        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "0.85rem", color: "#999", fontWeight: 700 }}>
          QuieroComer<span style={{ color: "#F4A623" }}>.cl</span>
        </span>
      </footer>

      <style>{`
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @keyframes dkLangSlide {
          from { opacity: 0; transform: translateY(-50%) translateX(8px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>
    </div>
  );
}

function DesktopDishCard({ dish, isPopular, onClick }: { dish: Dish; isPopular?: boolean; onClick: () => void }) {
  const photo = getDishPhoto(dish);
  const isNew = dish.tags?.includes("NEW");
  const isRec = dish.tags?.includes("RECOMMENDED");

  return (
    <div
      onClick={onClick}
      role="button"
      style={{
        background: "white", borderRadius: 14, overflow: "hidden",
        cursor: "pointer", textAlign: "left" as const, transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: isRec ? "0 0 0 2px rgba(244,166,35,0.3), 0 1px 3px rgba(0,0,0,0.04)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
    >
      {/* Photo */}
      <div style={photo
        ? { height: 180, backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }
        : { height: 180, background: "linear-gradient(135deg, #f5f0e8 0%, #e8e0d0 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, position: "relative" }
      }>
        {!photo && <>
          <span style={{ fontSize: "2rem", opacity: 0.3 }}>🍽</span>
          <span style={{ fontSize: "0.7rem", color: "#bbb", fontWeight: 500 }}>{dish.name}</span>
        </>}
        {/* Badges on photo */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          {isNew && <span style={{ fontSize: "10px", fontWeight: 700, color: "white", background: "#e85530", padding: "3px 8px", borderRadius: 50, letterSpacing: "0.05em" }}>NUEVO</span>}
          {isPopular && <span style={{ fontSize: "10px", fontWeight: 600, color: "white", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: 50 }}>🔥 Popular</span>}
          {isRec && <span style={{ fontSize: "10px", fontWeight: 600, color: "white", background: "rgba(244,166,35,0.85)", padding: "3px 8px", borderRadius: 50 }}>⭐ Recomendado</span>}
        </div>
        {/* Diet badges */}
        <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
          {(dish as any).dishDiet === "VEGAN" && <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 4, color: "white" }}>🌿</span>}
          {(dish as any).dishDiet === "VEGETARIAN" && <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 4, color: "white" }}>🥗</span>}
          {(dish as any).isSpicy && <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: 4, color: "white" }}>🌶️</span>}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 16px" }}>
        <h3 className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.05rem", fontWeight: 600, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.3 }}>
          {dish.name}
        </h3>
        {dish.description && (
          <p style={{
            fontSize: "0.85rem", color: "#888", lineHeight: 1.4, marginBottom: 8,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {dish.description}
          </p>
        )}
        <span className="font-[family-name:var(--font-playfair)]" style={{ fontSize: "1.1rem", fontWeight: 600, color: dish.discountPrice ? "#F4A623" : "#1a1a1a" }}>
          ${(dish.discountPrice || dish.price)?.toLocaleString("es-CL")}
        </span>
        {dish.discountPrice && (
          <span style={{ fontSize: "0.82rem", color: "#bbb", textDecoration: "line-through", marginLeft: 8 }}>
            ${dish.price?.toLocaleString("es-CL")}
          </span>
        )}
      </div>
    </div>
  );
}
