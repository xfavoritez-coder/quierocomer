"use client";
// ═══════════════════════════════════════════════════════════
//  Tema "Impact" del storefront del Ecommerce — calco fiel del
//  tema impact de /pedir (OrderMenuPage): fondo ambiental
//  difuminado, header glass, banner de destacados, tiles de
//  categorías, tarjetas glass y botones "+" con glow. Reutiliza
//  el cart-store y los flujos (ProductModal, CartDrawer,
//  DeliveryModal, CustomerMenu) tematizados en oscuro por ImpactSkin.
// ═══════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ShoppingCart, Search, X, Menu as MenuIcon, Plus, MapPin } from "lucide-react";
import type { StoreTenant, StoreCategory, StoreProduct } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { useFavicon } from "@/lib/ecommerce/useFavicon";
import ProductModal from "./ProductModal";
import CartDrawer from "./CartDrawer";
import CustomerMenu from "./CustomerMenu";
import StoreStyles from "./StoreStyles";
import ImpactSkin from "./ImpactSkin";
import { DeliveryModal } from "./StoreFront";

interface Props {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
}

const FB = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY = "'Bebas Neue', Impact, sans-serif";

export default function ImpactStoreFront({ tenant, categories, products }: Props) {
  const accent = tenant.primaryColor;
  useFavicon(tenant.logoUrl);

  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const setRestaurantId = useCartStore((s) => s.setRestaurantId);
  const addItem = useCartStore((s) => s.addItem);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());
  const deliveryType = useCartStore((s) => s.deliveryType);
  const deliverySelected = useCartStore((s) => s.deliverySelected);
  const deliveryAddress = useCartStore((s) => s.deliveryAddress);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setRestaurantId(tenant.id); }, [tenant.id, setRestaurantId]);

  // Altura del header (para dejar los chips de categoría sticky justo debajo).
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(62);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byCategory = useMemo(() => {
    const m = new Map<string, StoreProduct[]>();
    for (const p of products) { const arr = m.get(p.category_id) ?? []; arr.push(p); m.set(p.category_id, arr); }
    return m;
  }, [products]);

  const q = search.trim().toLowerCase();
  const grouped = useMemo(() => {
    return categories
      .map((c) => {
        let items = byCategory.get(c.id) ?? [];
        if (q) items = items.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
        return { cat: c, items };
      })
      .filter((g) => g.items.length > 0);
  }, [categories, byCategory, q]);

  const heroProducts = useMemo(() => {
    // 1) Selección explícita del local (Catálogo → banner), respetando el orden.
    const ids = tenant.bannerProductIds ?? [];
    if (ids.length) {
      const byId = new Map(products.map((p) => [p.id, p]));
      const picked = ids.map((id) => byId.get(id)).filter((p): p is StoreProduct => !!p);
      if (picked.length) return picked.slice(0, 5);
    }
    // 2) Fallback: destacados (isHero) o, si no hay, productos con foto.
    const withImg = products.filter((p) => p.image_url && !p.is_sold_out);
    const hero = withImg.filter((p) => p.is_hero);
    return (hero.length ? hero : withImg).slice(0, 5);
  }, [products, tenant.bannerProductIds]);

  const isOpen = tenant.openStatus.open;

  const openProduct = useCallback((p: StoreProduct) => { if (!p.is_sold_out) setSelectedProduct(p); }, []);
  const directAdd = useCallback((p: StoreProduct) => {
    if (p.is_sold_out || !isOpen) return;
    if (p.option_groups && p.option_groups.length > 0) { setSelectedProduct(p); return; }
    addItem({ product_id: p.id, name: p.name, unit_price: p.price, base_price: p.price, quantity: 1, image_url: p.image_url, toteat_code: p.toteat_code, options: [] });
  }, [addItem, isOpen]);

  function scrollToCategory(id: string) {
    setActiveCat(id);
    document.getElementById(`impact-cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const deliveryLabel = !mounted
    ? "Entrega o retiro"
    : deliverySelected
      ? (deliveryType === "delivery" ? (deliveryAddress?.address ? `Entrega · ${deliveryAddress.address.split(",")[0]}` : "Delivery") : "Retiro en el local")
      : "Elige entrega o retiro";

  // Tokens oscuros del tema impact (idénticos a OrderMenuPage dark).
  const themeVars = {
    "--carta-bg": "#0e0e0e", "--carta-surface": "#1a1a1a",
    "--carta-text": "#f0f0f0", "--carta-text2": "#aaa", "--carta-text3": "#555",
    "--carta-border": "#262626", "--carta-accent": accent,
    "--carta-plus-icon": "#fff", "--carta-btn-text": "#fff",
    fontFamily: FB,
  } as React.CSSProperties;

  return (
    <div className="qc-storefront qc-impact" style={{ minHeight: "100dvh", color: "var(--carta-text)", position: "relative", background: `radial-gradient(120% 420px at 72% 0%, color-mix(in srgb, ${accent} 26%, transparent), transparent 60%), radial-gradient(90% 340px at 6% 6%, color-mix(in srgb, ${accent} 12%, transparent), transparent 55%), #0e0e0e`, backgroundRepeat: "no-repeat", ...themeVars }}>
      <StoreStyles />
      <ImpactSkin />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .imp-scroll::-webkit-scrollbar{display:none}
        .imp-menu-grid{max-width:1200px;margin:0 auto}
        @keyframes imp-bump{0%{transform:scale(1)}30%{transform:scale(1.16)}100%{transform:scale(1)}}
      `}</style>

      {/* ── Header glass ── */}
      <div ref={headerRef} style={{ position: "sticky", top: 0, zIndex: 40, background: "#131313", borderBottom: "1px solid var(--carta-border)" }}>
        <div className="imp-menu-grid" style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 16px 10px" }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Menú" style={glassBtn}><MenuIcon size={18} color="#eaeaea" /></button>
          {tenant.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.name} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
            : <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: "grid", placeItems: "center", fontWeight: 800, color: "#0e0e0e" }}>{tenant.name.charAt(0).toUpperCase()}</div>}
          <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tenant.name}</span>
          <button onClick={() => setCartOpen(true)} aria-label="Carrito" style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.13)", background: mounted && itemCount > 0 ? accent : "rgba(255,255,255,0.08)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
            <ShoppingCart size={17} color={mounted && itemCount > 0 ? "#fff" : "#aaa"} />
            {mounted && itemCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{itemCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Selector de entrega ── */}
      <div className="imp-menu-grid" style={{ position: "relative", zIndex: 1, padding: "12px 14px 0" }}>
        <button onClick={() => setDeliveryModalOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "color-mix(in srgb, var(--carta-text) 5%, transparent)", border: "1px solid var(--carta-border)", borderRadius: 14, padding: "12px 14px", color: "var(--carta-text)", cursor: "pointer", textAlign: "left" }}>
          <MapPin size={16} color={accent} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deliveryLabel}</span>
          <span style={{ fontSize: "0.76rem", color: accent, fontWeight: 800 }}>Cambiar</span>
        </button>
      </div>

      {/* ── Banner de destacados ── */}
      {heroProducts.length > 0 && (
        <div className="imp-menu-grid" style={{ position: "relative", zIndex: 1, paddingTop: 14 }}>
          <ImpactHero heroProducts={heroProducts} accent={accent} onSelect={openProduct} onAdd={directAdd} />
        </div>
      )}

      {/* ── Categorías (tiles) ── */}
      {grouped.length >= 3 && (
        <CategoriesSection grouped={grouped} accent={accent} activeId={activeCat} onTap={scrollToCategory} />
      )}

      {/* ── Título MENÚ + búsqueda ── */}
      <div className="imp-menu-grid" style={{ position: "relative", zIndex: 1, padding: "22px 14px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: "0.8px", margin: 0, lineHeight: 0.9, color: "rgba(255,255,255,0.55)", flex: searchOpen ? "0 0 0" : 1, overflow: "hidden", opacity: searchOpen ? 0 : 1, transition: "flex .22s ease, opacity .15s ease", whiteSpace: "nowrap" }}>MENÚ</h2>
        <div style={{ flex: searchOpen ? 1 : "0 0 0", overflow: "hidden", opacity: searchOpen ? 1 : 0, transition: "flex .22s ease, opacity .18s ease", display: "flex", alignItems: "center", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: "0 12px", border: "1px solid rgba(255,255,255,0.18)", width: "100%" }}>
            <Search size={14} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
            <input id="imp-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "#fff", background: "transparent", minWidth: 0 }} />
          </div>
        </div>
        <button onClick={() => { if (searchOpen) { setSearchOpen(false); setSearch(""); } else { setSearchOpen(true); setTimeout(() => document.getElementById("imp-search")?.focus(), 250); } }} style={{ ...glassBtn, width: 38, height: 38 }}>
          {searchOpen ? <X size={16} color="#fff" /> : <Search size={16} color="#fff" />}
        </button>
      </div>

      {/* ── Chips de categorías (sticky bajo el header al hacer scroll) ── */}
      {!searchOpen && grouped.length > 0 && (
        <div className="imp-scroll imp-menu-grid" style={{ position: "sticky", top: headerH - 1, zIndex: 38, display: "flex", gap: 8, overflowX: "auto", padding: "8px 14px 8px", scrollbarWidth: "none", background: "#0e0e0e", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {grouped.map(({ cat }) => {
            const on = cat.id === activeCat;
            return (
              <button key={cat.id} onClick={() => scrollToCategory(cat.id)} style={{
                whiteSpace: "nowrap", flexShrink: 0, padding: "10px 18px", fontSize: 15, fontWeight: 800, cursor: "pointer", borderRadius: 999,
                border: on ? `1px solid color-mix(in srgb, ${accent} 55%, transparent)` : "1px solid rgba(255,255,255,0.13)",
                background: on ? `color-mix(in srgb, ${accent} 12%, transparent)` : "rgba(255,255,255,0.055)",
                color: on ? "#fff" : "#888",
              }}>{cat.name}</button>
            );
          })}
        </div>
      )}

      {/* ── Platos (cards glass) ── */}
      <div className="imp-menu-grid" style={{ position: "relative", zIndex: 1, padding: `4px 14px ${mounted && itemCount > 0 ? 120 : 48}px` }}>
        {grouped.length === 0 ? (
          <div style={{ padding: "64px 20px", textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>🔍</div>
            <p style={{ fontSize: "0.95rem" }}>No encontramos productos{q ? ` para “${search}”` : ""}</p>
          </div>
        ) : grouped.map((g) => (
          <div key={g.cat.id} id={`impact-cat-${g.cat.id}`} style={{ marginBottom: 18, scrollMarginTop: headerH + 60 }}>
            <h3 style={{ fontFamily: DISPLAY, fontSize: 22, color: "rgba(255,255,255,0.6)", margin: "30px 0 14px", letterSpacing: "0.6px", lineHeight: 0.9 }}>{g.cat.name}</h3>
            {g.items.map((p) => (
              <ImpactCard key={p.id} product={p} accent={accent} onClick={() => openProduct(p)} onAdd={(e) => { e.stopPropagation(); directAdd(p); }} />
            ))}
          </div>
        ))}
      </div>

      {/* ── Barra de carrito glass ── */}
      {mounted && itemCount > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 45, padding: "12px 16px", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))", background: "transparent", pointerEvents: "none", display: "flex", justifyContent: "center" }}>
          {/* Botón flotante liquid glass (sin recuadro de fondo) */}
          <button onClick={() => setCartOpen(true)} style={{
            pointerEvents: "auto", width: "100%", maxWidth: 520, padding: "15px 20px", borderRadius: 999,
            display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "#fff", fontFamily: FB,
            background: `color-mix(in srgb, ${accent} 30%, rgba(255,255,255,0.10))`,
            backdropFilter: "blur(16px) saturate(170%)", WebkitBackdropFilter: "blur(16px) saturate(170%)",
            border: `1px solid color-mix(in srgb, ${accent} 40%, rgba(255,255,255,0.40))`,
            boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(255,255,255,0.12), 0 12px 34px color-mix(in srgb, ${accent} 42%, rgba(0,0,0,0.45))`,
            transform: "translateZ(0)",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 25, height: 25, borderRadius: "50%", background: "rgba(255,255,255,0.22)", fontSize: "0.8rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}>{itemCount}</span>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>Ver carrito</span>
            </span>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{clp(subtotal)}</span>
          </button>
        </div>
      )}

      {/* ── Flujos reutilizados (oscuros por ImpactSkin) ── */}
      {selectedProduct && <ProductModal product={selectedProduct} primaryColor={accent} onClose={() => setSelectedProduct(null)} />}
      {deliveryModalOpen && <DeliveryModal tenant={tenant} primaryColor={accent} onClose={() => setDeliveryModalOpen(false)} />}
      {menuOpen && <CustomerMenu tenant={tenant} primaryColor={accent} onClose={() => setMenuOpen(false)} side="left" />}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} tenant={tenant} primaryColor={accent} mobileOnly={false} onOpenDeliveryModal={() => { setCartOpen(false); setDeliveryModalOpen(true); }} />
    </div>
  );
}

const glassBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.13)",
  background: "rgba(255,255,255,0.08)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
};

// ── Banner de destacados (carrusel) ──
function ImpactHero({ heroProducts, accent, onSelect, onAdd }: {
  heroProducts: StoreProduct[]; accent: string; onSelect: (p: StoreProduct) => void; onAdd: (p: StoreProduct) => void;
}) {
  const [current, setCurrent] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const touchX = useRef(0);
  const wasSwipe = useRef(false);
  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setCurrent((c) => (c + 1) % heroProducts.length), 5000);
  }, [heroProducts.length]);
  useEffect(() => { if (heroProducts.length <= 1) return; reset(); return () => { if (timer.current) clearInterval(timer.current); }; }, [heroProducts.length, reset]);

  const d = heroProducts[current];
  if (!d) return null;
  const discountPct = d.original_price && d.original_price > d.price ? Math.round(((d.original_price - d.price) / d.original_price) * 100) : 0;
  const hasOpts = (d.option_groups?.length ?? 0) > 0;

  return (
    <section
      style={{ minHeight: "52vh", position: "relative", display: "flex", alignItems: "flex-end", padding: "72px 20px 16px", borderRadius: 28, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", cursor: "pointer" }}
      onClick={() => { if (!wasSwipe.current) onSelect(d); wasSwipe.current = false; }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; wasSwipe.current = false; }}
      onTouchEnd={(e) => { const diff = e.changedTouches[0].clientX - touchX.current; if (Math.abs(diff) > 50) { wasSwipe.current = true; setCurrent((c) => diff < 0 ? (c + 1) % heroProducts.length : (c - 1 + heroProducts.length) % heroProducts.length); reset(); } }}
    >
      {heroProducts.map((p, i) => (
        <div key={p.id} style={{ position: "absolute", inset: 0, zIndex: 1, opacity: i === current ? 1 : 0, transition: "opacity .8s ease" }}>
          {p.image_url
            ? <img src={p.image_url} alt={p.name} loading={i === 0 ? "eager" : "lazy"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, #1a1a2e), color-mix(in srgb, ${accent} 6%, #0f3460))` }} />}
        </div>
      ))}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.25) 36%, rgba(0,0,0,0.72) 78%, #030303 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: "50%", zIndex: 3, background: "linear-gradient(to top, #030303 0%, #030303 8%, rgba(3,3,3,0.85) 38%, rgba(3,3,3,0.4) 72%, transparent 100%)" }} />
      <div style={{ width: "100%", padding: "0 0 8px", position: "relative", zIndex: 4 }}>
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 56, lineHeight: 0.82, letterSpacing: "0.5px", textShadow: "0 5px 30px rgba(0,0,0,0.92)", color: "#fff" }}>
          {d.name.split(" ").map((w, i, arr) => i === arr.length - 1
            ? <span key={i} style={{ display: "inline-block", color: accent, fontWeight: 900, textShadow: `0 0 20px color-mix(in srgb, ${accent} 50%, transparent)` }}>{w}</span>
            : <span key={i}>{w} </span>)}
        </h1>
        {d.description && <p style={{ maxWidth: 320, margin: "14px 0 16px", color: "#b0a89e", fontSize: 15, lineHeight: 1.5, textShadow: "0 1px 8px rgba(0,0,0,0.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.description}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {discountPct > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: accent, padding: "4px 11px", borderRadius: 50 }}>-{discountPct}%</span>}
            <span style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.8px" }}>{clp(d.price)}</span>
            {discountPct > 0 && <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>{clp(d.original_price!)}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); if (hasOpts) onSelect(d); else onAdd(d); }} style={{ width: 42, height: 42, borderRadius: "50%", border: `1px solid color-mix(in srgb, ${accent} 60%, transparent)`, background: `color-mix(in srgb, ${accent} 20%, rgba(0,0,0,0.45))`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 0 18px color-mix(in srgb, ${accent} 55%, transparent)`, flexShrink: 0 }}>
            <Plus size={20} color="#fff" />
          </button>
        </div>
        {heroProducts.length > 1 && (
          <div style={{ display: "flex", gap: 7, marginTop: 17 }}>
            {heroProducts.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); reset(); }} style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 50, background: i === current ? accent : "rgba(255,255,255,0.38)", border: "none", cursor: "pointer", transition: "all .3s ease", padding: 0 }} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Tiles de categorías ──
function CategoriesSection({ grouped, accent, activeId, onTap }: {
  grouped: { cat: StoreCategory; items: StoreProduct[] }[]; accent: string; activeId: string; onTap: (id: string) => void;
}) {
  return (
    <section className="imp-menu-grid" style={{ padding: "24px 14px 0", position: "relative", zIndex: 1 }}>
      <h2 style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: "0.8px", margin: "0 0 12px", lineHeight: 0.9, color: "rgba(255,255,255,0.55)" }}>CATEGORÍAS</h2>
      <div className="imp-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "4px 0 16px", scrollbarWidth: "none" }}>
        {grouped.map(({ cat, items }) => {
          const photo = items.find((p) => p.image_url)?.image_url ?? null;
          const on = cat.id === activeId;
          return (
            <button key={cat.id} onClick={() => onTap(cat.id)} style={{ width: 128, minWidth: 128, height: 148, borderRadius: 28, position: "relative", overflow: "hidden", padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end", cursor: "pointer", flexShrink: 0, background: "var(--carta-surface)", border: on ? `1px solid color-mix(in srgb, ${accent} 90%, transparent)` : "1px solid rgba(255,255,255,0.14)", boxShadow: on ? `0 0 28px color-mix(in srgb, ${accent} 20%, transparent), 0 4px 16px rgba(0,0,0,0.12)` : "0 4px 16px rgba(0,0,0,0.08)" }}>
              {photo
                ? <img src={photo} alt={cat.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 15%, var(--carta-surface)), color-mix(in srgb, ${accent} 5%, var(--carta-surface)))` }}><span style={{ fontSize: "2rem", opacity: 0.35 }}>🍽️</span></div>}
              <div style={{ position: "absolute", inset: 0, background: photo ? "linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.72))" : "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.52))" }} />
              <b style={{ position: "relative", zIndex: 1, fontSize: 14, lineHeight: 1.15, textShadow: "0 2px 14px #000", color: "#fff", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", width: "100%" }}>{cat.name}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Card glass (foto izquierda, texto derecha) ──
function ImpactCard({ product, accent, onClick, onAdd }: {
  product: StoreProduct; accent: string; onClick: () => void; onAdd: (e: React.MouseEvent) => void;
}) {
  const soldOut = product.is_sold_out;
  const discountPct = product.original_price && product.original_price > product.price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
  const hasOpts = (product.option_groups?.length ?? 0) > 0;
  return (
    <button onClick={soldOut ? undefined : onClick} style={{
      width: "100%", display: "grid", gridTemplateColumns: "118px 1fr", gap: 16, padding: 10, marginBottom: 11, borderRadius: 26,
      background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-text) 7.5%, transparent), color-mix(in srgb, var(--carta-text) 2.5%, transparent))",
      border: "1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)",
      position: "relative", overflow: "hidden", textAlign: "left", cursor: soldOut ? "not-allowed" : "pointer", opacity: soldOut ? 0.55 : 1, fontFamily: "inherit",
    }}>
      <div style={{ position: "relative", width: 118, height: 118, borderRadius: 20, overflow: "hidden", flexShrink: 0, background: product.image_url ? "#222" : `linear-gradient(145deg, color-mix(in srgb, ${accent} 15%, var(--carta-surface)), color-mix(in srgb, ${accent} 5%, var(--carta-surface)))` }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem" }}>🍽️</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, paddingRight: 38 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--carta-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</h4>
        {product.description && <p style={{ margin: "0 0 8px", color: "var(--carta-text2)", fontSize: 13, lineHeight: 1.42, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{product.description}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {soldOut ? <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#888" }}>Agotado</span> : (<>
            {discountPct > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: accent, padding: "3px 10px", borderRadius: 50 }}>-{discountPct}%</span>}
            <b style={{ color: accent, fontSize: 16 }}>{clp(product.price)}</b>
            {discountPct > 0 && <span style={{ fontSize: "0.78rem", color: "var(--carta-text3)", textDecoration: "line-through" }}>{clp(product.original_price!)}</span>}
          </>)}
        </div>
      </div>
      {!soldOut && (
        <span role="button" onClick={hasOpts ? undefined : onAdd} style={{ position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: "50%", background: `color-mix(in srgb, ${accent} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px color-mix(in srgb, ${accent} 50%, transparent)`, pointerEvents: hasOpts ? "none" : "auto" }}>
          <Plus size={16} color="#fff" />
        </span>
      )}
    </button>
  );
}
