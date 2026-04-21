"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import type { Dish, Category } from "@prisma/client";

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

import { getGuestId, getSessionId } from "@/lib/guestId";
import { trackDishEnter, trackDishLeave } from "@/lib/sessionTracker";

export default function DishDetail({
  dish,
  allDishes,
  categories,
  restaurantId,
  ratingMap,
  onClose,
  onChangeDish,
}: DishDetailProps) {
  const averageRating = ratingMap[dish.id];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);

  // Transition state
  const [slideOut, setSlideOut] = useState<"left" | "right" | null>(null);
  const [slideIn, setSlideIn] = useState(false);

  const photos = dish.photos?.length ? dish.photos : [];
  const isRecommended = dish.tags?.includes("RECOMMENDED");
  const categoryName = categories.find((c) => c.id === dish.categoryId)?.name;
  const discountPercent =
    dish.discountPrice && dish.price > 0
      ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100)
      : null;
  const hasInfo = !!(dish.ingredients || dish.allergens);
  const desc = dish.description || "";
  const isLongDesc = desc.length > 120;

  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const currentIndex = allDishes.findIndex((d) => d.id === dish.id);
  const hasNext = currentIndex < allDishes.length - 1;
  const hasPrev = currentIndex > 0;

  // When dish changes, slide in from the correct side
  const prevDishRef = useRef(dish.id);
  useEffect(() => {
    if (prevDishRef.current !== dish.id) {
      setPhotoIndex(0);
      setExpandDesc(false);
      setShowInfo(false);
      setSlideIn(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(false)));
      prevDishRef.current = dish.id;
    }
  }, [dish.id]);

  useEffect(() => {
    trackDishEnter(dish.id);
    return () => { trackDishLeave(); };
  }, [dish.id]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "DISH_VIEW",
        dishId: dish.id,
        restaurantId,
        guestId: getGuestId(),
        sessionId: getSessionId(),
      }),
    }).catch(() => {});
    return () => {
      const top = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(top || "0") * -1);
    };
  }, [dish.id, restaurantId]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const slideRef = useRef<"left" | "right">("left");

  const goNext = useCallback(() => {
    if (!hasNext) return;
    slideRef.current = "left";
    setSlideOut("left");
    setTimeout(() => {
      setSlideOut(null);
      onChangeDish(allDishes[currentIndex + 1]);
    }, 250);
  }, [hasNext, currentIndex, allDishes, onChangeDish]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    slideRef.current = "right";
    setSlideOut("right");
    setTimeout(() => {
      setSlideOut(null);
      onChangeDish(allDishes[currentIndex - 1]);
    }, 250);
  }, [hasPrev, currentIndex, allDishes, onChangeDish]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = touchRef.current.x - e.changedTouches[0].clientX;
    const dy = touchRef.current.y - e.changedTouches[0].clientY;
    touchRef.current = null;

    // Swipe up or down to close
    if (Math.abs(dy) > 50 && Math.abs(dx) < 50) {
      close();
      return;
    }

    // Swipe horizontal to change dish
    if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
      if (dx > 0) goNext();
      else goPrev();
    }
  };

  // Position counter
  const posText = `${currentIndex + 1} / ${allDishes.length}`;

  // Compute transform + opacity for smooth native-feeling transitions
  const getTransform = () => {
    if (slideOut === "left") return "translateX(-40%) scale(0.95)";
    if (slideOut === "right") return "translateX(40%) scale(0.95)";
    if (slideIn) return slideRef.current === "left" ? "translateX(40%) scale(0.95)" : "translateX(-40%) scale(0.95)";
    return "translateX(0) scale(1)";
  };
  const getOpacity = () => (slideOut || slideIn) ? 0 : 1;

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        height: "100dvh",
        zIndex: 100,
        background: "#000",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease-out",
        overflow: "hidden",
      }}
    >
      {/* Content wrapper with slide transition */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: getTransform(),
          opacity: getOpacity(),
          transition: slideIn ? "none" : "transform 0.25s ease-out, opacity 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Fullscreen photo */}
        {photos.length > 0 && (
          <Image
            src={photos[photoIndex]}
            alt={dish.name}
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
            key={photos[photoIndex]}
          />
        )}

        {/* Top gradient for legibility */}
        <div className="absolute pointer-events-none" style={{ top: 0, left: 0, right: 0, height: 100, zIndex: 8, background: "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)" }} />

        {/* Photo dots — top center */}
        {photos.length > 1 && (
          <div
            className="absolute flex"
            style={{ top: 16, left: "50%", transform: "translateX(-50%)", gap: 5, zIndex: 10 }}
          >
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIndex(i)}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === photoIndex ? "white" : "rgba(255,255,255,0.4)",
                  border: "none", padding: 0, transition: "background 0.2s",
                }}
              />
            ))}
          </div>
        )}

        {/* Close button — top right */}
        <button
          onClick={close}
          className="absolute flex items-center justify-center"
          style={{
            top: 16, right: 16, width: 36, height: 36, borderRadius: "50%",
            background: "rgba(0,0,0,0.2)",
            color: "white", fontSize: "1.1rem", border: "none", zIndex: 10,
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          ✕
        </button>

        {/* Position counter — top left */}
        <div
          className="absolute"
          style={{
            top: 20, left: 16,
            color: "rgba(255,255,255,0.7)", fontSize: "1rem", fontWeight: 500, zIndex: 10,
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {posText}
        </div>


        {/* Info overlay — bottom */}
        <div
          className="absolute"
          style={{
            bottom: 0, left: 0, right: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.2) 70%, transparent 100%)",
            padding: "80px 20px 40px", zIndex: 5,
          }}
        >
          {/* Badges row */}
          <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
            {isRecommended && (
              <span style={{
                background: "rgba(0,0,0,0.6)", color: "white",
                border: "none", fontSize: "0.78rem",
                fontWeight: 700, padding: "5px 14px", borderRadius: 50,
                backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
              }}>
                ⭐ Recomendado
              </span>
            )}
            {averageRating && (
              <span style={{
                background: "rgba(255,255,255,0.12)", color: "white",
                fontSize: "0.7rem", fontWeight: 600, padding: "3px 10px", borderRadius: 50,
              }}>
                ★ {averageRating.avg.toFixed(1)}
              </span>
            )}
            {dish.stockCountdown != null && dish.stockCountdown > 0 && (
              <span style={{
                background: "rgba(255,255,255,0.12)", color: "white",
                fontSize: "0.7rem", fontWeight: 600, padding: "3px 10px", borderRadius: 50,
              }}>
                🔥 Quedan {dish.stockCountdown}
              </span>
            )}
          </div>

          {/* Category label */}
          {categoryName && (
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, display: "block" }}>
              {categoryName}
            </span>
          )}

          {/* Name */}
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "white", lineHeight: 1.2, margin: 0 }}>
            {dish.name}
          </h2>

          {/* Price */}
          <div className="flex items-center" style={{ marginTop: 6, gap: 8 }}>
            {dish.discountPrice ? (
              <>
                <span className="line-through" style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem" }}>
                  ${dish.price.toLocaleString("es-CL")}
                </span>
                <span style={{ color: isRecommended ? "#F4A623" : "white", fontSize: "1.2rem", fontWeight: 400 }}>
                  ${dish.discountPrice.toLocaleString("es-CL")}
                </span>
                {discountPercent && (
                  <span style={{ background: "#F4A623", color: "#0e0e0e", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>
                    -{discountPercent}%
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: isRecommended ? "#F4A623" : "white", fontSize: "1.2rem", fontWeight: 400 }}>
                ${dish.price.toLocaleString("es-CL")}
              </span>
            )}
          </div>

          {/* Description */}
          {desc && (
            <p style={{
              marginTop: 10, fontSize: "1.05rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.75,
              display: "-webkit-box", WebkitLineClamp: expandDesc ? 999 : 3,
              WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {desc}
            </p>
          )}
          {isLongDesc && !expandDesc && (
            <button onClick={() => setExpandDesc(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", padding: 0, marginTop: 2 }}>
              ver más
            </button>
          )}

          {/* Ingredients/allergens button */}
          {hasInfo && (
            <button onClick={() => setShowInfo(true)} style={{
              marginTop: 12, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)", color: "white", fontSize: "0.92rem", fontWeight: 500,
              padding: "8px 16px", borderRadius: 6, border: "none",
            }}>
              Ver ingredientes ▾
            </button>
          )}
        </div>
      </div>

      {/* Ingredients/allergens panel */}
      {showInfo && (
        <>
        <div onClick={() => setShowInfo(false)} className="absolute" style={{ inset: 0, zIndex: 19 }} />
        <div
          className="absolute"
          style={{
            bottom: 0, left: 0, right: 0, zIndex: 20,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)", padding: 20,
            borderRadius: "16px 16px 0 0", animation: "slideUp 0.2s ease-out",
          }}
        >
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
          <button onClick={() => setShowInfo(false)} style={{
            position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.15)",
            border: "none", color: "white", width: 28, height: 28, borderRadius: "50%",
            fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            ✕
          </button>
          {dish.ingredients && (
            <div style={{ marginBottom: dish.allergens ? 16 : 0 }}>
              <h4 style={{ color: "white", fontSize: "0.98rem", fontWeight: 700, marginBottom: 6 }}>Ingredientes</h4>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1.06rem", lineHeight: 1.5 }}>{dish.ingredients}</p>
            </div>
          )}
          {dish.allergens && dish.allergens !== "ninguno" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {dish.allergens.split(",").map(a => a.trim()).filter(Boolean).filter(a => a !== "ninguno").map(a => (
                <span key={a} style={{ fontSize: "0.94rem", padding: "4px 10px", borderRadius: 6, background: "rgba(244,166,35,0.1)", color: "#c9883a", border: "1px solid rgba(244,166,35,0.2)" }}>⚠️ {a}</span>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
