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

function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("qr_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("qr_session_id", id);
  }
  return id;
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
  const averageRating = ratingMap[dish.id];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);

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

  // Touch tracking
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "DISH_VIEW",
        dishId: dish.id,
        restaurantId,
        sessionId: getSessionId(),
      }),
    }).catch(() => {});
    return () => {
      document.body.style.overflow = "";
    };
  }, [dish.id, restaurantId]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const currentIndex = allDishes.findIndex((d) => d.id === dish.id);
  const hasNext = currentIndex < allDishes.length - 1;
  const hasPrev = currentIndex > 0;

  const goNext = () => {
    if (hasNext) onChangeDish(allDishes[currentIndex + 1]);
  };
  const goPrev = () => {
    if (hasPrev) onChangeDish(allDishes[currentIndex - 1]);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = touchRef.current.x - e.changedTouches[0].clientX;
    const dy = touchRef.current.y - e.changedTouches[0].clientY;
    touchRef.current = null;

    // Swipe down to close
    if (dy < -80 && Math.abs(dx) < 50) {
      close();
      return;
    }

    // Swipe horizontal to change dish
    if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
      if (dx > 0) goNext();
      else goPrev();
    }
  };

  return (
    <div
      className="font-[family-name:var(--font-dm)]"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#000",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease-out",
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

      {/* Photo dots — top center */}
      {photos.length > 1 && (
        <div
          className="absolute flex"
          style={{
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            gap: 5,
            zIndex: 10,
          }}
        >
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setPhotoIndex(i)}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === photoIndex ? "white" : "rgba(255,255,255,0.4)",
                border: "none",
                padding: 0,
                transition: "background 0.2s",
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
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          color: "white",
          fontSize: "1.1rem",
          border: "none",
          zIndex: 10,
        }}
      >
        ✕
      </button>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          onClick={goPrev}
          className="absolute flex items-center justify-center"
          style={{
            top: "50%",
            left: 12,
            transform: "translateY(-50%)",
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            color: "white",
            fontSize: "1.1rem",
            border: "none",
            zIndex: 10,
          }}
        >
          ‹
        </button>
      )}
      {hasNext && (
        <button
          onClick={goNext}
          className="absolute flex items-center justify-center"
          style={{
            top: "50%",
            right: 12,
            transform: "translateY(-50%)",
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            color: "white",
            fontSize: "1.1rem",
            border: "none",
            zIndex: 10,
          }}
        >
          ›
        </button>
      )}

      {/* Info overlay — bottom */}
      <div
        className="absolute"
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)",
          padding: "60px 20px 40px",
          zIndex: 5,
        }}
      >
        {/* Category label */}
        {categoryName && (
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }}>
            {categoryName}
          </span>
        )}

        {/* Badges row */}
        <div className="flex items-center" style={{ gap: 6, marginBottom: 8 }}>
          {isRecommended && (
            <span
              style={{
                background: "rgba(244,166,35,0.25)",
                color: "#F4A623",
                border: "1px solid rgba(244,166,35,0.4)",
                fontSize: "0.7rem",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 50,
              }}
            >
              ⭐ Recomendado
            </span>
          )}
          {averageRating && (
            <span
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "white",
                fontSize: "0.7rem",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 50,
              }}
            >
              ★ {averageRating.avg.toFixed(1)}
            </span>
          )}
          {dish.stockCountdown != null && dish.stockCountdown > 0 && (
            <span
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "white",
                fontSize: "0.7rem",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 50,
              }}
            >
              🔥 Quedan {dish.stockCountdown}
            </span>
          )}
        </div>

        {/* Name */}
        <h2
          style={{
            fontSize: "1.8rem",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {dish.name}
        </h2>

        {/* Price */}
        <div className="flex items-center" style={{ marginTop: 6, gap: 8 }}>
          {dish.discountPrice ? (
            <>
              <span
                className="line-through"
                style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem" }}
              >
                ${dish.price.toLocaleString("es-CL")}
              </span>
              <span style={{ color: isRecommended ? "#F4A623" : "white", fontSize: "1.9rem", fontWeight: 800 }}>
                ${dish.discountPrice.toLocaleString("es-CL")}
              </span>
              {discountPercent && (
                <span
                  style={{
                    background: "#F4A623",
                    color: "#0e0e0e",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  -{discountPercent}%
                </span>
              )}
            </>
          ) : (
            <span style={{ color: isRecommended ? "#F4A623" : "white", fontSize: "1.9rem", fontWeight: 800 }}>
              ${dish.price.toLocaleString("es-CL")}
            </span>
          )}
        </div>

        {/* Description */}
        {desc && (
          <p
            style={{
              marginTop: 10,
              fontSize: "1.05rem",
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.75,
              display: "-webkit-box",
              WebkitLineClamp: expandDesc ? 999 : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {desc}
          </p>
        )}
        {isLongDesc && !expandDesc && (
          <button
            onClick={() => setExpandDesc(true)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.78rem",
              padding: 0,
              marginTop: 2,
            }}
          >
            ver más
          </button>
        )}

        {/* Ingredients/allergens button */}
        {hasInfo && (
          <button
            onClick={() => setShowInfo(true)}
            style={{
              marginTop: 12,
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              color: "white",
              fontSize: "0.92rem",
              fontWeight: 500,
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
            }}
          >
            Ver ingredientes ▾
          </button>
        )}
      </div>

      {/* Ingredients/allergens panel */}
      {showInfo && (
        <div
          className="absolute"
          style={{
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: 20,
            borderRadius: "16px 16px 0 0",
            animation: "slideUp 0.2s ease-out",
          }}
        >
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>

          {/* Close panel */}
          <button
            onClick={() => setShowInfo(false)}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "white",
              width: 28,
              height: 28,
              borderRadius: "50%",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>

          {dish.ingredients && (
            <div style={{ marginBottom: dish.allergens ? 16 : 0 }}>
              <h4 style={{ color: "white", fontSize: "0.85rem", fontWeight: 700, marginBottom: 6 }}>
                Ingredientes
              </h4>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem", lineHeight: 1.5 }}>
                {dish.ingredients}
              </p>
            </div>
          )}

          {dish.allergens && (
            <div>
              <h4 style={{ color: "#F4A623", fontSize: "0.85rem", fontWeight: 700, marginBottom: 6 }}>
                ⚠️ Alérgenos
              </h4>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem", lineHeight: 1.5 }}>
                {dish.allergens}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
