"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { ShoppingCart, Search, X, Plus } from "lucide-react";
import { useCart } from "./OrderCartContext";
import OrderItemModal, { type DishForOrder } from "./OrderItemModal";
import OrderCart from "./OrderCart";
import OrderCheckout from "./OrderCheckout";
import type { SelectedOption } from "./OrderCartContext";

const FB = "var(--font-body, system-ui)";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

interface Category { id: string; name: string; }
interface Dish {
  id: string; name: string; description?: string | null;
  price: number; discountPrice?: number | null; photos?: string[]; categoryId: string;
  isActive: boolean; deletedAt?: Date | null;
  modifierTemplates: any[];
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
}
interface Props { restaurant: Restaurant; orderingConfig: OrderingConfig; }

// ── Impact card (replica exacta de ImpactDishCard) ───────────────────────────
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
      {/* Photo */}
      <div style={{
        position: "relative", width: 118, height: 118, borderRadius: 20, overflow: "hidden", flexShrink: 0,
        background: dish.photos?.[0] ? "#222" : "linear-gradient(145deg, color-mix(in srgb, var(--carta-accent) 15%, var(--carta-surface)), color-mix(in srgb, var(--carta-accent) 5%, var(--carta-surface)))",
      }}>
        {dish.photos?.[0] ? (
          <img src={dish.photos[0]} alt={dish.name} loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem" }}>🍽️</div>
        )}
      </div>

      {/* Info */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, paddingRight: 38 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--carta-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {dish.name}
        </h4>
        {dish.description && (
          <p style={{ margin: "0 0 8px", color: "var(--carta-text-muted, #888)", fontSize: 14, lineHeight: 1.42, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {dish.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {discountPct > 0 && (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "var(--carta-accent)", padding: "3px 10px", borderRadius: 50 }}>
              -{discountPct}%
            </span>
          )}
          <b style={{ color: "var(--carta-accent)", fontSize: 16 }}>{formatCLP(effectivePrice)}</b>
          {discountPct > 0 && (
            <span style={{ fontSize: "0.78rem", color: "var(--carta-text3, #666)", textDecoration: "line-through" }}>
              {formatCLP(dish.price)}
            </span>
          )}
        </div>
      </div>

      {/* + button */}
      <div
        onClick={hasModifiers ? undefined : onDirectAdd}
        style={{
          position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: "50%",
          background: "var(--carta-accent)", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 10px rgba(0,0,0,0.35)", pointerEvents: hasModifiers ? "none" : "auto",
        }}
      >
        <Plus size={16} color="#fff" />
      </div>
    </button>
  );
}

// ── Lista card (replica exacta de DishListCard) ───────────────────────────────
function ListaCard({ dish, onClick }: { dish: Dish; onClick: () => void }) {
  const effectivePrice = dish.discountPrice != null && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const discountPct = dish.discountPrice != null && dish.discountPrice < dish.price
    ? Math.round(((dish.price - dish.discountPrice) / dish.price) * 100) : 0;
  const [imgLoaded, setImgLoaded] = useState(false);
  const photo = dish.photos?.[0];

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", gap: 0, padding: 0, overflow: "hidden",
        background: "var(--carta-surface)", borderRadius: 14,
        border: "1px solid var(--carta-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {/* Foto — IZQUIERDA */}
      <div style={{ width: 140, minHeight: 140, alignSelf: "stretch", overflow: "hidden", flexShrink: 0, position: "relative", background: photo ? "var(--carta-photo-bg)" : "linear-gradient(135deg, var(--carta-bg), var(--carta-photo-bg))" }}>
        {photo ? (
          <>
            {!imgLoaded && <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)", animation: "shimmer 1.5s infinite" }} /></div>}
            <img src={photo} alt={dish.name} loading="lazy" onLoad={() => setImgLoaded(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }} />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🍽️</div>
        )}
        {discountPct > 0 && (
          <span style={{ position: "absolute", top: 6, left: 6, fontSize: "11px", fontWeight: 800, color: "white", background: "var(--carta-accent)", padding: "3px 9px", borderRadius: 50 }}>
            -{discountPct}%
          </span>
        )}
      </div>

      {/* Texto — DERECHA */}
      <div style={{ flex: 1, minWidth: 0, padding: "10px 12px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--carta-text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {dish.name}
        </h3>
        {dish.description && (
          <p style={{ fontSize: "1rem", color: "var(--carta-text2)", lineHeight: 1.4, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {dish.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.94rem", fontWeight: 700, color: "var(--carta-accent)" }}>
            {formatCLP(effectivePrice)}
          </span>
          {discountPct > 0 && (
            <span style={{ fontSize: "0.78rem", color: "var(--carta-text3)", textDecoration: "line-through" }}>
              {formatCLP(dish.price)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function OrderMenuPage({ restaurant, orderingConfig }: Props) {
  const { items, count, addItem } = useCart();
  const [selectedDish, setSelectedDish] = useState<DishForOrder | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isImpact = (orderingConfig.cartaView || "lista") === "impact";
  const isDark = (orderingConfig.cartaColorMode || "LIGHT") === "DARK";
  const accent = orderingConfig.cartaAccentColor || (isDark ? "#fe0001" : "#F59E0B");

  const themeVars: React.CSSProperties = isDark ? {
    "--carta-bg": "#0e0e0e", "--carta-surface": "#1a1a1a",
    "--carta-text": "#f0f0f0", "--carta-text2": "#aaa", "--carta-text3": "#555",
    "--carta-border": "#262626", "--carta-accent": accent,
    "--carta-card-bg": "#1a1a1a", "--carta-card-shadow": "0 1px 8px rgba(0,0,0,0.4)",
    "--carta-photo-bg": "#222",
  } as React.CSSProperties : {
    "--carta-bg": "#FAFAF8", "--carta-surface": "#fff",
    "--carta-text": "#111", "--carta-text2": "#666", "--carta-text3": "#999",
    "--carta-border": "#ece9e3", "--carta-accent": accent,
    "--carta-card-bg": "#fff", "--carta-card-shadow": "0 1px 8px rgba(0,0,0,0.07)",
    "--carta-photo-bg": "#f0ece6",
  } as React.CSSProperties;

  const activeDishes = restaurant.dishes.filter(d => d.isActive && !d.deletedAt);
  const activeCatIds = new Set(activeDishes.map(d => d.categoryId));
  const categories = restaurant.categories.filter(c => activeCatIds.has(c.id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeDishes.filter(d => {
      if (q && !d.name.toLowerCase().includes(q) && !(d.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeDishes, search]);

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

  // Impact: fixed header height + slide-in category chips
  const impactHeaderRef = useRef<HTMLDivElement>(null);
  const [impactHeaderH, setImpactHeaderH] = useState(65);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const [showFixedCatNav, setShowFixedCatNav] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);
  const fixedChipsRef = useRef<HTMLDivElement>(null);
  const fixedActiveChipRef = useRef<HTMLButtonElement>(null);

  // Lista: sticky nav height + auto-scroll
  const stickyNavRef = useRef<HTMLDivElement>(null);
  const [stickyNavH, setStickyNavH] = useState(50);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const activeCatRef = useRef<HTMLButtonElement>(null);

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

  // Auto-scroll category chips
  useEffect(() => {
    if (isImpact) {
      const chip = activeChipRef.current;
      const cont = chipsRef.current;
      if (chip && cont) cont.scrollTo({ left: chip.offsetLeft - cont.offsetWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
      const fchip = fixedActiveChipRef.current;
      const fcont = fixedChipsRef.current;
      if (fchip && fcont) fcont.scrollTo({ left: fchip.offsetLeft - fcont.offsetWidth / 2 + fchip.offsetWidth / 2, behavior: "smooth" });
    } else {
      const chip = activeCatRef.current;
      const cont = catScrollRef.current;
      if (chip && cont) cont.scrollTo({ left: chip.offsetLeft - cont.offsetWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
    }
  }, [activeCategory, isImpact]);

  // IntersectionObserver
  useEffect(() => {
    const prefix = isImpact ? "impact-cat" : "lista-cat";
    const observers: IntersectionObserver[] = [];
    for (const { category } of grouped) {
      const el = document.getElementById(`${prefix}-${category.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveCategory(category.id); },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(o => o.disconnect());
  }, [grouped, isImpact]);

  const scrollToCategory = (catId: string) => {
    const prefix = isImpact ? "impact-cat" : "lista-cat";
    const el = document.getElementById(`${prefix}-${catId}`);
    if (!el) return;
    const offset = isImpact ? impactHeaderH + 10 : stickyNavH + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  };

  const heroImg = orderingConfig.orderingBannerUrl || restaurant.bannerUrl || null;

  const addDirectly = (dish: Dish) => {
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

  // ─── IMPACT LAYOUT ────────────────────────────────────────────────────────
  if (isImpact) {
    const chipStyle = (isActive: boolean): React.CSSProperties => ({
      whiteSpace: "nowrap", flexShrink: 0,
      border: isActive ? "1px solid color-mix(in srgb, var(--carta-accent) 55%, transparent)" : `1px solid ${isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)"}`,
      background: isActive ? "color-mix(in srgb, var(--carta-accent) 10%, transparent)" : (isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)"),
      borderRadius: 999,
      color: isActive ? accent : (isDark ? "#777" : "#999"),
      fontWeight: 800, cursor: "pointer",
    });

    return (
      <div className="min-h-screen" style={{ background: "var(--carta-bg)", fontFamily: FB, ...themeVars }}>

        {/* Ambient bg */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: `radial-gradient(circle at 70% 0%, color-mix(in srgb, ${accent} ${isDark ? "28%" : "18%"}, transparent), transparent 30%), radial-gradient(circle at 8% 28%, color-mix(in srgb, ${accent} ${isDark ? "15%" : "10%"}, transparent), transparent 36%), radial-gradient(circle at 90% 72%, color-mix(in srgb, ${accent} 5%, transparent), transparent 26%), linear-gradient(var(--carta-bg), var(--carta-bg))` }} />
        {/* Grid texture */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: isDark ? 0.22 : 0.12, backgroundImage: `linear-gradient(rgba(${isDark ? "255,255,255" : "0,0,0"},0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(${isDark ? "255,255,255" : "0,0,0"},0.035) 1px, transparent 1px)`, backgroundSize: "38px 38px", maskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)" }} />
        {/* Smoke glow */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: isDark ? 0.5 : 0.35, background: `radial-gradient(ellipse at 50% 8%, color-mix(in srgb, ${accent} 16%, transparent), transparent 32%), radial-gradient(ellipse at 70% 24%, color-mix(in srgb, ${accent} 10%, transparent), transparent 28%)`, filter: "blur(10px)" }} />

        {/* Fixed glass header */}
        <div ref={impactHeaderRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: isDark ? "rgba(3,3,3,0.32)" : "rgba(250,250,248,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          <header style={{ padding: "calc(10px + env(safe-area-inset-top)) 16px 0", pointerEvents: "auto" }}>
            {/* Logo + name + cart */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {restaurant.logoUrl ? (
                  <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 34, height: 34, borderRadius: 10, objectFit: "contain" }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: accent, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800, color: isDark ? "#0e0e0e" : "#fff", flexShrink: 0 }}>
                    {restaurant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontWeight: 800, fontSize: 18, color: isDark ? "#fff" : "var(--carta-text)", letterSpacing: "-0.3px" }}>
                  {restaurant.name}
                </span>
              </div>
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  position: "relative", width: 40, height: 40, borderRadius: "50%", border: `1px solid ${isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.1)"}`,
                  background: count > 0 ? accent : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
                  display: "grid", placeItems: "center", cursor: "pointer",
                }}
              >
                <ShoppingCart size={17} color={count > 0 ? "#fff" : (isDark ? "#aaa" : "#666")} />
                {count > 0 && (
                  <span style={{ position: "absolute", top: -3, right: -3, width: 17, height: 17, borderRadius: "50%", background: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                )}
              </button>
            </div>

            {/* Slide-in fixed category chips */}
            <div style={{ overflow: "hidden", maxHeight: showFixedCatNav ? 50 : 0, transition: "max-height 0.25s ease" }}>
              <div ref={fixedChipsRef} style={{ padding: "0 0 10px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {grouped.map(({ category: cat }) => {
                  const isActive = cat.id === activeCategory;
                  return (
                    <button
                      key={cat.id}
                      ref={isActive ? fixedActiveChipRef : null}
                      onClick={() => { setActiveCategory(cat.id); scrollToCategory(cat.id); }}
                      style={{ ...chipStyle(isActive), padding: "7px 12px", fontSize: 13 }}
                    >{cat.name}</button>
                  );
                })}
              </div>
            </div>
          </header>
        </div>

        {/* Spacer */}
        <div style={{ height: impactHeaderH }} />

        {/* Hero (si hay imagen) */}
        {heroImg && (
          <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden", zIndex: 1 }}>
            <img src={heroImg} alt={restaurant.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%)" }} />
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 20 }}>
              <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: "#fff", margin: 0, letterSpacing: "0.6px", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {restaurant.name}
              </p>
              {orderingConfig.waitTime && (
                <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.8)", margin: "4px 0 0" }}>⏱ {orderingConfig.waitTime}</p>
              )}
            </div>
          </div>
        )}

        {/* Menu section */}
        <div style={{ position: "relative", zIndex: 1, padding: "24px 14px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, letterSpacing: "0.8px", margin: 0, lineHeight: 0.9, color: isDark ? "#ddd" : "#333", flex: searchOpen ? "0 0 0" : 1, overflow: "hidden", opacity: searchOpen ? 0 : 1, transition: "flex 0.22s ease, opacity 0.15s ease", whiteSpace: "nowrap" }}>
            MENÚ
          </h2>
          <div style={{ flex: searchOpen ? 1 : "0 0 0", overflow: "hidden", opacity: searchOpen ? 1 : 0, transition: "flex 0.22s ease, opacity 0.18s ease", display: "flex", alignItems: "center", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", borderRadius: 999, padding: "0 12px", border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"}`, width: "100%" }}>
              <Search size={14} color={isDark ? "rgba(255,255,255,0.5)" : "#999"} style={{ flexShrink: 0 }} />
              <input
                id="impact-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                style={{ flex: 1, border: "none", outline: "none", fontSize: "15px", color: isDark ? "#fff" : "#111", background: "transparent", minWidth: 0 }}
              />
            </div>
          </div>
          <button
            onClick={() => { if (searchOpen) { setSearchOpen(false); setSearch(""); } else { setSearchOpen(true); setTimeout(() => document.getElementById("impact-search")?.focus(), 250); } }}
            style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"}`, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
          >
            {searchOpen ? <X size={15} color={isDark ? "#fff" : "#333"} /> : <Search size={15} color={isDark ? "#fff" : "#333"} />}
          </button>
        </div>

        {/* Category chips */}
        <div ref={menuAnchorRef} style={{ position: "relative", zIndex: 1, padding: "0 14px 6px" }}>
          <div ref={chipsRef} style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "4px 0" }}>
            {grouped.map(({ category: cat }) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  ref={isActive ? activeChipRef : null}
                  onClick={() => { setActiveCategory(cat.id); scrollToCategory(cat.id); }}
                  style={{ ...chipStyle(isActive), padding: "10px 16px", fontSize: 15, transition: "all 0.2s ease" }}
                >{cat.name}</button>
              );
            })}
          </div>
          {/* Fade right */}
          <div style={{ position: "absolute", top: 0, right: 14, bottom: 0, width: 24, background: "linear-gradient(to right, transparent, var(--carta-bg))", pointerEvents: "none" }} />
        </div>

        {/* Dishes */}
        <div style={{ position: "relative", zIndex: 1, padding: "0 14px 120px" }}>
          {grouped.length === 0 ? (
            <div style={{ padding: "64px 28px", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>🔍</span>
              <p style={{ color: isDark ? "#aaa" : "#999", fontSize: "0.95rem" }}>No encontramos platos con &ldquo;{search}&rdquo;</p>
              <button onClick={() => setSearch("")} style={{ marginTop: 12, fontSize: "0.88rem", color: accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Limpiar búsqueda</button>
            </div>
          ) : (
            grouped.map(({ category, dishes }) => (
              <div key={category.id} id={`impact-cat-${category.id}`} style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)", margin: "33px 0 14px", letterSpacing: "0.6px", lineHeight: 0.9 }}>
                  {category.name}
                </h3>
                {dishes.map(dish => (
                  <ImpactCard
                    key={dish.id}
                    dish={dish}
                    onClick={() => setSelectedDish(dish as unknown as DishForOrder)}
                    onDirectAdd={(e) => { e.stopPropagation(); addDirectly(dish); }}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Cart bar */}
        {count > 0 && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80, padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", background: isDark ? "rgba(3,3,3,0.8)" : "rgba(250,250,248,0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid var(--carta-border)" }}>
            <button onClick={() => setCartOpen(true)} style={{ width: "100%", padding: "13px 18px", borderRadius: 14, border: "none", background: accent, color: "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 520, margin: "0 auto", boxShadow: `0 4px 20px color-mix(in srgb, ${accent} 40%, transparent)`, fontFamily: FB }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.2)", fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Ver carrito</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{cartTotal}</span>
            </button>
          </div>
        )}

        {/* Modales */}
        {selectedDish && <OrderItemModal dish={selectedDish} onClose={() => setSelectedDish(null)} onAdd={handleAddItem} />}
        {cartOpen && !checkoutOpen && <OrderCart onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
        {checkoutOpen && <OrderCheckout restaurantName={restaurant.name} restaurantSlug={restaurant.slug} orderingConfig={orderingConfig} onBack={() => { setCheckoutOpen(false); setCartOpen(true); }} onClose={() => setCheckoutOpen(false)} />}
      </div>
    );
  }

  // ─── LISTA LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--carta-bg)", fontFamily: FB, ...themeVars }}>
      <style>{`@keyframes shimmer { 0%,100%{transform:translateX(-100%)} 50%{transform:translateX(100%)} }`}</style>

      {/* Hero */}
      {heroImg && (
        <div style={{ position: "relative", width: "100%", height: 220, overflow: "hidden" }}>
          <img src={heroImg} alt={restaurant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)" }} />
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
            {restaurant.logoUrl && <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.8)", flexShrink: 0 }} />}
            <div>
              <p style={{ fontFamily: "var(--font-playfair, Georgia, serif)", fontWeight: 600, fontSize: "1.3rem", color: "#fff", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{restaurant.name}</p>
              {orderingConfig.waitTime && <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", margin: "2px 0 0" }}>⏱ {orderingConfig.waitTime}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Sticky nav */}
      <div ref={stickyNavRef} style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--carta-bg)", borderBottom: "1px solid var(--carta-border)", transform: "translateZ(0)" }}>
        {/* Logo + cart row (only if no hero) */}
        {!heroImg && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 0" }}>
            {restaurant.logoUrl && <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--carta-border)", flexShrink: 0 }} />}
            <span style={{ flex: 1, fontWeight: 700, fontSize: "0.95rem", color: "var(--carta-text)" }}>{restaurant.name}</span>
            <button onClick={() => setCartOpen(true)} style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", border: "none", background: count > 0 ? accent : "var(--carta-photo-bg)", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <ShoppingCart size={16} color={count > 0 ? "#fff" : "#888"} />
              {count > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
            </button>
          </div>
        )}

        {searchOpen ? (
          <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
            <Search size={16} color="var(--carta-text2)" style={{ flexShrink: 0 }} />
            <input autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar platos..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "var(--carta-text)", background: "transparent" }} />
            <button onClick={() => { setSearchOpen(false); setSearch(""); }} style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}>
              <X size={18} color="var(--carta-text2)" />
            </button>
          </div>
        ) : (
          <nav style={{ display: "flex", alignItems: "center" }}>
            <div ref={catScrollRef} style={{ flex: 1, paddingLeft: 12, paddingRight: 8, paddingTop: 8, paddingBottom: 8, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", maskImage: "linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)" }}>
              {grouped.map(({ category: cat }) => {
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    ref={isActive ? activeCatRef : null}
                    onClick={() => { setActiveCategory(cat.id); scrollToCategory(cat.id); }}
                    style={{
                      whiteSpace: "nowrap", flexShrink: 0, padding: "7px 14px", borderRadius: 999,
                      fontSize: 14, fontWeight: isActive ? 700 : 500,
                      color: isActive ? accent : "var(--carta-text3)",
                      background: isActive ? `color-mix(in srgb, ${accent} 10%, transparent)` : "transparent",
                      border: isActive ? `1px solid color-mix(in srgb, ${accent} 45%, transparent)` : "1px solid var(--carta-border)",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >{cat.name}</button>
                );
              })}
            </div>
            {/* Cart icon + Search icon on right (only if hero shown) */}
            <div style={{ flexShrink: 0, paddingRight: 8, paddingLeft: 4, display: "flex", alignItems: "center", gap: 4 }}>
              {heroImg && (
                <button onClick={() => setCartOpen(true)} style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", border: "none", background: count > 0 ? accent : "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <ShoppingCart size={16} color={count > 0 ? "#fff" : "var(--carta-text2)"} />
                  {count > 0 && <span style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.55rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
                </button>
              )}
              <button onClick={() => setSearchOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 4, cursor: "pointer" }}>
                <Search size={17} color="var(--carta-text2)" />
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* Categories */}
      {grouped.length === 0 ? (
        <div style={{ padding: "64px 28px", textAlign: "center" }}>
          <p style={{ color: "var(--carta-text2)", fontSize: "0.9rem" }}>No encontramos platos que coincidan.</p>
          <button onClick={() => setSearch("")} style={{ marginTop: 12, fontSize: "0.88rem", color: accent, fontWeight: 600, background: `color-mix(in srgb, ${accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, padding: "8px 18px", borderRadius: 999, cursor: "pointer" }}>Ver todos los platos</button>
        </div>
      ) : (
        grouped.map(({ category, dishes }, index) => (
          <section key={category.id} id={`lista-cat-${category.id}`} style={{ padding: `${index === 0 ? 4 : 12}px 12px 0` }}>
            <div style={{ padding: "0 8px", margin: "14px 0 10px" }}>
              <h2 style={{ fontFamily: "var(--font-playfair, Georgia, serif)", fontSize: "1.3rem", fontWeight: 600, color: "var(--carta-text2)" }}>
                {category.name}
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {dishes.map(dish => (
                <ListaCard key={dish.id} dish={dish} onClick={() => setSelectedDish(dish as unknown as DishForOrder)} />
              ))}
            </div>
          </section>
        ))
      )}

      <div style={{ height: 120 }} />

      {/* Cart bar */}
      {count > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80, padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", background: "var(--carta-bg)", borderTop: "1px solid var(--carta-border)" }}>
          <button onClick={() => setCartOpen(true)} style={{ width: "100%", padding: "13px 18px", borderRadius: 14, border: "none", background: accent, color: "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 520, margin: "0 auto", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", fontFamily: FB }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.2)", fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Ver carrito</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{cartTotal}</span>
          </button>
        </div>
      )}

      {/* Modales */}
      {selectedDish && <OrderItemModal dish={selectedDish} onClose={() => setSelectedDish(null)} onAdd={handleAddItem} />}
      {cartOpen && !checkoutOpen && <OrderCart onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
      {checkoutOpen && <OrderCheckout restaurantName={restaurant.name} restaurantSlug={restaurant.slug} orderingConfig={orderingConfig} onBack={() => { setCheckoutOpen(false); setCartOpen(true); }} onClose={() => setCheckoutOpen(false)} />}
    </div>
  );
}
