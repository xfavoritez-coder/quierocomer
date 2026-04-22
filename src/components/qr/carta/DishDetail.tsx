"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";
import FavoriteHeart from "./FavoriteHeart";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { trackDishEnter, trackDishLeave } from "@/lib/sessionTracker";

interface DishDetailProps {
  dish: Dish;
  allDishes: Dish[];
  categories: Category[];
  restaurantId: string;
  reviews: { id: string; dishId: string; rating: number; createdAt: Date }[];
  ratingMap: Record<string, { avg: number; count: number }>;
  onClose: () => void;
  onChangeDish: (dish: Dish) => void;
}

export default function DishDetail({
  dish,
  allDishes,
  categories,
  restaurantId,
  ratingMap,
  onClose,
  onChangeDish,
}: DishDetailProps) {
  const [visible, setVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndex = allDishes.findIndex((d) => d.id === dish.id);
  const [activeIdx, setActiveIdx] = useState(currentIndex >= 0 ? currentIndex : 0);

  // Mount: lock body, scroll to initial dish
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    // If body is already locked (e.g. by Genio), don't re-lock
    const alreadyLocked = document.body.style.position === "fixed";
    if (!alreadyLocked) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${scrollY}px`;
    }

    // Scroll to the selected dish instantly
    const el = scrollRef.current;
    if (el && currentIndex > 0) {
      el.scrollTo({ left: currentIndex * el.clientWidth, behavior: "instant" as any });
    }

    return () => {
      if (!alreadyLocked) {
        const top = document.body.style.top;
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
        window.scrollTo(0, parseInt(top || "0") * -1);
      }
    };
  }, [currentIndex]);

  // Track dish view stat on mount
  useEffect(() => {
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "DISH_VIEW", dishId: dish.id, restaurantId, guestId: getGuestId(), sessionId: getSessionId() }),
    }).catch(() => {});
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
            trackDishLeave();
            trackDishEnter(d.id);
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

  // Swipe up/down to close
  const touchRef = useRef<{ y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchRef.current = { y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dy = touchRef.current.y - e.changedTouches[0].clientY;
    touchRef.current = null;
    if (Math.abs(dy) > 80) close();
  };

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
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
          />
        ))}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

/* ── Individual dish slide ── */
function DishSlide({
  dish, index, total, categories, restaurantId, ratingMap, isActive,
  expandedDescs, setExpandedDescs, showInfo, setShowInfo, onClose,
}: {
  dish: Dish; index: number; total: number;
  categories: Category[]; restaurantId: string;
  ratingMap: Record<string, { avg: number; count: number }>;
  isActive: boolean;
  expandedDescs: Set<string>; setExpandedDescs: (fn: (s: Set<string>) => Set<string>) => void;
  showInfo: boolean; setShowInfo: (v: boolean) => void;
  onClose: () => void;
}) {
  const photos = dish.photos?.length ? dish.photos : [];
  const [photoIndex, setPhotoIndex] = useState(0);
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
  const ingredientNames = dishIngs.map((di: any) => di.ingredient?.name).filter(Boolean);
  const hasInfo = ingredientNames.length > 0 || derivedAllergens.length > 0;

  return (
    <div
      data-dish-slide={index}
      style={{ flex: "0 0 100%", width: "100vw", height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always", position: "relative", overflow: "hidden" }}
    >
      {/* Photo */}
      {photos.length > 0 && (
        <Image src={photos[photoIndex]} alt={dish.name} fill className="object-cover object-center" sizes="100vw" priority={isActive} key={photos[photoIndex]} />
      )}

      {/* Top gradient */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: 0, right: 0, height: 100, zIndex: 8, background: "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)" }} />

      {/* Photo dots */}
      {photos.length > 1 && (
        <div className="absolute flex" style={{ top: 16, left: "50%", transform: "translateX(-50%)", gap: 5, zIndex: 10 }}>
          {photos.map((_, i) => (
            <button key={i} onClick={() => setPhotoIndex(i)} style={{ width: 6, height: 6, borderRadius: "50%", background: i === photoIndex ? "white" : "rgba(255,255,255,0.4)", border: "none", padding: 0 }} />
          ))}
        </div>
      )}

      {/* Top bar: counter + close only */}
      <div className="absolute flex items-center" style={{ top: 16, left: 16, right: 16, zIndex: 10 }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "1rem", fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{index + 1} / {total}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "0.5px solid rgba(255,255,255,0.1)", color: "white", fontSize: "1rem" }}>✕</button>
      </div>

      {/* Bottom gradient — 60% height */}
      <div className="absolute" style={{ bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.5) 65%, transparent 100%)", zIndex: 4 }} />

      {/* Content overlay */}
      <div className="absolute" style={{ bottom: 0, left: 0, right: 0, padding: "0 20px 40px", zIndex: 5 }}>

        {/* BLOQUE 1: Header — info left + heart right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {categoryName && <span style={{ color: "#999", fontSize: "10.5px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6, display: "block" }}>{categoryName}</span>}
            <h2 style={{ fontSize: "28px", fontWeight: 800, color: "white", lineHeight: 1.1, margin: 0, letterSpacing: "-0.5px" }}>
              {dish.tags?.includes("RECOMMENDED") && <span style={{ color: "#fbbf24", marginRight: 8 }}>★</span>}
              {dish.name}
            </h2>
            <div style={{ marginTop: 6 }}>
              {dish.discountPrice ? (
                <>
                  <span className="line-through" style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginRight: 6 }}>${dish.price.toLocaleString("es-CL")}</span>
                  <span style={{ color: "#fbbf24", fontSize: "16px", fontWeight: 500 }}>${dish.discountPrice.toLocaleString("es-CL")}</span>
                </>
              ) : (
                <span style={{ color: "#fbbf24", fontSize: "16px", fontWeight: 500 }}>${dish.price.toLocaleString("es-CL")}</span>
              )}
            </div>
          </div>
          <FavoriteHeart dishId={dish.id} restaurantId={dish.restaurantId} size={20} style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.95)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 20 }} />
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
          <p style={{ margin: 0, fontSize: "17px", color: "rgba(255,255,255,0.78)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: expandDesc ? 999 : 3, WebkitBoxOrient: "vertical", overflow: "hidden", width: "100%" }}>{desc}</p>
        )}
        {isLongDesc && !expandDesc && (
          <button onClick={() => setExpandedDescs((s) => { const n = new Set(s); n.add(dish.id); return n; })} style={{ display: "block", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", padding: 0, marginTop: 4, marginBottom: 4 }}>ver más</button>
        )}
        {isLongDesc && expandDesc && (
          <button onClick={() => setExpandedDescs((s) => { const n = new Set(s); n.delete(dish.id); return new Set(n); })} style={{ display: "block", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", padding: 0, marginTop: 4, marginBottom: 4 }}>ver menos</button>
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
          <button onClick={() => setShowInfo(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 14, background: "none", border: "none", borderBottom: "0.5px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.85)", fontSize: "13px", fontWeight: 500, padding: "0 0 2px", cursor: "pointer" }}>
            Ver ingredientes
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        )}
      </div>

      {/* Ingredients panel */}
      {showInfo && (
        <>
          <div onClick={() => setShowInfo(false)} className="absolute" style={{ inset: 0, zIndex: 19 }} />
          <div className="absolute" style={{ bottom: 0, left: 0, right: 0, zIndex: 20, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: 20, borderRadius: "16px 16px 0 0", animation: "slideUp 0.2s ease-out" }}>
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
            {derivedAllergens.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <p style={{ fontSize: "12px", color: "#888", fontWeight: 500, marginBottom: 10 }}>Contiene</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {derivedAllergens.map(a => (
                  <span key={a} style={{ fontSize: "12.5px", padding: "6px 13px", borderRadius: 999, background: "rgba(234,179,8,0.12)", color: "#fbbf24" }}>⚠️ {a}</span>
                ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
