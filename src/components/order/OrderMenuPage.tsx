"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, Search, X, Plus, User } from "lucide-react";
import { useCart } from "./OrderCartContext";
import OrderItemModal, { type DishForOrder } from "./OrderItemModal";
import OrderCart from "./OrderCart";
import OrderCheckout from "./OrderCheckout";
import type { SelectedOption } from "./OrderCartContext";

const FB = "var(--font-body, system-ui)";

/** Returns #111 for light accent colors, #fff for dark ones */
function accentContrast(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#111" : "#fff";
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface Category { id: string; name: string; }
interface Dish {
  id: string; name: string; description?: string | null;
  price: number; discountPrice?: number | null; photos?: string[]; categoryId: string;
  isActive: boolean; deletedAt?: Date | null;
  modifierTemplates: any[];
  tags?: string[];
  dishDiet?: string | null;
  isGlutenFree?: boolean;
}
interface Restaurant {
  name: string; slug: string; logoUrl?: string | null; bannerUrl?: string | null;
  categories: Category[]; dishes: Dish[];
}
interface OrderingConfig {
  phone: string;
  delivery: "PICKUP" | "DELIVERY" | "BOTH";
  minAmount: number | null;
  waitTime: string | null;
  note: string | null;
  address: string | null;
  paymentMethods?: string[];
  orderingBannerUrl?: string | null;
  cartaView?: string;
  cartaColorMode?: string;
  cartaAccentColor?: string | null;
  orderingMode?: string;
  showFeatured?: boolean;
  columns?: string; // "one" | "two"
  showIdentify?: boolean;
  categoryPhotos?: boolean;
}
type BHDay = { open: boolean; from: string; to: string };
interface Props {
  restaurant: Restaurant;
  orderingConfig: OrderingConfig;
  popularDishIds?: string[];
  isClosed?: boolean;
  businessHours?: Record<string, BHDay> | null;
}

// ── Impact Hero (replica de ImpactHeroSlider) ─────────────────────────────────
function ImpactHero({
  heroDishes,
  restaurantName,
  accent,
  onDishSelect,
  onDirectAdd,
}: {
  heroDishes: Dish[];
  restaurantName: string;
  accent: string;
  onDishSelect: (d: Dish) => void;
  onDirectAdd: (d: Dish) => void;
}) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const touchStartX = useRef(0);
  const touchWasSwipe = useRef(false);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % heroDishes.length), 5000);
  }, [heroDishes.length]);

  useEffect(() => {
    if (heroDishes.length <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [heroDishes.length, resetTimer]);

  if (heroDishes.length === 0) return null;
  const d = heroDishes[current];
  const accentFg = accentContrast(accent);
  const effectivePrice = d.discountPrice != null && d.discountPrice < d.price ? d.discountPrice : d.price;
  const discountPct = d.discountPrice != null && d.discountPrice < d.price
    ? Math.round(((d.price - d.discountPrice) / d.price) * 100) : 0;

  return (
    <section
      style={{
        minHeight: "55vh", position: "relative", display: "flex",
        alignItems: "flex-end", padding: "72px 20px 16px",
        margin: "0 14px", borderRadius: 28, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)", cursor: "pointer",
      }}
      onClick={() => { if (!touchWasSwipe.current) onDishSelect(d); touchWasSwipe.current = false; }}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; touchWasSwipe.current = false; }}
      onTouchEnd={e => {
        const diff = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(diff) > 50) {
          touchWasSwipe.current = true;
          setCurrent(c => diff < 0 ? (c + 1) % heroDishes.length : (c - 1 + heroDishes.length) % heroDishes.length);
          resetTimer();
        }
      }}
    >
      {/* Slides */}
      {heroDishes.map((dish, i) => (
        <div key={dish.id} style={{ position: "absolute", inset: 0, zIndex: 1, opacity: i === current ? 1 : 0, transition: "opacity 0.8s ease" }}>
          {dish.photos?.[0] ? (
            <img src={dish.photos[0]} alt={dish.name} loading={i === 0 ? "eager" : "lazy"}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, #1a1a2e), color-mix(in srgb, ${accent} 6%, #0f3460))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "5rem", opacity: 0.35 }}>🍽️</span>
            </div>
          )}
        </div>
      ))}

      {/* Overlays */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.25) 36%, rgba(0,0,0,0.72) 78%, #030303 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: "50%", zIndex: 3, background: "linear-gradient(to top, #030303 0%, #030303 8%, rgba(3,3,3,0.85) 38%, rgba(3,3,3,0.4) 72%, transparent 100%)" }} />

      {/* Content */}
      <div style={{ width: "100%", padding: "0 0 8px", position: "relative", zIndex: 4 }}>
        <h1 style={{ margin: 0, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 62, lineHeight: 0.82, letterSpacing: "0.5px", textShadow: "0 5px 30px rgba(0,0,0,0.92)", color: "white" }}>
          {d.name.split(" ").map((w, i, arr) =>
            i === arr.length - 1
              ? <span key={i} style={{ display: "inline-block", color: accent, fontSize: 58, fontWeight: 900, textShadow: `0 0 20px color-mix(in srgb, ${accent} 50%, transparent)` }}>{w}</span>
              : <span key={i}>{w} </span>
          )}
        </h1>
        {d.description && (
          <p style={{ maxWidth: 300, margin: "15px 0 16px", color: "#b0a89e", fontSize: 15, lineHeight: 1.52, textShadow: "0 1px 8px rgba(0,0,0,0.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {d.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {discountPct > 0 && (
              <span style={{ fontSize: 13, fontWeight: 800, color: accentFg, background: accent, padding: "4px 11px", borderRadius: 50 }}>-{discountPct}%</span>
            )}
            <span style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.8px" }}>{formatCLP(effectivePrice)}</span>
            {discountPct > 0 && (
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>{formatCLP(d.price)}</span>
            )}
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              const hasModifiers = d.modifierTemplates?.some((t: any) => t.groups?.length > 0);
              if (hasModifiers) onDishSelect(d); else onDirectAdd(d);
            }}
            style={{ width: 42, height: 42, borderRadius: "50%", border: `1px solid color-mix(in srgb, ${accent} 60%, transparent)`, background: `color-mix(in srgb, ${accent} 20%, rgba(0,0,0,0.45))`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 0 18px color-mix(in srgb, ${accent} 55%, transparent)`, flexShrink: 0 }}
          >
            <Plus size={20} color="var(--carta-plus-icon, #fff)" />
          </button>
        </div>
        {heroDishes.length > 1 && (
          <div style={{ display: "flex", gap: 7, marginTop: 17 }}>
            {heroDishes.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); resetTimer(); }}
                style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 50, background: i === current ? accent : "rgba(255,255,255,0.38)", border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0 }} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Lista Hero (replica de HeroSlim) ─────────────────────────────────────────
function ListaHero({
  heroDishes,
  restaurant,
  accent,
  onDishSelect,
  onDirectAdd,
}: {
  heroDishes: Dish[];
  restaurant: Restaurant;
  accent: string;
  onDishSelect: (d: Dish) => void;
  onDirectAdd: (d: Dish) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (heroDishes.length <= 1) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % heroDishes.length), 5000);
    return () => clearInterval(t);
  }, [heroDishes.length]);

  const dish = heroDishes[current] ?? null;
  const accentFg = accentContrast(accent);
  const bgSrc = dish?.photos?.[0] || restaurant.bannerUrl || null;

  return (
    <>
      <style>{`@keyframes heroKenBurns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }`}</style>
      <section
        style={{ height: "32vh", maxHeight: 260, position: "relative", width: "100%", overflow: "hidden", cursor: dish ? "pointer" : undefined }}
        onClick={() => { if (dish) onDishSelect(dish); }}
        onTouchStart={e => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={e => {
          if (touchStart === null) return;
          const diff = touchStart - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) setCurrent(c => diff > 0 ? (c + 1) % heroDishes.length : (c - 1 + heroDishes.length) % heroDishes.length);
          setTouchStart(null);
        }}
      >
        {bgSrc ? (
          <>
            <img src={bgSrc} alt={dish?.name || restaurant.name} key={bgSrc}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", animation: "heroKenBurns 12s ease-in-out infinite alternate" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)" }} />
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, #1a1a2e), color-mix(in srgb, ${accent} 6%, #0f3460))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "5rem", opacity: 0.35 }}>🍽️</span>
          </div>
        )}

        {/* Logo + nombre dentro del banner (diseño original) */}
        <a href={`/qr/${restaurant.slug}`} style={{ position: "absolute", top: 10, left: 14, zIndex: 10, display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          {restaurant.logoUrl ? (
            <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#0e0e0e" }}>
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ color: "white", fontSize: "1.17rem", fontWeight: 400, textShadow: "0 1px 3px rgba(0,0,0,0.4)", opacity: 0.85 }}>{restaurant.name}</span>
        </a>

        {/* Dish info */}
        {dish && (
          <div style={{ position: "absolute", bottom: 28, left: 16, right: "30%", zIndex: 10 }}>
            <h2 style={{ fontFamily: "var(--font-playfair, Georgia, serif)", color: "white", fontSize: "1.36rem", fontWeight: 800, lineHeight: 1.15, textShadow: "0 2px 6px rgba(0,0,0,0.5)", margin: 0 }}>{dish.name}</h2>
            {dish.description && (
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem", marginTop: 6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{dish.description}</p>
            )}
          </div>
        )}

        {/* Add button */}
        {dish && (
          <button
            onClick={e => {
              e.stopPropagation();
              const hasModifiers = dish.modifierTemplates?.some((t: any) => t.groups?.length > 0);
              if (hasModifiers) onDishSelect(dish); else onDirectAdd(dish);
            }}
            style={{ position: "absolute", bottom: 14, right: 14, zIndex: 11, width: 40, height: 40, borderRadius: "50%", border: `1px solid color-mix(in srgb, ${accent} 60%, transparent)`, background: `color-mix(in srgb, ${accent} 20%, rgba(0,0,0,0.45))`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 0 18px color-mix(in srgb, ${accent} 55%, transparent)` }}
          >
            <Plus size={18} color="var(--carta-plus-icon, #fff)" />
          </button>
        )}

        {/* Dots */}
        {heroDishes.length > 1 && (
          <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, zIndex: 10, display: "flex", justifyContent: "center", gap: 5 }}>
            {heroDishes.map((_, i) => (
              <div key={i} style={{ width: i === current ? 16 : 6, height: 6, borderRadius: 3, background: i === current ? accent : "rgba(255,255,255,0.4)", transition: "all 0.35s ease" }} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ── Impact card (liquid glass: foto izquierda, texto derecha) — diseño impact ──
function ImpactCard({
  dish, onClick, onDirectAdd,
}: { dish: Dish; onClick: () => void; onDirectAdd: (e: React.MouseEvent) => void }) {
  const effectivePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const discountPct = dish.discountPrice != null && dish.discountPrice < dish.price
    ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100) : 0;
  const hasModifiers = dish.modifierTemplates?.some((t: any) => t.groups?.length > 0);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "grid", gridTemplateColumns: "118px 1fr",
        gap: 16, padding: 10, marginBottom: 11, borderRadius: 26,
        background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-text) 7.5%, transparent), color-mix(in srgb, var(--carta-text) 2.5%, transparent))",
        border: "1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)",
        position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <div style={{ position: "relative", width: 118, height: 118, borderRadius: 20, overflow: "hidden", flexShrink: 0, background: dish.photos?.[0] ? "#222" : "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent) 15%, var(--carta-surface)), color-mix(in srgb, var(--carta-accent) 5%, var(--carta-surface)))" }}>
        {dish.photos?.[0] ? (
          <img src={dish.photos[0]} alt={dish.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem" }}>🍽️</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, paddingRight: 38 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--carta-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dish.name}</h4>
        {dish.description && (
          <p style={{ margin: "0 0 8px", color: "var(--carta-text2)", fontSize: 13, lineHeight: 1.42, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{dish.description}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {discountPct > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "var(--carta-accent)", padding: "3px 10px", borderRadius: 50 }}>-{discountPct}%</span>}
          <b style={{ color: "var(--carta-accent)", fontSize: 16 }}>{formatCLP(effectivePrice)}</b>
          {discountPct > 0 && <span style={{ fontSize: "0.78rem", color: "var(--carta-text3, #666)", textDecoration: "line-through" }}>{formatCLP(dish.price)}</span>}
        </div>
      </div>
      <div onClick={hasModifiers ? undefined : onDirectAdd} style={{ position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: "50%", background: "color-mix(in srgb, var(--carta-accent) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--carta-accent) 55%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px color-mix(in srgb, var(--carta-accent) 50%, transparent)", pointerEvents: hasModifiers ? "none" : "auto" }}>
        <Plus size={16} color="var(--carta-plus-icon, #fff)" />
      </div>
    </button>
  );
}

// ── Grid card (vertical: foto arriba, texto abajo) — para el grid ecommerce 4/2 ──
function GridCard({ dish, onClick, onDirectAdd }: { dish: Dish; onClick: () => void; onDirectAdd: (e: React.MouseEvent) => void }) {
  const effectivePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const discountPct = dish.discountPrice != null && dish.discountPrice < dish.price
    ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100) : 0;
  const hasModifiers = dish.modifierTemplates?.some((t: any) => t.groups?.length > 0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // Imágenes cacheadas ya están "complete" antes de montar el handler → onLoad no dispara.
  // Detectamos ese caso al montar para no dejarlas invisibles (opacity 0).
  useEffect(() => { if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setImgLoaded(true); }, []);
  const photo = dish.photos?.[0];

  return (
    <button
      onClick={onClick}
      style={{ display: "flex", flexDirection: "column", width: "100%", padding: 0, overflow: "hidden", background: "var(--carta-surface)", borderRadius: 16, border: "1px solid var(--carta-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "left", cursor: "pointer", fontFamily: "inherit", position: "relative" }}
    >
      {/* Foto ARRIBA (cuadrada) */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", flexShrink: 0, background: photo ? "var(--carta-photo-bg)" : "linear-gradient(135deg, var(--carta-bg), var(--carta-photo-bg))" }}>
        {photo ? (
          <>
            {!imgLoaded && <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)", animation: "shimmer 1.5s infinite" }} /></div>}
            <img ref={imgRef} src={photo} alt={dish.name} loading="lazy" onLoad={() => setImgLoaded(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }} />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4rem" }}>🍽️</div>
        )}
        {discountPct > 0 && <span style={{ position: "absolute", top: 8, left: 8, fontSize: "11px", fontWeight: 800, color: "white", background: "var(--carta-accent)", padding: "3px 9px", borderRadius: 50 }}>-{discountPct}%</span>}
      </div>
      {/* Texto ABAJO */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "10px 12px 12px" }}>
        <h3 style={{ fontFamily: "var(--font-playfair, Georgia, serif)", fontSize: "0.98rem", fontWeight: 600, color: "var(--carta-text)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dish.name}</h3>
        {dish.description && (
          <p style={{ fontSize: "0.78rem", color: "var(--carta-text2)", lineHeight: 1.4, margin: "0 0 8px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{dish.description}</p>
        )}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--carta-accent)" }}>{formatCLP(effectivePrice)}</span>
            {discountPct > 0 && <span style={{ fontSize: "0.72rem", color: "var(--carta-text3)", textDecoration: "line-through" }}>{formatCLP(dish.price)}</span>}
          </div>
          <div onClick={hasModifiers ? undefined : onDirectAdd} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", background: "color-mix(in srgb, var(--carta-accent) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--carta-accent) 50%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: hasModifiers ? "none" : "auto" }}>
            <Plus size={17} color="var(--carta-plus-icon, #fff)" />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Row card (horizontal: foto izquierda, texto derecha) — para la vista de 1 columna ──
function ListaRowCard({ dish, onClick, onDirectAdd }: { dish: Dish; onClick: () => void; onDirectAdd: (e: React.MouseEvent) => void }) {
  const effectivePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const discountPct = dish.discountPrice != null && dish.discountPrice < dish.price
    ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100) : 0;
  const hasModifiers = dish.modifierTemplates?.some((t: any) => t.groups?.length > 0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => { if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setImgLoaded(true); }, []);
  const photo = dish.photos?.[0];

  return (
    <button
      onClick={onClick}
      style={{ position: "relative", width: "100%", display: "flex", gap: 0, padding: 0, overflow: "hidden", background: "var(--carta-surface)", borderRadius: 14, border: "1px solid var(--carta-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
    >
      {/* Foto IZQUIERDA */}
      <div style={{ width: 128, minHeight: 128, alignSelf: "stretch", overflow: "hidden", flexShrink: 0, position: "relative", background: photo ? "var(--carta-photo-bg)" : "linear-gradient(135deg, var(--carta-bg), var(--carta-photo-bg))" }}>
        {photo ? (
          <>
            {!imgLoaded && <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)", animation: "shimmer 1.5s infinite" }} /></div>}
            <img ref={imgRef} src={photo} alt={dish.name} loading="lazy" onLoad={() => setImgLoaded(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }} />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🍽️</div>
        )}
        {discountPct > 0 && <span style={{ position: "absolute", top: 6, left: 6, fontSize: "11px", fontWeight: 800, color: "white", background: "var(--carta-accent)", padding: "3px 9px", borderRadius: 50 }}>-{discountPct}%</span>}
      </div>
      {/* Texto DERECHA */}
      <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 12px", paddingRight: 48, display: "flex", flexDirection: "column" }}>
        <h3 style={{ fontFamily: "var(--font-playfair, Georgia, serif)", fontSize: "1.05rem", fontWeight: 600, color: "var(--carta-text)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dish.name}</h3>
        {dish.description && (
          <p style={{ fontSize: "0.82rem", color: "var(--carta-text2)", lineHeight: 1.45, margin: "0 0 8px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{dish.description}</p>
        )}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--carta-accent)" }}>{formatCLP(effectivePrice)}</span>
          {discountPct > 0 && <span style={{ fontSize: "0.75rem", color: "var(--carta-text3)", textDecoration: "line-through" }}>{formatCLP(dish.price)}</span>}
        </div>
      </div>
      <div onClick={hasModifiers ? undefined : onDirectAdd} style={{ position: "absolute", bottom: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "color-mix(in srgb, var(--carta-accent) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--carta-accent) 50%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: hasModifiers ? "none" : "auto" }}>
        <Plus size={17} color="var(--carta-plus-icon, #fff)" />
      </div>
    </button>
  );
}

// ── Categories section — horizontal scroll idéntico a MoodSection de CartaImpact ──
function CategoriesSection({
  grouped, accent, isDark, scrollToCategory,
}: {
  grouped: { category: Category; dishes: Dish[] }[];
  accent: string;
  isDark: boolean;
  scrollToCategory: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (grouped.length < 3) return null;

  const handleTap = (id: string) => { setActiveId(id); scrollToCategory(id); };

  return (
    <section style={{ padding: "24px 14px 0", position: "relative", zIndex: 1 }}>
      <h2 style={{
        fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22,
        letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9,
        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.38)",
      }}>
        CATEGORÍAS
      </h2>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 10, overflowX: "auto",
            padding: "4px 0 16px", scrollbarWidth: "none",
            msOverflowStyle: "none", WebkitOverflowScrolling: "touch",
          } as React.CSSProperties}
        >
          {grouped.map(({ category, dishes }) => {
            const photo = dishes.find(d => d.photos?.[0])?.photos?.[0] ?? null;
            const isActive = activeId === category.id;
            return (
              <button
                key={category.id}
                onClick={() => handleTap(category.id)}
                style={{
                  width: 128, minWidth: 128, height: 148, borderRadius: 28,
                  position: "relative", overflow: "hidden",
                  padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  border: isActive
                    ? `1px solid color-mix(in srgb, ${accent} 90%, transparent)`
                    : `1px solid color-mix(in srgb, var(--carta-text) 14%, transparent)`,
                  background: "var(--carta-surface)", cursor: "pointer",
                  boxShadow: isActive
                    ? `0 0 28px color-mix(in srgb, ${accent} 20%, transparent), 0 4px 16px rgba(0,0,0,0.12)`
                    : "0 4px 16px rgba(0,0,0,0.08)",
                  flexShrink: 0,
                }}
              >
                {photo ? (
                  <img src={photo} alt={category.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 15%, var(--carta-surface)), color-mix(in srgb, ${accent} 5%, var(--carta-surface)))`,
                  }}>
                    <span style={{ fontSize: "2rem", opacity: 0.35 }}>🍽️</span>
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, background: photo ? "linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.72))" : "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.52))" }} />
                <b style={{
                  position: "relative", zIndex: 1, fontSize: 14, lineHeight: 1.15,
                  textShadow: "0 2px 14px #000", color: "white", textAlign: "left",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  display: "block", width: "100%",
                }}>{category.name}</b>
              </button>
            );
          })}
        </div>
        {scrolled && (
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 8, width: 20, background: `linear-gradient(to left, transparent, var(--carta-bg))`, pointerEvents: "none", opacity: 0.6 }} />
        )}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 8, width: 40, background: `linear-gradient(to right, transparent, var(--carta-bg))`, pointerEvents: "none" }} />
      </div>
    </section>
  );
}

type FilterKey = "popular" | "estrella" | "veggie" | "gluten-free";
const FILTER_OPTS: { key: FilterKey; emoji: string; label: string }[] = [
  { key: "popular", emoji: "🔥", label: "Popular" },
  { key: "estrella", emoji: "⭐", label: "Recomendado" },
  { key: "veggie", emoji: "🌿", label: "Vegano" },
  { key: "gluten-free", emoji: "🌾", label: "Sin gluten" },
];

const BH_DAY_LABELS: Record<string, string> = {
  "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves",
  "5": "Viernes", "6": "Sábado", "0": "Domingo",
};
const BH_ORDER = ["1", "2", "3", "4", "5", "6", "0"];

function fmt12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function ClosedBanner({ businessHours, inline, isDark, accent, innerRef }: { businessHours?: Record<string, BHDay> | null; inline?: boolean; isDark?: boolean; accent?: string; innerRef?: React.Ref<HTMLDivElement> }) {
  const [showModal, setShowModal] = useState(false);
  const bg = isDark ? "#111" : "#1a1a1a";
  const modalBg = isDark ? "#1e1e1e" : "#fff";
  const titleColor = isDark ? "#f0f0f0" : "#111";
  const dayColor = isDark ? "#ccc" : "#333";
  const timeColor = isDark ? "#f0f0f0" : "#111";
  const closeColor = isDark ? "#666" : "#999";
  const borderColor = isDark ? "#2a2a2a" : "#f0ece3";

  return (
    <>
      <div
        ref={innerRef}
        onClick={() => setShowModal(true)}
        style={{
          position: inline ? "relative" : "sticky", top: 0, zIndex: inline ? undefined : 100,
          background: bg, color: "#fff",
          padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 14 }}>🔒</span>
        <span style={{ fontFamily: FB, fontSize: "0.82rem", fontWeight: 600 }}>
          Este local está cerrado ahora
        </span>
        <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "#F4A623", textDecoration: "underline", flexShrink: 0 }}>
          Ver horarios →
        </span>
      </div>

      {showModal && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: modalBg, borderRadius: 20, width: "100%", maxWidth: 400, padding: "24px 20px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", maxHeight: "calc(100dvh - 40px)", overflowY: "auto", flexShrink: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontFamily: FB, fontSize: "1rem", fontWeight: 700, color: titleColor, margin: 0 }}>🕐 Horarios de atención</h3>
              <button onClick={() => setShowModal(false)} style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", border: "none", width: 28, height: 28, borderRadius: "50%", fontSize: 16, cursor: "pointer", color: closeColor, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {BH_ORDER.map((key, i) => {
                const day = businessHours?.[key];
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${borderColor}` }}>
                    <span style={{ fontFamily: FB, fontSize: "0.88rem", color: dayColor, fontWeight: 500 }}>{BH_DAY_LABELS[key]}</span>
                    {day?.open ? (
                      <span style={{ fontFamily: FB, fontSize: "0.85rem", color: timeColor, fontWeight: 600 }}>
                        {fmt12(day.from)} – {day.to === "00:00" ? "Medianoche" : fmt12(day.to)}
                      </span>
                    ) : (
                      <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "#e11d48", fontWeight: 500 }}>Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function checkIsClosedNow(bh: Record<string, BHDay> | null | undefined): boolean {
  if (!bh || typeof bh !== "object") return false;
  try {
    const chileStr = new Date().toLocaleString("en-US", { timeZone: "America/Santiago" });
    const chileNow = new Date(chileStr);
    const day = String(chileNow.getDay());
    const dayConfig = bh[day];
    if (!dayConfig || !dayConfig.open) return true;
    const nowMins = chileNow.getHours() * 60 + chileNow.getMinutes();
    const parseMins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
    const fromMins = parseMins(dayConfig.from || "00:00");
    const rawTo = dayConfig.to || "23:59";
    const toMins = rawTo === "00:00" ? 1440 : parseMins(rawTo);
    return fromMins <= toMins
      ? nowMins < fromMins || nowMins >= toMins
      : nowMins < fromMins && nowMins >= toMins;
  } catch { return false; }
}

// ── Modal Identificarse: login del cliente por código OTP (reutiliza QRUser + cookie qr_user_id) ──
function IdentifyModal({
  customer, accent, accentFg, themeVars, onClose, onSuccess, onLogout,
}: {
  customer: { name: string | null; email: string } | null;
  accent: string;
  accentFg: string;
  themeVars: React.CSSProperties;
  onClose: () => void;
  onSuccess: (u: { name: string | null; email: string }) => void;
  onLogout: () => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    const clean = email.toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setError("Ingresa un email válido."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/qr/user/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: clean }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No pudimos enviar el código.");
      if (d.devCode) setCode(d.devCode); // solo en entorno local (sin Resend)
      setStep("code");
    } catch (e: any) { setError(e.message || "Error al enviar el código."); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    const clean = code.trim();
    if (!/^\d{6}$/.test(clean)) { setError("El código son 6 dígitos."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/qr/user/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.toLowerCase().trim(), code: clean }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Código incorrecto.");
      onSuccess(d.user);
    } catch (e: any) { setError(e.message || "Código incorrecto."); }
    finally { setLoading(false); }
  };

  const logout = async () => {
    setLoading(true);
    try { await fetch("/api/qr/user/logout", { method: "DELETE" }); } catch {}
    setLoading(false);
    onLogout();
  };

  const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--carta-border)", background: "var(--carta-surface)", color: "var(--carta-text)", fontSize: 16, outline: "none" };
  const btnStyle: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 12, border: "none", background: accent, color: accentFg, fontSize: "0.95rem", fontWeight: 800, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--carta-bg)", color: "var(--carta-text)", width: "100%", maxWidth: 440, borderRadius: "20px 20px 0 0", padding: "22px 20px calc(24px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)", fontFamily: FB, ...themeVars }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-playfair, Georgia, serif)", fontSize: "1.25rem", fontWeight: 800 }}>
            {customer ? "Mi cuenta" : step === "email" ? "Identifícate" : "Ingresa tu código"}
          </h3>
          <button onClick={onClose} style={{ background: "var(--carta-surface)", border: "1px solid var(--carta-border)", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", color: "var(--carta-text2)", display: "grid", placeItems: "center" }}><X size={16} /></button>
        </div>

        {customer ? (
          <>
            <p style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700 }}>{customer.name || "¡Hola!"}</p>
            <p style={{ margin: "0 0 18px", color: "var(--carta-text2)", fontSize: "0.88rem" }}>{customer.email}</p>
            <button onClick={logout} disabled={loading} style={{ ...btnStyle, background: "transparent", color: "var(--carta-text)", border: "1px solid var(--carta-border)" }}>Cerrar sesión</button>
          </>
        ) : step === "email" ? (
          <>
            <p style={{ margin: "0 0 16px", color: "var(--carta-text2)", fontSize: "0.9rem", lineHeight: 1.5 }}>Inicia sesión con tu email. Te enviaremos un código para ingresar.</p>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--carta-text2)", marginBottom: 6 }}>Email</label>
            <input type="email" inputMode="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCode()} placeholder="tucorreo@email.com" style={{ ...inputStyle, marginBottom: error ? 8 : 14 }} />
            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "0 0 12px" }}>{error}</p>}
            <button onClick={sendCode} disabled={loading} style={btnStyle}>{loading ? "Enviando…" : "Enviar código"}</button>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 16px", color: "var(--carta-text2)", fontSize: "0.9rem", lineHeight: 1.5 }}>Enviamos un código de 6 dígitos a <strong>{email.toLowerCase().trim()}</strong>. Revisa también spam.</p>
            <input inputMode="numeric" autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => e.key === "Enter" && verify()} placeholder="000000" style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: 800, marginBottom: error ? 8 : 14 }} />
            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "0 0 12px" }}>{error}</p>}
            <button onClick={verify} disabled={loading} style={btnStyle}>{loading ? "Verificando…" : "Ingresar"}</button>
            <button onClick={() => { setStep("email"); setCode(""); setError(""); }} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--carta-text2)", fontSize: "0.82rem", cursor: "pointer", fontFamily: FB }}>← Cambiar email</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function OrderMenuPage({ restaurant, orderingConfig, popularDishIds, isClosed: isClosedProp = false, businessHours }: Props) {
  const { items, count, addItem } = useCart();
  const [selectedDish, setSelectedDish] = useState<DishForOrder | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const isClosed = isClosedProp;
  const popularSet = useMemo(() => new Set(popularDishIds || []), [popularDishIds]);
  const toggleFilter = (k: FilterKey) => setActiveFilters(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k]);

  // El diseño de /pedir respeta el cartaView del restaurante: "impact" = diseño liquid glass
  // (header semi-transparente, hero banner, tarjetas glass); cualquier otro = vista lista/grid.
  const isImpact = (orderingConfig.cartaView || "lista") === "impact";
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [customer, setCustomer] = useState<{ name: string | null; email: string } | null>(null);
  useEffect(() => {
    fetch("/api/qr/user/me").then(r => r.json()).then(d => { if (d?.user) setCustomer({ name: d.user.name, email: d.user.email }); }).catch(() => {});
  }, []);
  const isDark = (orderingConfig.cartaColorMode || "LIGHT") === "DARK";
  const accent = orderingConfig.cartaAccentColor || "#F4A623";
  const accentFg = accentContrast(accent);
  // Banner de destacados activo → diseño original (logo en el banner, carrito+buscar en el nav, sin header).
  const showFeatured = orderingConfig.showFeatured !== false;

  const themeVars: React.CSSProperties = isDark ? {
    "--carta-bg": "#0e0e0e", "--carta-surface": "#1a1a1a",
    "--carta-text": "#f0f0f0", "--carta-text2": "#aaa", "--carta-text3": "#555",
    "--carta-border": "#262626", "--carta-accent": accent, "--carta-accent-fg": accentFg,
    "--carta-card-bg": "#1a1a1a", "--carta-card-shadow": "0 1px 8px rgba(0,0,0,0.4)",
    "--carta-photo-bg": "#222", "--carta-plus-icon": "#fff", "--carta-btn-text": "#fff",
  } as React.CSSProperties : {
    "--carta-bg": "#FAFAF8", "--carta-surface": "#fff",
    "--carta-text": "#111", "--carta-text2": "#666", "--carta-text3": "#999",
    "--carta-border": "#ece9e3", "--carta-accent": accent, "--carta-accent-fg": accentFg,
    "--carta-card-bg": "#fff", "--carta-card-shadow": "0 1px 8px rgba(0,0,0,0.07)",
    "--carta-photo-bg": "#f0ece6", "--carta-plus-icon": accent, "--carta-btn-text": accent,
  } as React.CSSProperties;

  const activeDishes = restaurant.dishes.filter(d => d.isActive && !d.deletedAt);
  const activeCatIds = new Set(activeDishes.map(d => d.categoryId));
  const categories = restaurant.categories.filter(c => activeCatIds.has(c.id));

  // Hero dishes: isHero (incl. promos destacadas) con foto; si no hay, nada
  const heroDishes = useMemo(() => {
    const hero = activeDishes.filter(d => (d as any).isHero && d.photos?.[0]);
    return hero.length > 0 ? hero.slice(0, 5) : [];
  }, [activeDishes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = activeDishes.filter(d => {
      if (q && !d.name.toLowerCase().includes(q) && !(d.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
    if (activeFilters.includes("popular")) result = result.filter(d => popularSet.has(d.id));
    if (activeFilters.includes("estrella")) result = result.filter(d => (d.tags || []).includes("RECOMMENDED"));
    if (activeFilters.includes("veggie")) result = result.filter(d => d.dishDiet === "VEGAN" || d.dishDiet === "VEGETARIAN");
    if (activeFilters.includes("gluten-free")) result = result.filter(d => d.isGlutenFree === true);
    return result;
  }, [activeDishes, search, activeFilters, popularSet]);

  const grouped = useMemo(() => {
    const map = new Map<string, Dish[]>();
    for (const d of filtered) {
      const arr = map.get(d.categoryId) || [];
      arr.push(d);
      map.set(d.categoryId, arr);
    }
    return categories.filter(c => map.has(c.id)).map(c => ({ category: c, dishes: map.get(c.id)! }));
  }, [filtered, categories]);

  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");

  // Impact refs
  const impactHeaderRef = useRef<HTMLDivElement>(null);
  const [impactHeaderH, setImpactHeaderH] = useState(65);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const [showFixedCatNav, setShowFixedCatNav] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);
  const fixedChipsRef = useRef<HTMLDivElement>(null);
  const fixedActiveChipRef = useRef<HTMLButtonElement>(null);

  // Lista refs
  const stickyNavRef = useRef<HTMLDivElement>(null);
  const [stickyNavH, setStickyNavH] = useState(50);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<HTMLButtonElement>(null);
  // Banner "cerrado": medimos su altura para que el nav sticky se pegue DEBAJO y no quede tapado.
  const closedBannerRef = useRef<HTMLDivElement>(null);
  const [closedBannerH, setClosedBannerH] = useState(0);

  useEffect(() => {
    if (!isImpact) return;
    const el = impactHeaderRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setImpactHeaderH(el.offsetHeight));
    obs.observe(el);
    setImpactHeaderH(el.offsetHeight);
    return () => obs.disconnect();
  }, [isImpact]);

  useEffect(() => {
    if (isImpact) return;
    const el = stickyNavRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setStickyNavH(el.offsetHeight));
    obs.observe(el);
    setStickyNavH(el.offsetHeight);
    return () => obs.disconnect();
  }, [isImpact]);

  useEffect(() => {
    if (isImpact || !isClosed) { setClosedBannerH(0); return; }
    const el = closedBannerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setClosedBannerH(el.offsetHeight));
    obs.observe(el);
    setClosedBannerH(el.offsetHeight);
    return () => obs.disconnect();
  }, [isImpact, isClosed]);

  useEffect(() => {
    if (!isImpact) return;
    let shown = false;
    const check = () => {
      const el = menuAnchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!shown && rect.top < 60) { shown = true; setShowFixedCatNav(true); }
      else if (shown && rect.top > 110) { shown = false; setShowFixedCatNav(false); }
    };
    const tid = setTimeout(() => window.addEventListener("scroll", check, { passive: true }), 400);
    return () => { clearTimeout(tid); window.removeEventListener("scroll", check); };
  }, [isImpact]);

  useEffect(() => {
    if (isImpact) {
      const chip = activeChipRef.current; const cont = chipsRef.current;
      if (chip && cont) cont.scrollTo({ left: chip.offsetLeft - cont.offsetWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
      const fchip = fixedActiveChipRef.current; const fcont = fixedChipsRef.current;
      if (fchip && fcont) fcont.scrollTo({ left: fchip.offsetLeft - fcont.offsetWidth / 2 + fchip.offsetWidth / 2, behavior: "smooth" });
    } else {
      const chip = activeCatRef.current; const cont = catScrollRef.current;
      if (chip && cont) cont.scrollTo({ left: chip.offsetLeft - cont.offsetWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
    }
  }, [activeCategory, isImpact]);

  useEffect(() => {
    const prefix = isImpact ? "impact-cat" : "lista-cat";
    const observers: IntersectionObserver[] = [];
    for (const { category } of grouped) {
      const el = document.getElementById(`${prefix}-${category.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActiveCategory(category.id); }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(o => o.disconnect());
  }, [grouped, isImpact]);

  const scrollToCategory = (catId: string) => {
    const prefix = isImpact ? "impact-cat" : "lista-cat";
    const el = document.getElementById(`${prefix}-${catId}`);
    if (!el) return;
    const offset = isImpact ? impactHeaderH + 10 : stickyNavH + closedBannerH + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  };

  const addDirectly = (dish: Dish) => {
    if (isClosed) return;
    const effectivePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
    addItem({ dishId: dish.id, dishName: dish.name, dishPrice: effectivePrice, imageUrl: dish.photos?.[0] || null, quantity: 1, selectedOptions: [], unitTotal: effectivePrice, notes: "" });
  };

  const handleAddItem = ({ selectedOptions, quantity, notes }: { selectedOptions: SelectedOption[]; quantity: number; notes: string }) => {
    if (!selectedDish) return;
    const priceAdj = selectedOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    const effectivePrice = selectedDish.discountPrice != null && selectedDish.discountPrice < selectedDish.price ? selectedDish.discountPrice : selectedDish.price;
    addItem({ dishId: selectedDish.id, dishName: selectedDish.name, dishPrice: effectivePrice, imageUrl: selectedDish.photos?.[0] || null, quantity, selectedOptions, unitTotal: effectivePrice + priceAdj, notes });
    setSelectedDish(null);
  };

  const cartTotal = formatCLP(items.reduce((s, i) => s + i.unitTotal * i.quantity, 0));

  const chipStyle = (isActive: boolean): React.CSSProperties => ({
    whiteSpace: "nowrap", flexShrink: 0,
    border: isActive ? "1px solid color-mix(in srgb, var(--carta-accent) 55%, transparent)" : `1px solid ${isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)"}`,
    background: isActive ? "color-mix(in srgb, var(--carta-accent) 10%, transparent)" : (isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)"),
    borderRadius: 999, color: isActive ? (isDark ? "#fff" : accent) : (isDark ? "#777" : "#999"),
    fontWeight: 800, cursor: "pointer",
  });

  // ─── IMPACT LAYOUT ────────────────────────────────────────────────────────
  if (isImpact) {
    return (
      <div className="min-h-screen" style={{ background: "var(--carta-bg)", fontFamily: FB, ...themeVars }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
          @keyframes shimmer { 0%,100%{transform:translateX(-100%)} 50%{transform:translateX(100%)} }
          /* Grid ecommerce: 2 columnas en mobile, 4 en escritorio */
          .qc-prod-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          @media (min-width: 1024px) { .qc-prod-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; } }
        `}</style>
        {/* Ambient bg */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: `radial-gradient(circle at 70% 0%, color-mix(in srgb, ${accent} ${isDark ? "28%" : "18%"}, transparent), transparent 30%), radial-gradient(circle at 8% 28%, color-mix(in srgb, ${accent} ${isDark ? "15%" : "10%"}, transparent), transparent 36%), radial-gradient(circle at 90% 72%, color-mix(in srgb, ${accent} 5%, transparent), transparent 26%), linear-gradient(var(--carta-bg), var(--carta-bg))` }} />
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: isDark ? 0.22 : 0.12, backgroundImage: `linear-gradient(rgba(${isDark ? "255,255,255" : "0,0,0"},0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(${isDark ? "255,255,255" : "0,0,0"},0.035) 1px, transparent 1px)`, backgroundSize: "38px 38px", maskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)" }} />
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: isDark ? 0.5 : 0.35, background: `radial-gradient(ellipse at 50% 8%, color-mix(in srgb, ${accent} 16%, transparent), transparent 32%), radial-gradient(ellipse at 70% 24%, color-mix(in srgb, ${accent} 10%, transparent), transparent 28%)`, filter: "blur(10px)" }} />

        {/* Fixed glass header */}
        <div ref={impactHeaderRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: isDark ? "rgba(3,3,3,0.32)" : "rgba(250,250,248,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          {isClosed && <ClosedBanner businessHours={businessHours} inline isDark={isDark} accent={accent} />}
          <header style={{ padding: "calc(10px + env(safe-area-inset-top)) 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 }}>
              <a href={`/qr/${restaurant.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                {restaurant.logoUrl ? (
                  <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 34, height: 34, borderRadius: 10, objectFit: "contain" }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: accent, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800, color: isDark ? "#0e0e0e" : "#fff", flexShrink: 0 }}>
                    {restaurant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontWeight: 800, fontSize: 18, color: isDark ? "#fff" : "var(--carta-text)", letterSpacing: "-0.3px" }}>{restaurant.name}</span>
              </a>
              <button onClick={() => setCartOpen(true)} style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", border: `1px solid ${isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)"}`, background: count > 0 ? accent : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"), display: "grid", placeItems: "center", cursor: "pointer" }}>
                <ShoppingCart size={17} color={count > 0 ? "#fff" : (isDark ? "#aaa" : "#666")} />
                {count > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 17, height: 17, borderRadius: "50%", background: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
              </button>
            </div>
            {/* Slide-in fixed chips */}
            <div style={{ overflow: "hidden", maxHeight: showFixedCatNav ? 50 : 0, transition: "max-height 0.25s ease" }}>
              <div ref={fixedChipsRef} style={{ padding: "0 0 10px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {grouped.map(({ category: cat }) => {
                  const isActive = cat.id === activeCategory;
                  return <button key={cat.id} ref={isActive ? fixedActiveChipRef : null} onClick={() => { setActiveCategory(cat.id); scrollToCategory(cat.id); }} style={{ ...chipStyle(isActive), padding: "9px 14px", fontSize: 14 }}>{cat.name}</button>;
                })}
              </div>
            </div>
          </header>
        </div>

        <div style={{ height: impactHeaderH }} />

        {/* Hero con fotos de platos */}
        <div style={{ position: "relative", zIndex: 1, paddingTop: 14, paddingBottom: 14 }}>
          <ImpactHero heroDishes={heroDishes} restaurantName={restaurant.name} accent={accent} onDishSelect={d => setSelectedDish(d as unknown as DishForOrder)} onDirectAdd={addDirectly} />
        </div>

        {/* Categories grid */}
        <CategoriesSection grouped={grouped} accent={accent} isDark={isDark} scrollToCategory={scrollToCategory} />

        {/* Título MENÚ + search */}
        <div style={{ position: "relative", zIndex: 1, padding: "24px 14px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, letterSpacing: "0.8px", margin: 0, lineHeight: 0.9, color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.38)", flex: searchOpen ? "0 0 0" : 1, overflow: "hidden", opacity: searchOpen ? 0 : 1, transition: "flex 0.22s ease, opacity 0.15s ease", whiteSpace: "nowrap" }}>
            {(restaurant as any).sectionTitleMenu || "MENÚ"}
          </h2>
          <div style={{ flex: searchOpen ? 1 : "0 0 0", overflow: "hidden", opacity: searchOpen ? 1 : 0, transition: "flex 0.22s ease, opacity 0.18s ease", display: "flex", alignItems: "center", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", borderRadius: 999, padding: "0 12px", border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"}`, width: "100%" }}>
              <Search size={14} color={isDark ? "rgba(255,255,255,0.5)" : "#999"} style={{ flexShrink: 0 }} />
              <input id="impact-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ flex: 1, border: "none", outline: "none", fontSize: "15px", color: isDark ? "#fff" : "#111", background: "transparent", minWidth: 0 }} />
            </div>
          </div>
          <button onClick={() => { if (searchOpen) { setSearchOpen(false); setSearch(""); } else { setSearchOpen(true); setTimeout(() => document.getElementById("impact-search")?.focus(), 250); } }} style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"}`, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
            {searchOpen ? <X size={15} color={isDark ? "#fff" : "#333"} /> : <Search size={15} color={isDark ? "#fff" : "#333"} />}
          </button>
        </div>

        {/* Filter bar */}
        {(restaurant as any).filterBarEnabled !== false && <div style={{ position: "relative", zIndex: 1, padding: "0 14px 10px", overflowX: "auto", scrollbarWidth: "none" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {FILTER_OPTS.map(f => {
              const isActive = activeFilters.includes(f.key);
              const activeColor = f.key === "popular" ? "#ef4444" : f.key === "veggie" ? "#16a34a" : f.key === "gluten-free" ? "#ca8a04" : accent;
              return (
                <button key={f.key} onClick={() => toggleFilter(f.key)} style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 999, fontSize: 14, fontWeight: isActive ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                  background: isActive ? (f.key === "popular" ? `color-mix(in srgb, #ef4444 14%, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"})` : f.key === "veggie" ? `color-mix(in srgb, #16a34a 14%, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"})` : f.key === "gluten-free" ? `color-mix(in srgb, #ca8a04 14%, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"})` : `color-mix(in srgb, ${accent} 15%, ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"})`): (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
                  border: isActive ? (f.key === "popular" ? "1px solid rgba(239,68,68,0.45)" : f.key === "veggie" ? "1px solid rgba(22,163,74,0.45)" : f.key === "gluten-free" ? "1px solid rgba(202,138,4,0.45)" : `1px solid color-mix(in srgb, ${accent} 50%, transparent)`) : `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}`,
                  color: isActive ? activeColor : (isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.5)"),
                }}>
                  <span>{f.emoji}</span>{f.label}
                </button>
              );
            })}
          </div>
        </div>}

        {/* Category chips inline — se desvanecen cuando aparecen los chips fijos del header,
            para no verse "duplicados" a través del header glass al hacer scroll. */}
        <div ref={menuAnchorRef} style={{ position: "relative", zIndex: 1, padding: "0 14px 6px", opacity: showFixedCatNav ? 0 : 1, pointerEvents: showFixedCatNav ? "none" : "auto", transition: "opacity 0.2s ease" }}>
          <div ref={chipsRef} style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "4px 0" }}>
            {grouped.map(({ category: cat }) => {
              const isActive = cat.id === activeCategory;
              return <button key={cat.id} ref={isActive ? activeChipRef : null} onClick={() => { setActiveCategory(cat.id); scrollToCategory(cat.id); }} style={{ ...chipStyle(isActive), padding: "11px 20px", fontSize: 15, transition: "all 0.2s ease" }}>{cat.name}</button>;
            })}
          </div>
          <div style={{ position: "absolute", top: 0, right: 14, bottom: 0, width: 24, background: "linear-gradient(to right, transparent, var(--carta-bg))", pointerEvents: "none" }} />
        </div>

        {/* Platos */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 14px 120px" }}>
          {grouped.length === 0 ? (
            <div style={{ padding: "64px 28px", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
              <p style={{ color: isDark ? "#aaa" : "#999", fontSize: "0.95rem" }}>No encontramos platos con &ldquo;{search}&rdquo;</p>
              <button onClick={() => { setSearch(""); setActiveFilters([]); }} style={{ marginTop: 12, fontSize: "0.88rem", color: accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Limpiar filtros</button>
            </div>
          ) : (
            grouped.map(({ category, dishes }) => (
              <div key={category.id} id={`impact-cat-${category.id}`} style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)", margin: "33px 0 14px", letterSpacing: "0.6px", lineHeight: 0.9 }}>{category.name}</h3>
                {dishes.map(dish => (
                  <ImpactCard key={dish.id} dish={dish} onClick={() => setSelectedDish(dish as unknown as DishForOrder)} onDirectAdd={e => { e.stopPropagation(); addDirectly(dish); }} />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Cart bar */}
        {count > 0 && !isClosed && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80, padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", background: isDark ? "rgba(3,3,3,0.8)" : "rgba(250,250,248,0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid var(--carta-border)" }}>
            <button onClick={() => setCartOpen(true)} style={{ width: "100%", padding: "13px 18px", borderRadius: 14, border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`, background: `color-mix(in srgb, ${accent} 18%, ${isDark ? "rgba(3,3,3,0.75)" : "rgba(250,250,248,0.85)"})`, color: "var(--carta-btn-text, #fff)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 520, margin: "0 auto", boxShadow: `0 4px 24px color-mix(in srgb, ${accent} 50%, transparent), inset 0 0 12px color-mix(in srgb, ${accent} 8%, transparent)`, fontFamily: FB }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: `color-mix(in srgb, ${accent} 25%, transparent)`, fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Ver carrito</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{cartTotal}</span>
            </button>
          </div>
        )}

        {selectedDish && <OrderItemModal dish={selectedDish} onClose={() => setSelectedDish(null)} onAdd={handleAddItem} isClosed={isClosed} />}
        {cartOpen && !checkoutOpen && <OrderCart onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
        {checkoutOpen && <OrderCheckout restaurantName={restaurant.name} restaurantSlug={restaurant.slug} orderingConfig={orderingConfig} orderingMode={orderingConfig.orderingMode} onBack={() => { setCheckoutOpen(false); setCartOpen(true); }} onClose={() => setCheckoutOpen(false)} />}
      </div>
    );
  }

  // ─── LISTA LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--carta-bg)", fontFamily: FB, ...themeVars }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800;900&display=swap');
        @keyframes shimmer { 0%,100%{transform:translateX(-100%)} 50%{transform:translateX(100%)} }
        /* Grid ecommerce: 2 columnas en mobile, 4 en escritorio */
        .qc-prod-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        @media (min-width: 1024px) { .qc-prod-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; } }
        /* En mobile mostramos solo el logo (sin el nombre del local) */
        @media (max-width: 640px) { .qc-header-name { display: none; } }
      `}</style>

      {/* Banner de cerrado */}
      {isClosed && <ClosedBanner innerRef={closedBannerRef} businessHours={businessHours} isDark={isDark} accent={accent} />}

      {/* Header (SOLO cuando el banner está oculto; con banner el logo va dentro del banner) */}
      {!showFeatured && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "var(--carta-bg)", borderBottom: "1px solid var(--carta-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: 800, color: accentFg, flexShrink: 0 }}>{restaurant.name.charAt(0).toUpperCase()}</div>
            )}
            <span className="qc-header-name" style={{ fontFamily: "var(--font-playfair, Georgia, serif)", fontSize: "1.08rem", fontWeight: 700, color: "var(--carta-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{restaurant.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {(orderingConfig.showIdentify || customer) && (
              <button onClick={() => setIdentifyOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: customer ? `1px solid color-mix(in srgb, ${accent} 45%, transparent)` : "1px solid var(--carta-border)", background: customer ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent", color: customer ? accent : "var(--carta-text)", cursor: "pointer", fontFamily: FB, fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                <User size={15} /> {customer ? (customer.name?.trim().split(" ")[0] || "Mi cuenta") : "Identificarse"}
              </button>
            )}
            <button onClick={() => !isClosed && setCartOpen(true)} style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", border: "1px solid var(--carta-border)", background: count > 0 && !isClosed ? accent : "transparent", display: "grid", placeItems: "center", cursor: isClosed ? "default" : "pointer", flexShrink: 0 }}>
              <ShoppingCart size={17} color={count > 0 && !isClosed ? accentFg : "var(--carta-text2)"} />
              {count > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: accent, color: accentFg, fontSize: "0.6rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--carta-bg)" }}>{count}</span>}
            </button>
          </div>
        </header>
      )}

      {/* Banner de destacados (con el logo dentro — diseño original) */}
      {showFeatured && (
        <ListaHero heroDishes={heroDishes} restaurant={restaurant} accent={accent} onDishSelect={d => setSelectedDish(d as unknown as DishForOrder)} onDirectAdd={addDirectly} />
      )}

      {/* Categorías con foto (opcional desde config; por defecto activas) */}
      {orderingConfig.categoryPhotos !== false && (
        <CategoriesSection grouped={grouped} accent={accent} isDark={isDark} scrollToCategory={scrollToCategory} />
      )}

      {/* Sticky nav: categorías (con banner activo lleva carrito + buscar, como el diseño original) */}
      <div ref={stickyNavRef} style={{ position: "sticky", top: closedBannerH, zIndex: 20, background: "var(--carta-bg)", borderBottom: "1px solid var(--carta-border)", transform: "translateZ(0)" }}>
        {showFeatured && searchOpen ? (
          <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
            <Search size={16} color="var(--carta-text2)" style={{ flexShrink: 0 }} />
            <input autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos..." style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "var(--carta-text)", background: "transparent" }} />
            <button onClick={() => { setSearchOpen(false); setSearch(""); }} style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}><X size={18} color="var(--carta-text2)" /></button>
          </div>
        ) : (
          <nav style={{ display: "flex", alignItems: "center" }}>
            <div ref={catScrollRef} style={{ flex: 1, paddingLeft: 12, paddingRight: showFeatured ? 8 : 12, paddingTop: 8, paddingBottom: 8, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", maskImage: "linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)" }}>
              {grouped.map(({ category: cat }) => {
                const isActive = cat.id === activeCategory;
                return (
                  <button key={cat.id} ref={isActive ? activeCatRef : null}
                    onClick={() => { setActiveCategory(cat.id); scrollToCategory(cat.id); }}
                    style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "9px 18px", borderRadius: 999, fontSize: 15, fontWeight: isActive ? 700 : 500, color: isActive ? accent : "var(--carta-text3)", background: isActive ? `color-mix(in srgb, ${accent} 10%, transparent)` : "transparent", border: isActive ? `1px solid color-mix(in srgb, ${accent} 45%, transparent)` : "1px solid var(--carta-border)", cursor: "pointer", transition: "all 0.15s ease" }}
                  >{cat.name}</button>
                );
              })}
            </div>
            {showFeatured && (
              <div style={{ flexShrink: 0, paddingRight: 8, paddingLeft: 4, display: "flex", alignItems: "center", gap: 4 }}>
                {(orderingConfig.showIdentify || customer) && (
                  <button onClick={() => setIdentifyOpen(true)} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: customer ? `color-mix(in srgb, ${accent} 15%, transparent)` : "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
                    <User size={17} color={customer ? accent : "var(--carta-text2)"} />
                  </button>
                )}
                <button onClick={() => !isClosed && setCartOpen(true)} style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", border: "none", background: count > 0 && !isClosed ? accent : "transparent", display: "grid", placeItems: "center", cursor: isClosed ? "default" : "pointer" }}>
                  <ShoppingCart size={16} color={count > 0 ? "#fff" : "var(--carta-text2)"} />
                  {count > 0 && <span style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.55rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
                </button>
                <button onClick={() => setSearchOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 4, cursor: "pointer" }}>
                  <Search size={17} color="var(--carta-text2)" />
                </button>
              </div>
            )}
          </nav>
        )}
      </div>

      {/* Buscador de productos dedicado (SOLO cuando el banner está oculto) */}
      {!showFeatured && (
        <div style={{ padding: "10px 14px 4px", background: "var(--carta-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--carta-surface)", border: "1px solid var(--carta-border)" }}>
            <Search size={17} color="var(--carta-text3)" style={{ flexShrink: 0 }} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos..." style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: "16px", color: "var(--carta-text)", background: "transparent" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}><X size={16} color="var(--carta-text3)" /></button>}
          </div>
        </div>
      )}

      {/* Filter bar */}
      {(restaurant as any).filterBarEnabled !== false && <div style={{ padding: "10px 12px 4px", overflowX: "auto", scrollbarWidth: "none", display: "flex", gap: 7, borderBottom: "1px solid var(--carta-border)" }}>
        {FILTER_OPTS.map(f => {
          const isActive = activeFilters.includes(f.key);
          const activeColor = f.key === "popular" ? "#ef4444" : f.key === "veggie" ? "#16a34a" : f.key === "gluten-free" ? "#ca8a04" : accent;
          return (
            <button key={f.key} onClick={() => toggleFilter(f.key)} style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 999, fontSize: 14, fontWeight: isActive ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
              background: isActive ? (f.key === "popular" ? "color-mix(in srgb, #ef4444 14%, var(--carta-bg))" : f.key === "veggie" ? "color-mix(in srgb, #16a34a 14%, var(--carta-bg))" : f.key === "gluten-free" ? "color-mix(in srgb, #ca8a04 14%, var(--carta-bg))" : `color-mix(in srgb, ${accent} 15%, var(--carta-bg))`) : `color-mix(in srgb, var(--carta-text) 6%, var(--carta-bg))`,
              border: isActive ? (f.key === "popular" ? "1px solid rgba(239,68,68,0.45)" : f.key === "veggie" ? "1px solid rgba(22,163,74,0.45)" : f.key === "gluten-free" ? "1px solid rgba(202,138,4,0.45)" : `1px solid color-mix(in srgb, ${accent} 50%, transparent)`) : `1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)`,
              color: isActive ? activeColor : "var(--carta-text2)",
            }}>
              <span>{f.emoji}</span>{f.label}
            </button>
          );
        })}
      </div>}

      {/* Categories */}
      {grouped.length === 0 ? (
        <div style={{ padding: "64px 28px", textAlign: "center" }}>
          <p style={{ color: "var(--carta-text2)", fontSize: "0.9rem" }}>No encontramos platos que coincidan.</p>
          <button onClick={() => { setSearch(""); setActiveFilters([]); }} style={{ marginTop: 12, fontSize: "0.88rem", color: accent, fontWeight: 600, background: `color-mix(in srgb, ${accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, padding: "8px 18px", borderRadius: 999, cursor: "pointer" }}>Ver todos los platos</button>
        </div>
      ) : (
        grouped.map(({ category, dishes }, index) => {
          const twoCol = orderingConfig.columns === "two";
          return (
            <section key={category.id} id={`lista-cat-${category.id}`} style={{ maxWidth: twoCol ? 1200 : 680, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: `${index === 0 ? 4 : 12}px 12px 0` }}>
              <div style={{ padding: "0 8px", margin: "14px 0 10px" }}>
                <h2 style={{ fontFamily: "var(--font-playfair, Georgia, serif)", fontSize: "1.3rem", fontWeight: 600, color: "var(--carta-text2)" }}>{category.name}</h2>
              </div>
              {twoCol ? (
                <div className="qc-prod-grid">
                  {dishes.map(dish => <GridCard key={dish.id} dish={dish} onClick={() => setSelectedDish(dish as unknown as DishForOrder)} onDirectAdd={e => { e.stopPropagation(); addDirectly(dish); }} />)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {dishes.map(dish => <ListaRowCard key={dish.id} dish={dish} onClick={() => setSelectedDish(dish as unknown as DishForOrder)} onDirectAdd={e => { e.stopPropagation(); addDirectly(dish); }} />)}
                </div>
              )}
            </section>
          );
        })
      )}
      <div style={{ height: 120 }} />

      {/* Cart bar */}
      {count > 0 && !isClosed && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80, padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", background: "var(--carta-bg)", borderTop: "1px solid var(--carta-border)" }}>
          <button onClick={() => setCartOpen(true)} style={{ width: "100%", padding: "13px 18px", borderRadius: 14, border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`, background: `color-mix(in srgb, ${accent} 16%, ${isDark ? "rgba(10,10,10,0.82)" : "rgba(250,250,248,0.92)"})`, color: "var(--carta-btn-text, #fff)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 520, margin: "0 auto", boxShadow: `0 4px 24px color-mix(in srgb, ${accent} 48%, transparent)`, fontFamily: FB }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: `color-mix(in srgb, ${accent} 22%, transparent)`, fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Ver carrito</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{cartTotal}</span>
          </button>
        </div>
      )}

      {selectedDish && <OrderItemModal dish={selectedDish} onClose={() => setSelectedDish(null)} onAdd={handleAddItem} isClosed={isClosed} />}
      {cartOpen && !checkoutOpen && <OrderCart onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
      {checkoutOpen && <OrderCheckout restaurantName={restaurant.name} restaurantSlug={restaurant.slug} orderingConfig={orderingConfig} orderingMode={orderingConfig.orderingMode} onBack={() => { setCheckoutOpen(false); setCartOpen(true); }} onClose={() => setCheckoutOpen(false)} />}

      {/* Modal Identificarse — login del cliente por código OTP (reutiliza QRUser) */}
      {identifyOpen && (
        <IdentifyModal
          customer={customer}
          accent={accent}
          accentFg={accentFg}
          themeVars={themeVars}
          onClose={() => setIdentifyOpen(false)}
          onSuccess={u => { setCustomer(u); setIdentifyOpen(false); }}
          onLogout={() => { setCustomer(null); setIdentifyOpen(false); }}
        />
      )}
    </div>
  );
}
