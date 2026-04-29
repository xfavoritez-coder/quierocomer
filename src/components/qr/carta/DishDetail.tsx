"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";
import FavoriteHeart from "./FavoriteHeart";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { trackDetailOpen, trackDetailClose, getDbSessionId } from "@/lib/sessionTracker";
import { useLang } from "@/contexts/LangContext";
import { getCrossSellDishes } from "./utils/getCrossSellDishes";

interface PersonalizationEntry {
  score: number;
  autoRecommended: boolean;
  reason: string | null;
  isExploration: boolean;
}

interface DishDetailProps {
  dish: Dish;
  allDishes: Dish[];
  categories: Category[];
  restaurantId: string;
  reviews: { id: string; dishId: string; rating: number; createdAt: Date }[];
  ratingMap: Record<string, { avg: number; count: number }>;
  onClose: () => void;
  onChangeDish: (dish: Dish) => void;
  personalizationMap?: Map<string, PersonalizationEntry> | null;
  restaurantName?: string;
  popularDishIds?: Set<string>;
  allPhotosReferential?: boolean;
}

export default function DishDetail({
  dish,
  allDishes,
  categories,
  restaurantId,
  ratingMap,
  onClose,
  onChangeDish,
  personalizationMap,
  restaurantName,
  popularDishIds,
}: DishDetailProps) {
  // Compute allergens that exist across the restaurant (for "Libre de" section)
  const restaurantAllergens = useMemo(() => {
    const allergens = new Set<string>();
    for (const d of allDishes) {
      const ings = (d as any).dishIngredients || [];
      for (const di of ings) {
        for (const a of (di.ingredient?.allergens || [])) {
          if (a.type === "ALLERGEN") allergens.add(a.name.toLowerCase());
        }
      }
    }
    return allergens;
  }, [allDishes]);

  const [visible, setVisible] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndex = allDishes.findIndex((d) => d.id === dish.id);
  const [activeIdx, setActiveIdx] = useState(currentIndex >= 0 ? currentIndex : 0);

  // Mount: lock body, scroll to initial dish
  useEffect(() => {
    // If body is already locked (e.g. by Genio), don't re-lock
    const alreadyLocked = document.body.style.overflow === "hidden";
    let savedScrollY = 0;
    if (!alreadyLocked) {
      savedScrollY = window.scrollY;
      // Freeze page in place using position:fixed — prevents iOS bar gap
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    }

    // Scroll to the selected dish instantly
    const el = scrollRef.current;
    if (el && currentIndex > 0) {
      el.scrollTo({ left: currentIndex * el.clientWidth, behavior: "instant" as any });
    }

    return () => {
      if (!alreadyLocked) {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [currentIndex]);


  // Track dish view stat on mount
  useEffect(() => {
    trackDetailOpen(dish.id);
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "DISH_VIEW", dishId: dish.id, restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
    }).catch(() => {});
    return () => { trackDetailClose(); };
  }, [dish.id, restaurantId]);

  // Observe which slide is active
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slides = el.querySelectorAll("[data-dish-slide]");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          const idx = parseInt((e.target as HTMLElement).dataset.dishSlide || "0");
          setActiveIdx(idx);
          const d = allDishes[idx];
          if (d && d.id !== dish.id) {
            trackDetailClose();
            trackDetailOpen(d.id);
            onChangeDish(d);
          }
        }
      });
    }, { root: el, threshold: [0.6] });
    slides.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [allDishes, dish.id, onChangeDish]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Swipe gestures removed — modal is scrollable, close button is sticky
  const handleTouchStart = undefined;
  const handleTouchMove = undefined;
  const handleTouchEnd = undefined;

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", inset: 0,
        zIndex: 120, background: "#000",
        opacity: visible ? 1 : 0, transition: "opacity 0.2s ease-out",
      }}
    >
      {/* Horizontal scroll container — native snap */}
      <div
        ref={scrollRef}
        style={{
          display: "flex", width: "100%", height: "100%",
          overflowX: "scroll", scrollSnapType: "x mandatory",
          scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {allDishes.map((d, idx) => (
          <DishSlide
            key={d.id}
            dish={d}
            index={idx}
            total={allDishes.length}
            categories={categories}
            restaurantId={restaurantId}
            ratingMap={ratingMap}
            isActive={idx === activeIdx}
            expandedDescs={expandedDescs}
            setExpandedDescs={setExpandedDescs}
            showInfo={showInfo && idx === activeIdx}
            setShowInfo={setShowInfo}
            onClose={close}
            personalizationEntry={personalizationMap?.get(d.id)}
            restaurantName={restaurantName}
            restaurantAllergens={restaurantAllergens}
            popularDishIds={popularDishIds}
            allDishes={allDishes}
            onChangeDish={onChangeDish}
          />
        ))}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @keyframes fadeToast { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ── Individual dish slide ── */
function DishSlide({
  dish, index, total, categories, restaurantId, ratingMap, isActive,
  expandedDescs, setExpandedDescs, showInfo, setShowInfo, onClose,
  personalizationEntry, restaurantName, restaurantAllergens, popularDishIds, allPhotosReferential,
  allDishes, onChangeDish,
}: {
  dish: Dish; index: number; total: number;
  categories: Category[]; restaurantId: string;
  ratingMap: Record<string, { avg: number; count: number }>;
  isActive: boolean;
  expandedDescs: Set<string>; setExpandedDescs: (fn: (s: Set<string>) => Set<string>) => void;
  showInfo: boolean; setShowInfo: (v: boolean) => void;
  onClose: () => void;
  personalizationEntry?: PersonalizationEntry;
  restaurantName?: string;
  restaurantAllergens?: Set<string>;
  popularDishIds?: Set<string>;
  allPhotosReferential?: boolean;
  allDishes: Dish[];
  onChangeDish: (dish: Dish) => void;
}) {
  const [showParaTiTooltip, setShowParaTiTooltip] = useState(false);
  const [showRecTooltip, setShowRecTooltip] = useState(false);
  const [showPopularTooltip, setShowPopularTooltip] = useState(false);
  const [showDietTooltip, setShowDietTooltip] = useState(false);
  const isRec = dish.tags?.includes("RECOMMENDED");

  // Memoize cross-sell so it doesn't reshuffle on every re-render
  const crossSell = useMemo(() => getCrossSellDishes(dish, allDishes, categories), [dish.id, allDishes, categories]);

  // Second-visit nudge: show tip near 👍 to educate about likes improving recommendations
  const [showLikeNudge, setShowLikeNudge] = useState(false);
  useEffect(() => {
    if (!isActive) return;
    const visited = localStorage.getItem(`qr_visited_${restaurantId}`);
    const nudgeShown = localStorage.getItem("qc_like_nudge_shown");
    const hasFavs = sessionStorage.getItem("qc_favorites_tip_seen");
    // Show on second+ visit, if never shown before and user hasn't given any likes yet
    if (visited && !nudgeShown && !hasFavs) {
      const timer = setTimeout(() => { setShowLikeNudge(true); localStorage.setItem("qc_like_nudge_shown", "1"); }, 1500);
      const hide = setTimeout(() => setShowLikeNudge(false), 6000);
      return () => { clearTimeout(timer); clearTimeout(hide); };
    }
  }, [isActive, restaurantId]);
  const photos = dish.photos?.length ? dish.photos : [];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => { setImgLoaded(false); }, [photoIndex]);
  const averageRating = ratingMap[dish.id];
  const categoryName = categories.find((c) => c.id === dish.categoryId)?.name;
  const desc = dish.description || "";
  const isLongDesc = desc.length > 120;
  const expandDesc = expandedDescs.has(dish.id);
  const discountPercent = dish.discountPrice && dish.price > 0 ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100) : null;
  // Derive allergens from ingredient → allergen chain
  const dishIngs = (dish as any).dishIngredients || [];
  const derivedAllergens: string[] = [];
  const seenAllergens = new Set<string>();
  for (const di of dishIngs) {
    for (const a of (di.ingredient?.allergens || [])) {
      if (a.type === "ALLERGEN" && !seenAllergens.has(a.name)) { seenAllergens.add(a.name); derivedAllergens.push(a.name); }
    }
  }
  // Pull-down to close when already at top
  const pullRef = useRef<{ y: number; scrollTop: number } | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const handlePullStart = (e: React.TouchEvent) => {
    const el = slideRef.current;
    if (el) pullRef.current = { y: e.touches[0].clientY, scrollTop: el.scrollTop };
  };
  const handlePullEnd = (e: React.TouchEvent) => {
    const p = pullRef.current;
    pullRef.current = null;
    if (!p) return;
    const dy = e.changedTouches[0].clientY - p.y;
    if (p.scrollTop <= 0 && dy > 80) onClose();
  };

  const lang = useLang();
  const ingredientNames = dishIngs.map((di: any) => {
    const ing = di.ingredient;
    if (!ing) return null;
    if (lang === "en" && ing.nameEn) return ing.nameEn;
    if (lang === "pt" && ing.namePt) return ing.namePt;
    return ing.name;
  }).filter(Boolean);
  const hasInfo = ingredientNames.length > 0 || derivedAllergens.length > 0;

  return (
    <div
      ref={slideRef}
      data-dish-slide={index}
      onTouchStart={handlePullStart}
      onTouchEnd={handlePullEnd}
      style={{
        flex: "0 0 100%", width: "100vw", minHeight: "100%", scrollSnapAlign: "start", scrollSnapStop: "always", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", background: "#000",
      }}
    >
      {/* Photo — sticky, stays at half height when scrolling down */}
      <div style={{ position: "sticky", top: "-25vh", width: "100%", height: "50vh", overflow: "hidden", zIndex: 0 }}>
        {photos.length > 0 && (
          <Image
            src={photos[photoIndex]}
            alt={dish.name}
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority={isActive}
            quality={80}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photos.length > 0 && (
          <img
            src={photos[photoIndex]}
            alt=""
            key={photos[photoIndex]}
            loading="eager"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
          />
        )}

        {/* Top gradient */}
        <div className="absolute pointer-events-none" style={{ top: 0, left: 0, right: 0, height: 100, zIndex: 8, background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.06) 50%, transparent 100%)" }} />

        {/* Photo dots */}
        {photos.length > 1 && (
          <div className="absolute flex" style={{ top: 16, left: "50%", transform: "translateX(-50%)", gap: 5, zIndex: 10 }}>
            {photos.map((_, i) => (
              <button key={i} onClick={() => setPhotoIndex(i)} style={{ width: 6, height: 6, borderRadius: "50%", background: i === photoIndex ? "white" : "rgba(255,255,255,0.4)", border: "none", padding: 0 }} />
            ))}
          </div>
        )}

        {/* Counter */}
        <div className="absolute" style={{ top: 16, left: 16, zIndex: 10 }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "1rem", fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{index + 1} / {total}</span>
        </div>

      </div>

      {/* Referential photo notice — between photo and content */}
      {photos.length > 0 && ((dish as any).isPhotoReferential || allPhotosReferential) && (
        <div style={{ position: "relative", zIndex: 1, background: "#000", textAlign: "right", padding: "4px 16px 0" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: 400, letterSpacing: "0.02em" }}>Imagen referencial</span>
        </div>
      )}

      {/* Content — flows below photo, black bg covers sticky photo */}
      {/* Close button — fixed, always visible */}
      <button onClick={onClose} className="flex items-center justify-center" style={{ position: "fixed", top: 16, right: 16, zIndex: 130, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "0.5px solid rgba(255,255,255,0.1)", color: "white", fontSize: "1rem" }}>✕</button>

      <div style={{ position: "relative", zIndex: 1, background: "#000", padding: "20px 20px 60px" }}>

        {/* "Recomendado" explanation toggle */}
        {showRecTooltip && isRec && (
          <div
            onClick={() => setShowRecTooltip(false)}
            style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(244,166,35,0.15)", border: "1px solid rgba(244,166,35,0.25)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "fadeToast 0.2s ease-out", cursor: "pointer" }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
              ⭐ {restaurantName || "El local"} recomienda este plato.
            </p>
          </div>
        )}

        {/* "Popular" explanation toggle */}
        {showPopularTooltip && popularDishIds?.has(dish.id) && (
          <div
            onClick={() => setShowPopularTooltip(false)}
            style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(244,166,35,0.15)", border: "1px solid rgba(244,166,35,0.25)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "fadeToast 0.2s ease-out", cursor: "pointer" }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
              🔥 Muy pedido hoy por los clientes.
            </p>
          </div>
        )}

        {/* BLOQUE 1: Header — name left + badges right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {categoryName && <span style={{ color: "#999", fontSize: "12.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4, display: "block" }}>{categoryName}</span>}
            <h2 style={{ fontSize: "32px", fontWeight: 800, color: "white", lineHeight: 1.1, margin: 0, letterSpacing: "-0.5px" }}>
              {dish.name}
            </h2>
            {/* Diet/spicy badges */}
            {((dish as any).dishDiet === "VEGAN" || (dish as any).dishDiet === "VEGETARIAN" || (dish as any).isSpicy) && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {(dish as any).dishDiet === "VEGAN" && (
                  <button onClick={() => { setShowDietTooltip(v => !v); setTimeout(() => setShowDietTooltip(false), 2000); }} style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: 50, border: "none", cursor: "pointer", background: "rgba(34,197,94,0.15)", color: "#4ade80", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    🌿 {showDietTooltip ? "Vegano" : "🌿"}
                  </button>
                )}
                {(dish as any).dishDiet === "VEGETARIAN" && (
                  <button onClick={() => { setShowDietTooltip(v => !v); setTimeout(() => setShowDietTooltip(false), 2000); }} style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: 50, border: "none", cursor: "pointer", background: "rgba(34,197,94,0.15)", color: "#4ade80", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    🥗 {showDietTooltip ? "Vegetariano" : "🥗"}
                  </button>
                )}
                {(dish as any).isSpicy && (
                  <button onClick={() => { setShowDietTooltip(v => !v); setTimeout(() => setShowDietTooltip(false), 2000); }} style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: 50, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.15)", color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    🌶️ {showDietTooltip ? "Picante" : "🌶️"}
                  </button>
                )}
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              {dish.discountPrice ? (
                <>
                  <span className="line-through" style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginRight: 6 }}>${dish.price.toLocaleString("es-CL")}</span>
                  <span style={{ color: "#fbbf24", fontSize: "17px", fontWeight: 500 }}>${dish.discountPrice.toLocaleString("es-CL")}</span>
                </>
              ) : (
                <span style={{ color: "#fbbf24", fontSize: "17px", fontWeight: 500 }}>${dish.price.toLocaleString("es-CL")}</span>
              )}
            </div>
          </div>
          {/* Badges */}
          {(isRec || popularDishIds?.has(dish.id)) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              {isRec && (
                <button
                  onClick={() => { if (showRecTooltip) { setShowRecTooltip(false); } else { setShowRecTooltip(true); setTimeout(() => setShowRecTooltip(false), 2000); } }}
                  style={{ background: "rgba(244,166,35,0.2)", border: "1px solid rgba(244,166,35,0.3)", color: "#fbbf24", fontSize: "0.85rem", fontWeight: 600, padding: "4px 12px", borderRadius: 50, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  ⭐ Recomendado
                </button>
              )}
              {popularDishIds?.has(dish.id) && (
                <button
                  onClick={() => { if (showPopularTooltip) { setShowPopularTooltip(false); } else { setShowPopularTooltip(true); setTimeout(() => setShowPopularTooltip(false), 2000); } }}
                  style={{ background: "rgba(244,166,35,0.2)", border: "1px solid rgba(244,166,35,0.3)", color: "#fbbf24", fontSize: "0.85rem", fontWeight: 600, padding: "4px 12px", borderRadius: 50, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  🔥 Popular hoy
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rating + Stock */}
        {(averageRating || (dish.stockCountdown != null && dish.stockCountdown > 0)) && (
          <div className="flex items-center" style={{ gap: 6, marginBottom: 10 }}>
            {averageRating && <span style={{ background: "rgba(255,255,255,0.1)", color: "white", fontSize: "0.68rem", fontWeight: 600, padding: "3px 10px", borderRadius: 50 }}>★ {averageRating.avg.toFixed(1)}</span>}
            {dish.stockCountdown != null && dish.stockCountdown > 0 && <span style={{ background: "rgba(255,255,255,0.1)", color: "white", fontSize: "0.68rem", fontWeight: 600, padding: "3px 10px", borderRadius: 50 }}>🔥 Quedan {dish.stockCountdown}</span>}
          </div>
        )}


        {/* BLOQUE 2: Description — full width */}
        {desc && (
          <p
            onClick={() => isLongDesc && setExpandedDescs((s) => { const n = new Set(s); if (n.has(dish.id)) n.delete(dish.id); else n.add(dish.id); return new Set(n); })}
            style={{ margin: 0, fontSize: "17px", color: "rgba(255,255,255,0.78)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: expandDesc ? 999 : 5, WebkitBoxOrient: "vertical", overflow: "hidden", width: "100%", cursor: isLongDesc ? "pointer" : "default" }}
          >{desc}</p>
        )}

        {/* Modifier options */}
        {(() => {
          const templates = (dish as any).modifierTemplates || [];
          const allGroups = templates.flatMap((t: any) => t.groups || []);
          if (allGroups.length === 0) return null;

          const hasRichOptions = allGroups.some((g: any) => g.options?.some((o: any) => o.imageUrl || o.description || o.priceAdjustment !== 0));

          if (hasRichOptions) {
            return (
              <div style={{ marginTop: 14 }}>
                {allGroups.map((g: any) => {
                  const hasRich = g.options?.some((o: any) => o.imageUrl || o.description || o.priceAdjustment !== 0);
                  if (!hasRich) {
                    return (
                      <p key={g.id} style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", margin: "0 0 4px" }}>
                        <span style={{ fontWeight: 600 }}>{g.name}:</span> {g.options?.map((o: any) => o.name).join(" · ")}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            );
          }

          return (
            <div style={{ marginTop: 14 }}>
              {allGroups.map((g: any) => (
                <p key={g.id} style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", margin: "0 0 4px" }}>
                  <span style={{ fontWeight: 600 }}>{g.name}:</span> {g.options?.map((o: any) => {
                    const price = o.priceAdjustment ? ` (+$${Math.abs(o.priceAdjustment).toLocaleString("es-CL")})` : "";
                    return o.name + price;
                  }).join(" · ")}
                </p>
              ))}
            </div>
          );
        })()}

        {/* BLOQUE 3: Link ingredientes */}
        {hasInfo && (
          <button onClick={() => setShowInfo(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 16, background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500, padding: "6px 14px", borderRadius: 50, cursor: "pointer" }}>
            Ver ingredientes
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        )}

        {/* Cross-sell suggestions */}
        {(() => {
          const { title, items: suggestions } = crossSell;
          if (suggestions.length === 0) return null;
          return (
            <div style={{ marginTop: 32 }}>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>{title}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {suggestions.map((s) => (
                  <div
                    key={s.dish.id}
                    onClick={() => onChangeDish(s.dish)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.06)", borderRadius: 16, cursor: "pointer" }}
                  >
                    {s.dish.photos?.[0] ? (
                      <img src={s.dish.photos[0]} alt={s.dish.name} style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.dish.name}</p>
                        {s.dish.tags?.includes("RECOMMENDED") && <span style={{ fontSize: "0.6rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "rgba(244,166,35,0.2)", color: "#fbbf24", flexShrink: 0 }}>⭐ Recomendado</span>}
                        {popularDishIds?.has(s.dish.id) && <span style={{ fontSize: "0.6rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#f87171", flexShrink: 0 }}>🔥 Popular hoy</span>}
                      </div>
                      {s.dish.description && (
                        <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.45)", margin: "4px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{s.dish.description}</p>
                      )}
                    </div>
                    <span style={{ fontSize: "0.94rem", color: "#fbbf24", fontWeight: 400, flexShrink: 0 }}>${s.dish.price.toLocaleString("es-CL")}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Ingredients panel */}
      {showInfo && (
        <>
          <div onClick={() => setShowInfo(false)} style={{ position: "fixed", inset: 0, zIndex: 119 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 120, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: 20, borderRadius: "16px 16px 0 0", animation: "slideUp 0.2s ease-out" }}>
            <button onClick={() => setShowInfo(false)} style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 28, height: 28, borderRadius: "50%", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            {ingredientNames.length > 0 && (
              <div style={{ marginBottom: 0 }}>
                <h4 style={{ color: "white", fontSize: "0.98rem", fontWeight: 700, marginBottom: 10 }}>Ingredientes</h4>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ingredientNames.map((i: string) => (
                    <span key={i} style={{ fontSize: "12.5px", padding: "6px 13px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "#d4d4d4" }}>{i}</span>
                  ))}
                </div>
              </div>
            )}
            {(() => {
              const d = dish as any;
              const traits: { label: string; positive: boolean }[] = [];
              // Allergen-free traits — only show for allergens the user has as restrictions
              const allergenLower = derivedAllergens.map(a => a.toLowerCase());
              // Get user restrictions from localStorage
              let userRestrictions: string[] = [];
              try { userRestrictions = JSON.parse(localStorage.getItem("qr_restrictions") || "[]").filter((r: string) => r !== "ninguna" && r !== "_spicy"); } catch {}
              for (const r of userRestrictions) {
                if (!allergenLower.includes(r.toLowerCase())) {
                  traits.push({ label: `Sin ${r}`, positive: true });
                }
              }
              // Diet
              if (d.dishDiet === "VEGAN") traits.push({ label: "Vegano", positive: true });
              else if (d.dishDiet === "VEGETARIAN") traits.push({ label: "Vegetariano", positive: true });
              // Spicy — only show when it IS spicy
              if (d.isSpicy) traits.push({ label: "Picante 🌶️", positive: false });
              if (traits.length === 0) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: "12px", color: "#888", fontWeight: 500, marginBottom: 10 }}>Características</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {traits.map(t => (
                      <span key={t.label} style={{ fontSize: "12.5px", padding: "6px 13px", borderRadius: 999, background: t.positive ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.07)", color: t.positive ? "#4ade80" : "#d4d4d4" }}>
                        {t.positive ? "✓ " : ""}{t.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
