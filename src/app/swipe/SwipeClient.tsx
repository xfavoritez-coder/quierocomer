"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

type SwipeDish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photos: string[];
  dishDiet: string | null;
  txDishType: string[];
  txCuisine: string[];
  txIngredient: string[];
  flavorTags: string[];
  txEstilo: string[];
  restaurant: { name: string; slug: string; logoUrl: string | null; googleRating: number | null };
};

const SWIPE_THRESHOLD = 100;
const ACCENT = "#F4A623";

function formatPrice(p: number) {
  return "$" + p.toLocaleString("es-CL");
}

function DietBadge({ diet }: { diet: string | null }) {
  if (!diet || diet === "OMNIVORE") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 20,
      background: diet === "VEGAN" ? "rgba(52,211,153,0.18)" : "rgba(134,239,172,0.15)",
      border: `1px solid ${diet === "VEGAN" ? "rgba(52,211,153,0.4)" : "rgba(134,239,172,0.3)"}`,
      fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em",
      color: diet === "VEGAN" ? "#34d399" : "#86efac",
    }}>
      {diet === "VEGAN" ? "🌱 Vegano" : "🥗 Vegetariano"}
    </span>
  );
}

function SwipeCard({
  dish,
  isTop,
  stackIndex,
  onSwipe,
}: {
  dish: SwipeDish;
  isTop: boolean;
  stackIndex: number;
  onSwipe: (dir: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const scale = 1 - stackIndex * 0.04;
  const translateY = stackIndex * 10;

  const photo = dish.photos?.[0];
  const photoUrl = photo
    ? (photo.startsWith("http") ? photo : `https://res.cloudinary.com/quierocomer/image/upload/f_auto,q_auto,w_600/${photo}`)
    : null;

  function handleDragEnd(_: any, info: any) {
    if (info.offset.x > SWIPE_THRESHOLD) onSwipe("right");
    else if (info.offset.x < -SWIPE_THRESHOLD) onSwipe("left");
    else animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
  }

  return (
    <motion.div
      style={{
        position: "absolute",
        inset: 0,
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        translateY,
        zIndex: 10 - stackIndex,
        cursor: isTop ? "grab" : "default",
        transformOrigin: "bottom center",
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={isTop ? handleDragEnd : undefined}
      whileTap={isTop ? { cursor: "grabbing" } : {}}
    >
      {/* Card */}
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 24, overflow: "hidden",
        background: "#111",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 4px 20px rgba(0,0,0,0.4)",
        position: "relative",
      }}>
        {/* Photo */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={dish.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", userSelect: "none", pointerEvents: "none" }}
            draggable={false}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#222", display: "grid", placeItems: "center" }}>
            <span style={{ fontSize: "4rem" }}>🍽️</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.92) 100%)",
          pointerEvents: "none",
        }} />

        {/* Content */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "20px 20px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: "0 0 3px",
                fontSize: "0.78rem", fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {dish.restaurant.name}
              </p>
              <h2 style={{
                margin: "0 0 8px",
                fontSize: "1.35rem", fontWeight: 800,
                color: "#fff", lineHeight: 1.2,
              }}>
                {dish.name}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <DietBadge diet={dish.dishDiet} />
                {dish.txDishType[0] && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 12,
                    background: "rgba(255,255,255,0.12)",
                    fontSize: "0.68rem", color: "rgba(255,255,255,0.7)", fontWeight: 600,
                  }}>
                    {dish.txDishType[0]}
                  </span>
                )}
                {dish.txCuisine[0] && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    fontSize: "0.68rem", color: "rgba(255,255,255,0.55)", fontWeight: 600,
                  }}>
                    {dish.txCuisine[0]}
                  </span>
                )}
              </div>
            </div>
            <div style={{
              flexShrink: 0,
              fontSize: "1.25rem", fontWeight: 800,
              color: ACCENT,
              textAlign: "right",
            }}>
              {formatPrice(dish.price)}
            </div>
          </div>
        </div>

        {/* LIKE overlay */}
        {isTop && (
          <motion.div style={{
            position: "absolute", inset: 0,
            background: "rgba(244,166,35,0.15)",
            borderRadius: 24,
            display: "flex", alignItems: "center", justifyContent: "flex-start",
            padding: "0 28px",
            opacity: likeOpacity,
            pointerEvents: "none",
            border: "3px solid rgba(244,166,35,0.7)",
          }}>
            <div style={{
              border: `3px solid ${ACCENT}`,
              borderRadius: 12, padding: "8px 18px",
              transform: "rotate(-15deg)",
            }}>
              <span style={{
                fontSize: "1.4rem", fontWeight: 900,
                color: ACCENT, letterSpacing: "0.05em",
                display: "block",
              }}>
                SE ME ANTOJA
              </span>
            </div>
          </motion.div>
        )}

        {/* NOPE overlay */}
        {isTop && (
          <motion.div style={{
            position: "absolute", inset: 0,
            background: "rgba(239,68,68,0.15)",
            borderRadius: 24,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            padding: "0 28px",
            opacity: nopeOpacity,
            pointerEvents: "none",
            border: "3px solid rgba(239,68,68,0.7)",
          }}>
            <div style={{
              border: "3px solid #ef4444",
              borderRadius: 12, padding: "8px 18px",
              transform: "rotate(15deg)",
            }}>
              <span style={{
                fontSize: "1.4rem", fontWeight: 900,
                color: "#ef4444", letterSpacing: "0.05em",
                display: "block",
              }}>
                NO SE ME ANTOJA
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function SwipeClient({ initialDishes }: { initialDishes: SwipeDish[] }) {
  const [stack, setStack] = useState<SwipeDish[]>(initialDishes);
  const [seen, setSeen] = useState<string[]>([]);
  const [history, setHistory] = useState<{ dish: SwipeDish; dir: "left" | "right" }[]>([]);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  async function fetchMore(seenIds: string[]) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed/swipe?seen=${seenIds.join(",")}`);
      const data: SwipeDish[] = await res.json();
      if (data.length === 0) { setFinished(true); return; }
      setStack(prev => [...prev, ...data]);
    } finally {
      setLoading(false);
    }
  }

  const handleSwipe = useCallback((dish: SwipeDish, dir: "left" | "right") => {
    const newSeen = [...seen, dish.id];
    setSeen(newSeen);
    setHistory(prev => [...prev, { dish, dir }]);
    setStack(prev => prev.filter(d => d.id !== dish.id));
    if (stack.length <= 5) fetchMore(newSeen);
  }, [seen, stack.length]);

  const likes = history.filter(h => h.dir === "right");
  const dislikes = history.filter(h => h.dir === "left");

  if (finished && stack.length === 0) {
    return (
      <div style={{
        minHeight: "100dvh", background: "#030303",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24, gap: 16, color: "#fff",
        fontFamily: "var(--font-dm, 'DM Sans', sans-serif)",
      }}>
        <div style={{ fontSize: "3rem" }}>✨</div>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, textAlign: "center" }}>
          Eso es todo por ahora
        </h2>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
          {likes.length > 0
            ? `Te antojaron ${likes.length} platos de ${new Set(likes.map(l => l.dish.restaurant.slug)).size} restaurantes`
            : "Vuelve más tarde para ver más platos"}
        </p>
        {likes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360, marginTop: 8 }}>
            {likes.slice(0, 5).map(({ dish }) => (
              <a key={dish.id} href={`/qr/${dish.restaurant.slug}`}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 16,
                  background: "rgba(244,166,35,0.08)",
                  border: "1px solid rgba(244,166,35,0.2)",
                  textDecoration: "none", color: "#fff",
                }}>
                <img src={dish.photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem" }}>{dish.name}</p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{dish.restaurant.name}</p>
                </div>
                <span style={{ marginLeft: "auto", color: ACCENT, fontSize: "0.8rem", fontWeight: 700 }}>Ver →</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  const visibleStack = stack.slice(0, 3);

  return (
    <div style={{
      minHeight: "100dvh", background: "#030303",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-dm, 'DM Sans', sans-serif)",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        padding: "env(safe-area-inset-top, 16px) 20px 12px",
        paddingTop: "max(env(safe-area-inset-top), 16px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
            QuieroComer
          </p>
          <h1 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#fff" }}>
            ¿Qué se te antoja hoy?
          </h1>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {dislikes.length > 0 && (
            <div style={{
              padding: "4px 10px", borderRadius: 20,
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
              fontSize: "0.72rem", color: "#ef4444", fontWeight: 700,
            }}>
              ✕ {dislikes.length}
            </div>
          )}
          {likes.length > 0 && (
            <div style={{
              padding: "4px 10px", borderRadius: 20,
              background: "rgba(244,166,35,0.12)", border: "1px solid rgba(244,166,35,0.3)",
              fontSize: "0.72rem", color: ACCENT, fontWeight: 700,
            }}>
              ✓ {likes.length}
            </div>
          )}
        </div>
      </div>

      {/* Card stack */}
      <div style={{ flex: 1, position: "relative", padding: "0 16px 8px" }}>
        <div style={{ position: "relative", height: "100%" }}>
          {stack.length === 0 && !loading ? (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,0.4)",
            }}>
              <div style={{ fontSize: "3rem" }}>🍽️</div>
              <p style={{ margin: 0 }}>Cargando más platos...</p>
            </div>
          ) : (
            [...visibleStack].reverse().map((dish, revIdx) => {
              const stackIndex = visibleStack.length - 1 - revIdx;
              const isTop = stackIndex === 0;
              return (
                <SwipeCard
                  key={dish.id}
                  dish={dish}
                  isTop={isTop}
                  stackIndex={stackIndex}
                  onSwipe={(dir) => handleSwipe(dish, dir)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        padding: "12px 40px max(env(safe-area-inset-bottom), 20px)",
        display: "flex", justifyContent: "center", gap: 28,
      }}>
        <button
          onClick={() => stack[0] && handleSwipe(stack[0], "left")}
          style={{
            width: 62, height: 62, borderRadius: "50%",
            background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.35)",
            display: "grid", placeItems: "center",
            cursor: "pointer", fontSize: "1.5rem",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
        >
          ✕
        </button>
        <button
          onClick={() => stack[0] && handleSwipe(stack[0], "right")}
          style={{
            width: 62, height: 62, borderRadius: "50%",
            background: `rgba(244,166,35,0.1)`, border: `2px solid rgba(244,166,35,0.35)`,
            display: "grid", placeItems: "center",
            cursor: "pointer", fontSize: "1.5rem",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(244,166,35,0.2)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(244,166,35,0.1)")}
        >
          ✓
        </button>
      </div>

      {/* Hint swipe */}
      {history.length === 0 && stack.length > 0 && (
        <div style={{
          position: "absolute", bottom: 100, left: 0, right: 0,
          display: "flex", justifyContent: "center", pointerEvents: "none",
        }}>
          <p style={{
            margin: 0, fontSize: "0.72rem",
            color: "rgba(255,255,255,0.3)", fontWeight: 600,
            letterSpacing: "0.04em",
          }}>
            ← desliza para explorar →
          </p>
        </div>
      )}
    </div>
  );
}
