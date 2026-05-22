"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Dish, Category } from "@prisma/client";
import { trackDetailOpen, trackDetailClose, getDbSessionId } from "@/lib/sessionTracker";
import { getGuestId, getSessionId } from "@/lib/guestId";
import { useLang } from "@/contexts/LangContext";
import { getCrossSellDishes } from "./utils/getCrossSellDishes";

/* ─── palettes ─── */
const LIGHT = {
  paper: "#fffaf2", ink: "#15241b", muted: "#756b5f", gold: "#b88935",
  goldSoft: "#efe0c4", line: "#e2d2b8", desc: "#423a33",
  sheetBg: "linear-gradient(180deg, #fffaf2 0%, #f5ead8 100%)",
  backdrop: "rgba(16,37,26,0.5)",
  closeBg: "rgba(0,0,0,0.06)", handleBg: "#e2d2b8",
  tagVegan: { color: "#2d6a4f", bg: "#d8f3dc" },
  tagSpicy: { color: "#9d0208", bg: "#ffd6d6" },
  tagGF: { color: "#5a4a00", bg: "#fef3c7" },
  allergenColor: "#a14d36", allergenBg: "#fff2ed", allergenBorder: "#efc6b7",
  ratingBg: "rgba(184,137,53,0.08)", ratingBorder: "rgba(184,137,53,0.15)",
  sugBg: "#fffaf2", sugBorder: "#e2d2b8",
  pillBg: "#fff8ec", pillBorder: "#e2d2b8",
  recBg: "rgba(184,137,53,0.12)", recBorder: "rgba(184,137,53,0.25)", recColor: "#7f5100",
};
const DARK = {
  paper: "#e8dcc4", ink: "#e8dcc4", muted: "#8a7f72", gold: "#d4a84b",
  goldSoft: "#2a2216", line: "#2a2a24", desc: "#b8ad9e",
  sheetBg: "linear-gradient(180deg, #141a16 0%, #0e1410 100%)",
  backdrop: "rgba(0,0,0,0.65)",
  closeBg: "rgba(255,255,255,0.08)", handleBg: "#2a2a24",
  tagVegan: { color: "#86efac", bg: "rgba(134,239,172,0.1)" },
  tagSpicy: { color: "#fca5a5", bg: "rgba(252,165,165,0.1)" },
  tagGF: { color: "#fde68a", bg: "rgba(253,230,138,0.1)" },
  allergenColor: "#fca5a5", allergenBg: "rgba(252,165,165,0.08)", allergenBorder: "rgba(252,165,165,0.2)",
  ratingBg: "rgba(212,168,75,0.1)", ratingBorder: "rgba(212,168,75,0.2)",
  sugBg: "#1a211c", sugBorder: "#2a2a24",
  pillBg: "rgba(255,255,255,0.06)", pillBorder: "#2a2a24",
  recBg: "rgba(212,168,75,0.15)", recBorder: "rgba(212,168,75,0.3)", recColor: "#d4a84b",
};

interface Props {
  dish: Dish;
  allDishes: Dish[];
  categories: Category[];
  restaurantId: string;
  ratingMap: Record<string, { avg: number; count: number }>;
  onClose: () => void;
  onChangeDish: (dish: Dish) => void;
  restaurantName?: string;
  popularDishIds?: Set<string>;
  isDark?: boolean;
}

export default function DishDetailEsencial({
  dish, allDishes, categories, restaurantId, ratingMap,
  onClose, onChangeDish, restaurantName, popularDishIds, isDark: isDarkProp,
}: Props) {
  const lang = useLang();
  const C = isDarkProp ? DARK : LIGHT;
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const category = categories.find(c => c.id === (dish as any).categoryId);
  const isPopular = popularDishIds?.has(dish.id) || false;
  const isHighlight = isPopular || dish.tags?.includes("RECOMMENDED");
  const rating = ratingMap[dish.id];
  const diet = (dish as any).dishDiet;
  const isSpicy = (dish as any).isSpicy;
  const isGlutenFree = (dish as any).isGlutenFree;

  // Allergens from dish ingredients
  const allergens = useMemo(() => {
    const list: string[] = [];
    const ings = (dish as any).dishIngredients || [];
    for (const di of ings) {
      for (const a of (di.ingredient?.allergens || [])) {
        if (a.type === "ALLERGEN" && !list.includes(a.name)) list.push(a.name);
      }
    }
    return list;
  }, [dish]);

  // Ingredients list
  const ingredients = useMemo(() => {
    const ings = (dish as any).dishIngredients || [];
    return ings.map((di: any) => di.ingredient?.name).filter(Boolean) as string[];
  }, [dish]);

  // Cross-sell suggestions (contextual by dish type)
  const crossSell = useMemo(() => {
    const diet = typeof window !== "undefined" ? localStorage.getItem("qr_diet") : null;
    try { return getCrossSellDishes(dish, allDishes, categories, undefined, diet); } catch { return { title: "", items: [] }; }
  }, [dish, allDishes, categories]);

  // Mount animation
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Lock scroll
  useEffect(() => {
    const y = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, y);
    };
  }, []);

  // Track
  useEffect(() => {
    trackDetailOpen(dish.id);
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "DISH_VIEW", dishId: dish.id, restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId() }),
    }).catch(() => {});
    return () => { trackDetailClose(); };
  }, [dish.id, restaurantId]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 120,
      background: C.backdrop,
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      opacity: visible ? 1 : 0, transition: "opacity 0.25s ease",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={close}>

      {/* Sheet */}
      <div
        ref={scrollRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "88vh",
          background: C.sheetBg,
          borderRadius: "30px 30px 0 0",
          overflowY: "auto", overflowX: "hidden",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          scrollbarWidth: "none",
        }}
      >
        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.handleBg }} />
        </div>

        {/* Header */}
        <div style={{ padding: "20px 22px 0" }}>
          {/* Top row: category + close */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.gold,
              letterSpacing: ".16em", textTransform: "uppercase",
            }}>
              {category?.name || ""}
            </span>
            <button onClick={close} style={{
              width: 32, height: 32, borderRadius: "50%",
              background: C.closeBg, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, color: C.muted,
            }}>
              ✕
            </button>
          </div>
          {(isHighlight || isPopular) && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {isHighlight && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                  background: C.recBg, border: `1px solid ${C.recBorder}`,
                  color: C.recColor, letterSpacing: ".05em", textTransform: "uppercase",
                  fontFamily: "system-ui, sans-serif",
                }}>
                  ★ Recomendado
                </span>
              )}
              {isPopular && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
                  background: isDarkProp ? "rgba(251,146,60,0.12)" : "rgba(234,88,12,0.08)",
                  border: `1px solid ${isDarkProp ? "rgba(251,146,60,0.25)" : "rgba(234,88,12,0.2)"}`,
                  color: isDarkProp ? "#fb923c" : "#c2410c",
                  letterSpacing: ".05em", textTransform: "uppercase",
                  fontFamily: "system-ui, sans-serif",
                }}>
                  🔥 Popular
                </span>
              )}
            </div>
          )}

          {/* Dish name */}
          <h2 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 30, fontWeight: 400, lineHeight: .98,
            letterSpacing: "-.03em", margin: "0 0 6px", color: C.ink,
          }}>
            {dish.name}
          </h2>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            {dish.discountPrice && (
              <span style={{
                fontFamily: "Georgia, serif", fontSize: 14,
                color: C.muted, textDecoration: "line-through",
              }}>
                ${dish.price?.toLocaleString("es-CL")}
              </span>
            )}
            <span style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 20, fontWeight: 500, color: C.ink,
            }}>
              ${(dish.discountPrice || dish.price)?.toLocaleString("es-CL") ?? "—"}
            </span>
          </div>

          {/* Gold divider */}
          <div style={{ width: 44, height: 2, background: C.gold, margin: "18px 0", borderRadius: 1 }} />
        </div>

        {/* Description */}
        {dish.description && (
          <div style={{ padding: "0 22px 16px" }}>
            <p style={{
              fontSize: 17, color: C.desc, lineHeight: 1.55, margin: 0,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}>
              {dish.description}
            </p>
          </div>
        )}

        {/* Tags */}
        {(diet === "VEGAN" || diet === "VEGETARIAN" || isSpicy || isGlutenFree) && (
          <div style={{ padding: "0 22px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {diet === "VEGAN" && <Tag color={C.tagVegan.color} bg={C.tagVegan.bg} icon="🌿" label="Vegano" />}
            {diet === "VEGETARIAN" && <Tag color={C.tagVegan.color} bg={C.tagVegan.bg} icon="🥬" label="Vegetariano" />}
            {isSpicy && <Tag color={C.tagSpicy.color} bg={C.tagSpicy.bg} icon="🌶" label="Picante" />}
            {isGlutenFree && <Tag color={C.tagGF.color} bg={C.tagGF.bg} icon="🌾" label="Sin gluten" />}
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div style={{ padding: "0 22px 18px" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 800, color: C.gold,
              letterSpacing: ".16em", textTransform: "uppercase",
              marginBottom: 10,
            }}>
              Ingredientes
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ingredients.map((ing, i) => (
                <span key={i} style={{
                  fontSize: 13, padding: "5px 12px", borderRadius: 999,
                  background: C.pillBg, border: `1px solid ${C.pillBorder}`,
                  color: C.desc, fontFamily: "system-ui, sans-serif",
                }}>
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Allergens */}
        {allergens.length > 0 && (
          <div style={{ padding: "0 22px 18px" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 800, color: C.allergenColor,
              letterSpacing: ".16em", textTransform: "uppercase",
              marginBottom: 10,
            }}>
              Alérgenos
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allergens.map((a, i) => (
                <span key={i} style={{
                  fontSize: 13, padding: "5px 12px", borderRadius: 999,
                  background: C.allergenBg, border: `1px solid ${C.allergenBorder}`,
                  color: C.allergenColor, fontWeight: 600, fontFamily: "system-ui, sans-serif",
                }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rating */}
        {rating && rating.count > 0 && (
          <div style={{
            margin: "0 22px 18px", padding: "14px 16px",
            background: C.ratingBg, borderRadius: 18,
            border: `1px solid ${C.ratingBorder}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>{"★".repeat(Math.round(rating.avg))}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{rating.avg.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: C.muted }}>({rating.count} {rating.count === 1 ? "voto" : "votos"})</span>
          </div>
        )}

        {/* Cross-sell suggestions */}
        {crossSell.items.length > 0 && (
          <div style={{ padding: "0 22px 24px", marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 22 }}>
            <h3 style={{
              fontSize: 11, fontWeight: 800, color: C.gold,
              letterSpacing: ".16em", textTransform: "uppercase",
              marginBottom: 16,
            }}>
              {crossSell.title}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {crossSell.items.map(({ dish: s, reason }) => (
                <button
                  key={s.id}
                  onClick={() => onChangeDish(s)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    padding: "14px 16px", borderRadius: 20,
                    background: C.sugBg, border: `1px solid ${C.sugBorder}`,
                    cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: C.ink,
                      textTransform: "uppercase", letterSpacing: ".06em",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontFamily: "system-ui, sans-serif",
                    }}>
                      {s.name}
                    </div>
                    {((s as any).dishDiet === "VEGAN" || (s as any).dishDiet === "VEGETARIAN" || (s as any).isSpicy || (s as any).isGlutenFree) && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                        {(s as any).dishDiet === "VEGAN" && <MiniTag icon="🌿" label="Vegano" isDark={isDarkProp} />}
                        {(s as any).dishDiet === "VEGETARIAN" && <MiniTag icon="🥬" label="Vegetariano" isDark={isDarkProp} />}
                        {(s as any).isSpicy && <MiniTag icon="🌶" label="Picante" isDark={isDarkProp} iconColor="#e53e3e" />}
                        {(s as any).isGlutenFree && <MiniTag icon="🌾" label="Sin gluten" isDark={isDarkProp} />}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 500, color: C.ink, flexShrink: 0, marginLeft: 12,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    ${(s.discountPrice || s.price)?.toLocaleString("es-CL")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div style={{ height: 24 }} />
      </div>

      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

function MiniTag({ icon, label, isDark, iconColor }: { icon: string; label: string; isDark?: boolean; iconColor?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 10, fontWeight: 600, color: isDark ? "#8a7f72" : "#756b5f",
      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,248,236,0.8)",
      padding: "2px 7px", borderRadius: 999,
      border: `1px solid ${isDark ? "#2a2a24" : "#e2d2b8"}`, fontFamily: "system-ui, sans-serif",
    }}>
      {iconColor ? <span style={{ color: iconColor }}>{icon}</span> : icon} {label}
    </span>
  );
}

function Tag({ color, bg, icon, label }: { color: string; bg: string; icon: string; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, fontWeight: 700, color, background: bg,
      padding: "5px 10px", borderRadius: 999,
      fontFamily: "system-ui, sans-serif",
    }}>
      {icon} {label}
    </span>
  );
}
