"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Search, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import type { StorefrontData } from "@/lib/ecommerce/storefront-data";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e";

type Product = StorefrontData["products"][number];

export default function EcommerceCatalogoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Banner destacado (tema impact): hasta 5 productos, guardado en ecommerceStoreConfig.
  const BANNER_MAX = 5;
  const [bannerIds, setBannerIds] = useState<string[]>([]);
  const cfgRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) { cfgRef.current = d.config; setBannerIds(Array.isArray(d.config.bannerProductIds) ? d.config.bannerProductIds : []); } })
      .catch(() => {});
  }, [restaurantId]);
  const toggleBanner = useCallback((id: string) => {
    setBannerIds((prev) => {
      const has = prev.includes(id);
      if (!has && prev.length >= BANNER_MAX) { toast.error(`Máximo ${BANNER_MAX} productos en el banner`); return prev; }
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      const cfg = { ...cfgRef.current, bannerProductIds: next };
      cfgRef.current = cfg;
      fetch("/api/panel/ecommerce/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: cfg }) })
        .then((r) => { if (!r.ok) throw new Error(); })
        .catch(() => toast.error("No se pudo guardar el banner"));
      return next;
    });
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  const prodTotal = products.length;
  const q = search.trim().toLowerCase();
  const filteredProducts = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 14 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={20} color={ACCENT} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Catálogo</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Asigna el código POS a cada producto y modificador para enviar los pedidos a tu punto de venta.</p>
        </div>
      </div>


      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}><Loader2 size={16} className="animate-spin" /> Cargando catálogo…</p>
      ) : prodTotal === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)", marginTop: 16 }}>No hay productos en tu carta.</div>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={15} color="var(--adm-text3)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o código…" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "10px 12px" }}>
                <Star size={16} color={ACCENT} fill={ACCENT} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)" }}>Toca la ⭐ para destacar productos en el <b>banner</b> de la tienda (tema Impact).</span>
                <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: bannerIds.length ? ACCENT : "var(--adm-text3)" }}>{bannerIds.length}/{BANNER_MAX}</span>
              </div>
              {(q ? [{ id: "_all", name: "", position: 0 }] : categories).map((cat) => {
                const catProducts = q ? filteredProducts : filteredProducts.filter((p) => p.category_id === cat.id);
                if (!catProducts.length) return null;
                return (
                  <div key={cat.id}>
                    {!q && <h2 style={sectionTitle}>{cat.name}</h2>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {catProducts.map((p) => (
                        <Row key={p.id} name={p.name}
                          star={{ on: bannerIds.includes(p.id), disabled: !bannerIds.includes(p.id) && bannerIds.length >= BANNER_MAX, onClick: () => toggleBanner(p.id) }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
        </>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 2px 8px" };

function Row({ name, star }: { name: string; star?: { on: boolean; disabled: boolean; onClick: () => void } }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      {star && (
        <button
          onClick={star.disabled ? undefined : star.onClick}
          title={star.on ? "Quitar del banner" : star.disabled ? "Máximo 5 en el banner" : "Destacar en el banner"}
          style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: star.disabled ? "not-allowed" : "pointer", display: "grid", placeItems: "center", opacity: star.disabled ? 0.35 : 1 }}
        >
          <Star size={18} color={star.on ? ACCENT : "var(--adm-text3)"} fill={star.on ? ACCENT : "none"} />
        </button>
      )}
      <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </div>
  );
}
