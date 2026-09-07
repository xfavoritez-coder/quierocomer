"use client";
// ═══════════════════════════════════════════════════════════
//  Tema "Impact" del storefront del Ecommerce — diseño oscuro
//  (liquid glass) portado del tema impact de /pedir. Responsive
//  (mobile + desktop). Reutiliza el cart-store y los flujos
//  (ProductModal, CartDrawer, DeliveryModal, CustomerMenu).
// ═══════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useCallback } from "react";
import { ShoppingCart, Search, X, Menu as MenuIcon, Plus, MapPin, Heart } from "lucide-react";
import type { StoreTenant, StoreCategory, StoreProduct } from "@/lib/ecommerce/storefront-data";
import { useCartStore } from "@/lib/ecommerce/cart-store";
import { clp } from "@/lib/ecommerce/format";
import { useFavicon } from "@/lib/ecommerce/useFavicon";
import ProductModal from "./ProductModal";
import CartDrawer from "./CartDrawer";
import CustomerMenu from "./CustomerMenu";
import { DeliveryModal } from "./StoreFront";

interface Props {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
}

const BODY_SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY_SERIF = "Georgia, 'Times New Roman', serif";

export default function ImpactStoreFront({ tenant, categories, products }: Props) {
  const accent = tenant.primaryColor;
  useFavicon(tenant.logoUrl);

  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bump, setBump] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  const setRestaurantId = useCartStore((s) => s.setRestaurantId);
  const addItem = useCartStore((s) => s.addItem);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());
  const deliveryType = useCartStore((s) => s.deliveryType);
  const deliverySelected = useCartStore((s) => s.deliverySelected);
  const deliveryAddress = useCartStore((s) => s.deliveryAddress);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setRestaurantId(tenant.id); }, [tenant.id, setRestaurantId]);

  useEffect(() => {
    if (!tenant.favoritesEnabled) return;
    fetch("/api/qr/favorites").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (Array.isArray(d?.dishIds)) setFavIds(new Set(d.dishIds));
    }).catch(() => {});
  }, [tenant.favoritesEnabled]);
  const toggleFav = useCallback((dishId: string) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      if (next.has(dishId)) { next.delete(dishId); fetch(`/api/qr/favorites?dishId=${encodeURIComponent(dishId)}`, { method: "DELETE" }).catch(() => {}); }
      else { next.add(dishId); fetch("/api/qr/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId, restaurantId: tenant.id }) }).catch(() => {}); }
      return next;
    });
  }, [tenant.id]);

  const byCategory = useMemo(() => {
    const m = new Map<string, StoreProduct[]>();
    for (const p of products) { const arr = m.get(p.category_id) ?? []; arr.push(p); m.set(p.category_id, arr); }
    return m;
  }, [products]);

  const q = search.trim().toLowerCase();
  const visibleCats = useMemo(() => {
    return categories
      .map((c) => {
        let items = byCategory.get(c.id) ?? [];
        if (activeCat && c.id !== activeCat) items = [];
        if (q) items = items.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
        return { cat: c, items };
      })
      .filter((g) => g.items.length > 0);
  }, [categories, byCategory, activeCat, q]);

  const isOpen = tenant.openStatus.open;

  function pulseBump() { setBump(true); setTimeout(() => setBump(false), 250); }

  function onCardClick(p: StoreProduct) { if (!p.is_sold_out) setSelectedProduct(p); }
  function quickAdd(e: React.MouseEvent, p: StoreProduct) {
    e.stopPropagation();
    if (p.is_sold_out || !isOpen) return;
    if (p.option_groups && p.option_groups.length > 0) { setSelectedProduct(p); return; }
    addItem({ product_id: p.id, name: p.name, unit_price: p.price, base_price: p.price, quantity: 1, image_url: p.image_url, toteat_code: p.toteat_code, options: [] });
    pulseBump();
  }

  const deliveryLabel = !mounted
    ? "Entrega o retiro"
    : deliverySelected
      ? (deliveryType === "delivery" ? (deliveryAddress?.address ? `Entrega · ${deliveryAddress.address.split(",")[0]}` : "Delivery") : "Retiro en el local")
      : "Elige entrega o retiro";

  const accentSoft = hexA(accent, 0.4);

  return (
    <div style={{ minHeight: "100dvh", background: "#0e0e0e", color: "#f0f0f0", fontFamily: BODY_SANS }}>
      <style>{`
        .imp-scroll::-webkit-scrollbar{display:none}
        .imp-wrap{max-width:660px;margin:0 auto;padding-left:14px;padding-right:14px}
        @media(min-width:980px){.imp-wrap{max-width:1120px;padding-left:28px;padding-right:28px}}
        .imp-grid{display:flex;flex-direction:column;gap:12px}
        @media(min-width:620px){.imp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
        @media(min-width:1024px){.imp-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        .imp-card{transition:border-color .15s, transform .12s, box-shadow .15s}
        .imp-card:hover{transform:translateY(-3px);border-color:${accentSoft};box-shadow:0 10px 30px rgba(0,0,0,.45)}
        .imp-hero{height:230px}
        @media(min-width:980px){.imp-hero{height:300px}}
        .imp-catbar{width:34px;height:3px;border-radius:2px;background:${accent};margin-bottom:12px}
        @keyframes imp-bump{0%{transform:scale(1)}30%{transform:scale(1.18)}100%{transform:scale(1)}}
        .imp-bump{animation:imp-bump .25s ease}
        .imp-addbtn:hover{transform:scale(1.12)}
      `}</style>

      {/* ── HERO ── */}
      <div className="imp-hero" style={{ position: "relative", width: "100%", overflow: "hidden", background: `linear-gradient(135deg, #1a0000 0%, #201014 42%, #141414 100%)` }}>
        <div style={{ position: "absolute", top: -70, left: "50%", transform: "translateX(-50%)", width: 420, height: 260, background: `radial-gradient(ellipse, ${hexA(accent, 0.32)} 0%, transparent 70%)`, pointerEvents: "none" }} />
        {tenant.bannerUrl && (
          <img src={tenant.bannerUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.32 }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(14,14,14,0.85) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 20px" }}>
          {tenant.logoUrl && (
            <img src={tenant.logoUrl} alt={tenant.name} style={{ width: 78, height: 78, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.92)", boxShadow: "0 6px 24px rgba(0,0,0,0.55)" }} />
          )}
          <div style={{ fontFamily: DISPLAY_SERIF, fontSize: "1.6rem", fontWeight: 700, color: "#fff", textAlign: "center", textShadow: "0 2px 14px rgba(0,0,0,0.65)", letterSpacing: "0.01em" }}>{tenant.name}</div>
          {(tenant.waitTimeDelivery || tenant.waitTimePickup) && (
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.78)", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "4px 12px" }}>⏱ {tenant.waitTimeDelivery || tenant.waitTimePickup} min</div>
          )}
        </div>
      </div>

      {/* ── STICKY HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(14,14,14,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="imp-wrap" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Menú" style={iconBtn}><MenuIcon style={{ width: 18, height: 18 }} /></button>
          {tenant.logoUrl && <img src={tenant.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.15)" }} />}
          <div style={{ flex: 1, minWidth: 0, fontSize: "0.95rem", fontWeight: 800, color: "#f0f0f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tenant.name}</div>
          <button onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(""); }} aria-label="Buscar" style={iconBtn}>
            {searchOpen ? <X style={{ width: 18, height: 18 }} /> : <Search style={{ width: 18, height: 18 }} />}
          </button>
          <button onClick={() => setCartOpen(true)} aria-label="Carrito" className={bump ? "imp-bump" : ""}
            style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: mounted && itemCount > 0 ? accent : "#222", color: "#fff" }}>
            <ShoppingCart style={{ width: 18, height: 18 }} />
            {mounted && itemCount > 0 && (
              <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: "#fff", color: accent, fontSize: "0.62rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{itemCount}</span>
            )}
          </button>
        </div>

        {searchOpen ? (
          <div className="imp-wrap" style={{ paddingBottom: 10 }}>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar productos…"
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: "16px", outline: "none" }} />
          </div>
        ) : (
          <div className="imp-scroll imp-wrap" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
            <Pill label="Todo" active={activeCat === null} accent={accent} onClick={() => setActiveCat(null)} />
            {categories.map((c) => (
              <Pill key={c.id} label={c.name} active={activeCat === c.id} accent={accent} onClick={() => setActiveCat(c.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Selector de entrega ── */}
      <div className="imp-wrap" style={{ paddingTop: 12 }}>
        <button onClick={() => setDeliveryModalOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "11px 13px", color: "#f0f0f0", cursor: "pointer", textAlign: "left" }}>
          <MapPin style={{ width: 16, height: 16, color: accent, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: "0.84rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deliveryLabel}</span>
          <span style={{ fontSize: "0.74rem", color: accent, fontWeight: 800 }}>Cambiar</span>
        </button>
      </div>

      {/* ── Banner cerrado ── */}
      {!isOpen && (
        <div className="imp-wrap" style={{ paddingTop: 10 }}>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px", fontSize: "0.82rem", color: "#ddd", textAlign: "center" }}>
            🔒 Estamos cerrados ahora{tenant.openStatus.opensAt ? ` · abrimos a las ${tenant.openStatus.opensAt}` : ""}
          </div>
        </div>
      )}

      {/* ── DISHES ── */}
      <div className="imp-wrap" style={{ padding: `8px 14px ${mounted && itemCount > 0 ? 120 : 48}px` }}>
        {visibleCats.map((g) => (
          <div key={g.cat.id} style={{ marginTop: 22 }}>
            <div className="imp-catbar" />
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", letterSpacing: "0.01em", margin: "0 0 12px" }}>{g.cat.name}</h2>
            <div className="imp-grid">
              {g.items.map((p) => (
                <ImpactCard key={p.id} product={p} accent={accent} soldOut={p.is_sold_out}
                  showFav={tenant.favoritesEnabled} isFav={favIds.has(p.id)} onToggleFav={() => toggleFav(p.id)}
                  onClick={() => onCardClick(p)} onAdd={(e) => quickAdd(e, p)} />
              ))}
            </div>
          </div>
        ))}
        {visibleCats.length === 0 && (
          <div style={{ textAlign: "center", padding: "70px 20px", color: "#666" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: "0.9rem" }}>No encontramos productos</div>
          </div>
        )}
      </div>

      {/* ── STICKY CART BAR ── */}
      {mounted && itemCount > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 45, padding: "10px 16px calc(16px + env(safe-area-inset-bottom))", background: "rgba(14,14,14,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
          <button onClick={() => setCartOpen(true)} style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "15px 20px", borderRadius: 14, border: "none", background: accent, color: "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 4px 22px ${hexA(accent, 0.4)}`, fontFamily: BODY_SANS }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 25, height: 25, borderRadius: "50%", background: "rgba(0,0,0,0.28)", fontSize: "0.8rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{itemCount}</span>
              <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>Ver carrito</span>
            </span>
            <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{clp(subtotal)}</span>
          </button>
        </div>
      )}

      {/* ── Sub-componentes de flujo (reutilizados) ── */}
      {selectedProduct && <ProductModal product={selectedProduct} primaryColor={accent} onClose={() => setSelectedProduct(null)} />}
      {deliveryModalOpen && <DeliveryModal tenant={tenant} primaryColor={accent} onClose={() => setDeliveryModalOpen(false)} />}
      {menuOpen && <CustomerMenu tenant={tenant} primaryColor={accent} onClose={() => setMenuOpen(false)} />}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} tenant={tenant} primaryColor={accent} mobileOnly={false} onOpenDeliveryModal={() => { setCartOpen(false); setDeliveryModalOpen(true); }} />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)", color: "#f0f0f0", display: "flex", alignItems: "center",
  justifyContent: "center", cursor: "pointer", flexShrink: 0,
};

function Pill({ label, active, accent, onClick }: { label: string; active: boolean; accent: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: "7px 16px", borderRadius: 999, cursor: "pointer",
      fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
      border: `1.5px solid ${active ? accent : "rgba(255,255,255,0.12)"}`,
      background: active ? accent : "transparent", color: active ? "#fff" : "#9a9a9a",
    }}>{label}</button>
  );
}

function ImpactCard({ product, accent, soldOut, showFav, isFav, onToggleFav, onClick, onAdd }: {
  product: StoreProduct; accent: string; soldOut: boolean;
  showFav?: boolean; isFav?: boolean; onToggleFav?: () => void;
  onClick: () => void; onAdd: (e: React.MouseEvent) => void;
}) {
  return (
    <div onClick={soldOut ? undefined : onClick} className="imp-card" style={{
      background: "#1a1a1a", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)",
      display: "flex", alignItems: "stretch", overflow: "hidden", minHeight: 120,
      cursor: soldOut ? "not-allowed" : "pointer", opacity: soldOut ? 0.55 : 1,
    }}>
      <div style={{ flex: 1, padding: "15px 10px 15px 15px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f5f5f5", lineHeight: 1.3, marginBottom: 5 }}>{product.name}</div>
          {product.description && (
            <div style={{ fontSize: "0.72rem", color: "#8a8a8a", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{product.description}</div>
          )}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          {soldOut ? (
            <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", color: "#888" }}>Agotado</span>
          ) : product.original_price ? (
            <>
              <span style={{ fontSize: "0.95rem", fontWeight: 800, color: accent }}>{clp(product.price)}</span>
              <span style={{ fontSize: "0.8rem", color: "#666", textDecoration: "line-through" }}>{clp(product.original_price)}</span>
            </>
          ) : (
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: accent }}>{clp(product.price)}</span>
          )}
        </div>
      </div>
      <div style={{ width: 128, flexShrink: 0, position: "relative", background: "#222" }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🍽️</div>}
        {showFav && (
          <span role="button" aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"} onClick={(e) => { e.stopPropagation(); onToggleFav?.(); }}
            style={{ position: "absolute", top: 8, left: 8, width: 27, height: 27, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Heart style={{ width: 14, height: 14 }} fill={isFav ? accent : "none"} color={isFav ? accent : "#fff"} />
          </span>
        )}
        {!soldOut && (
          <button onClick={onAdd} aria-label="Agregar" className="imp-addbtn" style={{ position: "absolute", bottom: 8, right: 8, width: 30, height: 30, borderRadius: "50%", background: accent, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 12px ${hexA(accent, 0.45)}`, transition: "transform .1s" }}>
            <Plus style={{ width: 17, height: 17 }} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Convierte un hex (#rgb o #rrggbb) a rgba con alpha. Fallback: el color tal cual. */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
