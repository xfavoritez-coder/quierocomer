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
import { ShoppingCart, Search, X, Menu as MenuIcon, Plus, MapPin, ChevronRight } from "lucide-react";
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
  basePath?: string; // ruta base de la tienda ("" en dominio propio, /ecommerce/<slug> en el principal)
}

const FB = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY = "'Bebas Neue', Impact, sans-serif";

export default function ImpactStoreFront({ tenant, categories, products, basePath }: Props) {
  const accent = tenant.primaryColor;
  const storeBase = basePath ?? `/ecommerce/${tenant.slug}`;
  useFavicon(tenant.logoUrl);

  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Diagnóstico: /ecommerce/<slug>?nobanner=1 desactiva el carrusel de destacados
  // para aislar si el parpadeo viene del banner.
  const [noBanner, setNoBanner] = useState(false);
  useEffect(() => {
    try { setNoBanner(new URLSearchParams(window.location.search).has("nobanner")); } catch {}
  }, []);

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
  const chipsRef = useRef<HTMLDivElement>(null);
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
    if (noBanner) return [];
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
  }, [products, tenant.bannerProductIds, noBanner]);

  const isOpen = tenant.openStatus.open;

  // Scroll-spy: marca la categoría activa según la sección visible al hacer scroll.
  useEffect(() => {
    const ids = grouped.map((g) => g.cat.id);
    if (ids.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveCat(vis[0].target.id.replace("impact-cat-", ""));
      },
      { rootMargin: `-${headerH + 56}px 0px -55% 0px`, threshold: 0 },
    );
    ids.forEach((id) => { const el = document.getElementById(`impact-cat-${id}`); if (el) obs.observe(el); });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, headerH]);

  // Auto-desplazar el chip activo para que quede a la vista en la barra.
  useEffect(() => {
    const cont = chipsRef.current;
    if (!cont || !activeCat) return;
    const el = cont.querySelector(`[data-cat="${activeCat}"]`) as HTMLElement | null;
    if (el) cont.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" });
  }, [activeCat]);

  // Si el cliente aún no ha definido entrega/retiro, cualquier intento de abrir o
  // agregar un producto abre PRIMERO el modal de entrega; el producto queda "pendiente"
  // y se abre solo cuando el cliente completa la selección.
  const [pendingProduct, setPendingProduct] = useState<StoreProduct | null>(null);

  const openProduct = useCallback((p: StoreProduct) => {
    if (p.is_sold_out) return;
    if (!deliverySelected) { setPendingProduct(p); setDeliveryModalOpen(true); return; }
    setSelectedProduct(p);
  }, [deliverySelected]);

  const directAdd = useCallback((p: StoreProduct) => {
    if (p.is_sold_out || !isOpen) return;
    if (!deliverySelected) { setPendingProduct(p); setDeliveryModalOpen(true); return; }
    if (p.option_groups && p.option_groups.length > 0) { setSelectedProduct(p); return; }
    addItem({ product_id: p.id, name: p.name, unit_price: p.price, base_price: p.price, quantity: 1, image_url: p.image_url, toteat_code: p.toteat_code, options: [] });
  }, [addItem, isOpen, deliverySelected]);

  // Al cerrarse el modal de entrega con un producto pendiente: si el cliente eligió
  // entrega/retiro, abrimos el producto; si canceló, simplemente descartamos el pendiente.
  useEffect(() => {
    if (deliveryModalOpen || !pendingProduct) return;
    if (deliverySelected) setSelectedProduct(pendingProduct);
    setPendingProduct(null);
  }, [deliveryModalOpen, deliverySelected, pendingProduct]);

  function scrollToCategory(id: string) {
    setActiveCat(id);
    document.getElementById(`impact-cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const deliveryLabel = !mounted
    ? "Delivery o Retiro"
    : deliverySelected
      ? (deliveryType === "delivery" ? (deliveryAddress?.address ? deliveryAddress.address.split(",")[0] : "Envío a domicilio") : "Listo para retirar")
      : "Elige Delivery o Retiro";
  const deliveryEyebrow = !mounted
    ? " "
    : deliverySelected
      ? (deliveryType === "delivery" ? "Delivery a domicilio" : "Retiro en el local")
      : "Empieza tu pedido aquí";

  // Tokens oscuros del tema impact (idénticos a OrderMenuPage dark).
  const themeVars = {
    "--carta-bg": "#0e0e0e", "--carta-surface": "#1a1a1a",
    "--carta-text": "#f0f0f0", "--carta-text2": "#aaa", "--carta-text3": "#555",
    "--carta-border": "#262626", "--carta-accent": accent,
    "--carta-plus-icon": "#fff", "--carta-btn-text": "#fff",
    fontFamily: FB,
  } as React.CSSProperties;

  return (
    <div className="qc-storefront qc-impact" style={{ minHeight: "100dvh", color: "var(--carta-text)", position: "relative", background: "#0b0b0b", ...themeVars }}>
      <StoreStyles />
      <ImpactSkin />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .imp-scroll::-webkit-scrollbar{display:none}
        .imp-menu-grid{max-width:1200px;margin:0 auto}
        .imp-plato-grid{display:grid;grid-template-columns:1fr;gap:11px}
        @media (min-width:1024px){.imp-plato-grid{grid-template-columns:repeat(3,1fr);gap:16px}}
        @keyframes imp-bump{0%{transform:scale(1)}30%{transform:scale(1.16)}100%{transform:scale(1)}}
      `}</style>

      {/* Degradado del color de la tienda, FIJO (una sola capa de gradiente puro,
          sin blur ni backdrop-filter) — visible arriba y al hacer scroll. */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: `radial-gradient(120% 55% at 50% -8%, color-mix(in srgb, ${accent} 42%, transparent), transparent 62%), radial-gradient(90% 45% at 100% 28%, color-mix(in srgb, ${accent} 20%, transparent), transparent 58%), radial-gradient(95% 48% at 0% 66%, color-mix(in srgb, ${accent} 18%, transparent), transparent 58%), radial-gradient(120% 50% at 50% 108%, color-mix(in srgb, ${accent} 22%, transparent), transparent 62%)` }} />

      {/* ── Header glass ── */}
      <div ref={headerRef} style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(16,16,16,0.45)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
        <div className="imp-menu-grid" style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 16px 10px" }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Menú" style={glassBtn}><MenuIcon size={18} color="#eaeaea" /></button>
          {tenant.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.name} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
            : <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: "grid", placeItems: "center", fontWeight: 800, color: "#0e0e0e" }}>{tenant.name.charAt(0).toUpperCase()}</div>}
          <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tenant.name}</span>
          <button onClick={() => setCartOpen(true)} aria-label="Carrito" style={{
            position: "relative", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
            background: mounted && itemCount > 0 ? `color-mix(in srgb, ${accent} 55%, rgba(255,255,255,0.10))` : "rgba(255,255,255,0.12)",
            border: mounted && itemCount > 0 ? `1px solid color-mix(in srgb, ${accent} 38%, rgba(255,255,255,0.24))` : "1px solid rgba(255,255,255,0.16)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.32), 0 2px 8px rgba(0,0,0,0.28)",
          }}>
            <ShoppingCart size={17} color="#fff" />
            {mounted && itemCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: "rgba(255,255,255,0.28)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)", color: "#fff", fontSize: "0.62rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{itemCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Selector de entrega — DISTINTIVO, arriba del banner (puerta de entrada al pedido) ── */}
      <div className="imp-menu-grid" style={{ position: "relative", zIndex: 1, padding: "14px 14px 0" }}>
        <button onClick={() => setDeliveryModalOpen(true)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 18,
          padding: "13px 15px", color: "#fff", cursor: "pointer", textAlign: "left",
          background: deliverySelected
            ? "rgba(255,255,255,0.07)"
            : `color-mix(in srgb, ${accent} 13%, rgba(255,255,255,0.06))`,
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          border: deliverySelected
            ? "1px solid rgba(255,255,255,0.16)"
            : `1px solid color-mix(in srgb, ${accent} 34%, rgba(255,255,255,0.26))`,
          boxShadow: deliverySelected
            ? "inset 0 1px 0 rgba(255,255,255,0.16)"
            : `inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 24px color-mix(in srgb, ${accent} 22%, transparent)`,
        }}>
          <span style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: accent, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 3px 10px rgba(0,0,0,0.3)" }}>
            <MapPin size={21} color="#fff" strokeWidth={2.4} />
          </span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase", color: deliverySelected ? "rgba(255,255,255,0.5)" : `color-mix(in srgb, ${accent} 45%, #ffffff)` }}>{deliveryEyebrow}</span>
            <span style={{ fontSize: "1rem", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.15 }}>{deliveryLabel}</span>
          </span>
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 2, fontSize: "0.8rem", fontWeight: 800, color: accent }}>
            {deliverySelected ? "Cambiar" : "Elegir"}<ChevronRight size={16} color={accent} />
          </span>
        </button>
      </div>

      {/* ── Banner de destacados ── */}
      {heroProducts.length > 0 && (
        <div className="imp-menu-grid" style={{ position: "relative", zIndex: 1, padding: "14px 14px 0" }}>
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

      {/* ── Chips de categorías — flotando (glass), sticky al hacer scroll ── */}
      {!searchOpen && grouped.length > 0 && (
        <div ref={chipsRef} className="imp-scroll imp-menu-grid" style={{ position: "sticky", top: headerH - 1, zIndex: 38, display: "flex", gap: 8, overflowX: "auto", padding: "10px 14px 10px", scrollbarWidth: "none", background: "transparent" }}>
          {grouped.map(({ cat }) => {
            const on = cat.id === activeCat;
            return (
              <button key={cat.id} data-cat={cat.id} onClick={() => scrollToCategory(cat.id)} style={{
                whiteSpace: "nowrap", flexShrink: 0, padding: "10px 18px", fontSize: 15, fontWeight: 800, cursor: "pointer", borderRadius: 999,
                // Liquid glass NEUTRO (sin tinte de la tienda). El backdrop-filter recorta bien
                // al pill porque el radio y el filtro van en el MISMO elemento. Nada de sombra
                // externa oscura (creaba la "franja gris" sobre fotos claras): solo vidrio
                // translucido + brillo interno especular + borde blanco tenue.
                // Activo = el mismo vidrio, un poco mas opaco y con borde mas marcado.
                background: on ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.11)",
                backdropFilter: "blur(18px) saturate(180%) brightness(1.06)",
                WebkitBackdropFilter: "blur(18px) saturate(180%) brightness(1.06)",
                border: on ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.26)",
                boxShadow: on
                  ? "inset 0 1px 0.5px rgba(255,255,255,0.6), inset 0 -6px 12px rgba(255,255,255,0.07)"
                  : "inset 0 1px 0.5px rgba(255,255,255,0.5), inset 0 -6px 12px rgba(255,255,255,0.06)",
                color: "#fff",
                textShadow: "0 1px 5px rgba(0,0,0,0.6)",
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
            <div className="imp-plato-grid">
              {g.items.map((p) => (
                <ImpactCard key={p.id} product={p} accent={accent} onClick={() => openProduct(p)} onAdd={(e) => { e.stopPropagation(); directAdd(p); }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Barra de carrito glass ── */}
      {mounted && itemCount > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 45, padding: "12px 16px", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))", background: "transparent", pointerEvents: "none", display: "flex", justifyContent: "center" }}>
          {/* Botón flotante liquid glass (sin recuadro de fondo) */}
          <button onClick={() => setCartOpen(true)} style={{
            pointerEvents: "auto", width: "auto", maxWidth: "96%", padding: "15px 34px", borderRadius: 999,
            display: "flex", justifyContent: "center", gap: 38, alignItems: "center", cursor: "pointer", color: "#fff", fontFamily: FB,
            background: `color-mix(in srgb, ${accent} 26%, rgba(255,255,255,0.10))`,
            backdropFilter: "blur(18px) saturate(185%) brightness(1.06)", WebkitBackdropFilter: "blur(18px) saturate(185%) brightness(1.06)",
            border: `1px solid color-mix(in srgb, ${accent} 30%, rgba(255,255,255,0.22))`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.32), 0 10px 28px color-mix(in srgb, ${accent} 30%, rgba(0,0,0,0.4))`,
            transform: "translateZ(0)",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{itemCount}&nbsp;&nbsp;Ver carrito</span>
            </span>
            <span style={{ fontWeight: 800, fontSize: "1.05rem", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{clp(subtotal)}</span>
          </button>
        </div>
      )}

      {/* ── Flujos reutilizados (oscuros por ImpactSkin) ── */}
      {selectedProduct && <ProductModal product={selectedProduct} primaryColor={accent} onClose={() => setSelectedProduct(null)} />}
      {deliveryModalOpen && <DeliveryModal tenant={tenant} primaryColor={accent} onClose={() => setDeliveryModalOpen(false)} />}
      {menuOpen && <CustomerMenu tenant={tenant} primaryColor={accent} onClose={() => setMenuOpen(false)} side="left" products={products} />}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} tenant={tenant} primaryColor={accent} mobileOnly={false} basePath={storeBase} onOpenDeliveryModal={() => { setCartOpen(false); setDeliveryModalOpen(true); }} />
    </div>
  );
}

const glassBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.12)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30), 0 2px 8px rgba(0,0,0,0.28)",
  display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
};

// ── Banner de destacados (carrusel) ──
function ImpactHero({ heroProducts, accent, onSelect, onAdd }: {
  heroProducts: StoreProduct[]; accent: string; onSelect: (p: StoreProduct) => void; onAdd: (p: StoreProduct) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const touchX = useRef(0);
  const wasSwipe = useRef(false);
  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setCurrent((c) => (c + 1) % heroProducts.length), 5000);
  }, [heroProducts.length]);

  // Solo auto-avanzar cuando el banner está a la vista (y la pestaña visible).
  // Al bajar al menú el carrusel se detiene → sin repintados = sin parpadeo.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    const onVis = () => { const r = el.getBoundingClientRect(); setVisible(!document.hidden && r.bottom > 0 && r.top < window.innerHeight); };
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  useEffect(() => {
    if (heroProducts.length <= 1 || !visible || document.hidden) return;
    reset();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [heroProducts.length, reset, visible]);

  const d = heroProducts[current];
  if (!d) return null;
  const discountPct = d.original_price && d.original_price > d.price ? Math.round(((d.original_price - d.price) / d.original_price) * 100) : 0;
  const hasOpts = (d.option_groups?.length ?? 0) > 0;

  return (
    <section
      ref={sectionRef}
      style={{ minHeight: "54vh", position: "relative", display: "flex", alignItems: "flex-end", padding: "72px 18px 16px", borderRadius: 26, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", cursor: "pointer" }}
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
        {/* fontSize responsivo (clamp+vw) y resplandor en em → el glow escala con el
            titulo y su proporcion respecto a la pantalla es constante en cualquier
            tamaño (antes: 52px y 20px fijos se veian mas fuertes en pantallas chicas). */}
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: "clamp(2.9rem, 12.5vw, 3.35rem)", lineHeight: 0.82, letterSpacing: "0.5px", textShadow: "0 0.1em 0.55em rgba(0,0,0,0.9)", color: "#fff" }}>
          {d.name.split(" ").map((w, i, arr) => i === arr.length - 1
            ? <span key={i} style={{ display: "inline-block", color: accent, fontWeight: 900, textShadow: `0 0 0.32em color-mix(in srgb, ${accent} 46%, transparent)` }}>{w}</span>
            : <span key={i}>{w} </span>)}
        </h1>
        {d.description && <p style={{ maxWidth: 320, margin: "14px 0 16px", color: "#b0a89e", fontSize: 15, lineHeight: 1.5, textShadow: "0 1px 8px rgba(0,0,0,0.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.description}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {discountPct > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: accent, padding: "4px 11px", borderRadius: 50 }}>-{discountPct}%</span>}
            <span style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.8px" }}>{clp(d.price)}</span>
            {discountPct > 0 && <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>{clp(d.original_price!)}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); if (hasOpts) onSelect(d); else onAdd(d); }} style={{
            width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
            background: "transparent", border: "none", padding: 0,
          }}>
            <Plus size={30} color="#fff" strokeWidth={2} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }} />
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
          return (
            <button key={cat.id} onClick={() => onTap(cat.id)} style={{ width: 128, minWidth: 128, height: 148, borderRadius: 28, position: "relative", overflow: "hidden", padding: 13, display: "flex", flexDirection: "column", justifyContent: "flex-end", cursor: "pointer", flexShrink: 0, background: "var(--carta-surface)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
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
      width: "100%", display: "grid", gridTemplateColumns: "132px 1fr", gap: 16, padding: 10, borderRadius: 26, minHeight: 152,
      background: "linear-gradient(135deg, color-mix(in srgb, var(--carta-text) 7.5%, transparent), color-mix(in srgb, var(--carta-text) 2.5%, transparent))",
      border: "1px solid color-mix(in srgb, var(--carta-text) 10%, transparent)",
      position: "relative", overflow: "hidden", textAlign: "left", cursor: soldOut ? "not-allowed" : "pointer", opacity: soldOut ? 0.55 : 1, fontFamily: "inherit",
    }}>
      <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 132, borderRadius: 20, overflow: "hidden", flexShrink: 0, background: product.image_url ? "#222" : `linear-gradient(145deg, color-mix(in srgb, ${accent} 15%, var(--carta-surface)), color-mix(in srgb, ${accent} 5%, var(--carta-surface)))` }}>
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
        <span role="button" onClick={hasOpts ? undefined : onAdd} style={{
          position: "absolute", bottom: 6, right: 8, width: 34, height: 34,
          display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: hasOpts ? "none" : "auto",
        }}>
          <Plus size={24} color="#fff" strokeWidth={2} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }} />
        </span>
      )}
    </button>
  );
}
