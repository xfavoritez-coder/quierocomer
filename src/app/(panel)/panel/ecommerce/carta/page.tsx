"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Search, Check, Loader2, UtensilsCrossed, Package, Star, Ban } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import type { StorefrontData } from "@/lib/ecommerce/storefront-data";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e";

type Product = StorefrontData["products"][number];
interface DedupOption { id: string; name: string; code: string | null; price: number; soldOut: boolean }
interface DedupGroup { id: string; name: string; options: DedupOption[]; products: string[] }

export default function EcommerceCatalogoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"productos" | "modificadores">("productos");
  const [search, setSearch] = useState("");

  // Catálogo del POS Toteat (código→nombre) para mostrar el nombre Toteat al asignar código.
  const [toteatMap, setToteatMap] = useState<Record<string, { name: string; price: number }> | null>(null);
  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/toteat-catalog?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.map && Object.keys(d.map).length) setToteatMap(d.map); else setToteatMap(null); })
      .catch(() => setToteatMap(null));
  }, [restaurantId]);

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
    fetch(`/api/panel/ecommerce/menu?restaurantId=${restaurantId}&includeHidden=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  // Agotar / reactivar un producto (se refleja en el storefront con opacidad + badge).
  const toggleSoldOut = useCallback(async (id: string, next: boolean) => {
    setData((d) => d ? { ...d, products: d.products.map((p) => p.id === id ? { ...p, is_sold_out: next } : p) } : d);
    try {
      const res = await fetch(`/api/admin/dishes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soldOut: next }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "No se pudo actualizar"); setData((d) => d ? { ...d, products: d.products.map((p) => p.id === id ? { ...p, is_sold_out: !next } : p) } : d); return; }
      toast.success(next ? "Producto agotado" : "Producto disponible");
    } catch { toast.error("Error de conexión"); setData((d) => d ? { ...d, products: d.products.map((p) => p.id === id ? { ...p, is_sold_out: !next } : p) } : d); }
  }, []);

  const toggleModSoldOut = useCallback(async (id: string, next: boolean) => {
    const apply = (val: boolean) => setData((d) => d ? {
      ...d,
      products: d.products.map((p) => ({
        ...p,
        option_groups: (p.option_groups ?? []).map((g) => ({
          ...g,
          values: g.values.map((v) => v.id === id ? { ...v, is_sold_out: val } : v),
        })),
      })),
    } : d);
    apply(next);
    try {
      const res = await fetch(`/api/admin/modifiers/${id}/sold-out`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soldOut: next }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "No se pudo actualizar"); apply(!next); return; }
      toast.success(next ? "Modificador agotado" : "Modificador disponible");
    } catch { toast.error("Error de conexión"); apply(!next); }
  }, []);

  // Modificadores deduplicados (un template compartido aparece en varios productos).
  const dedupGroups = useMemo<DedupGroup[]>(() => {
    const map = new Map<string, DedupGroup>();
    for (const p of products) {
      for (const g of p.option_groups ?? []) {
        let grp = map.get(g.id);
        if (!grp) { grp = { id: g.id, name: g.name, options: [], products: [] }; map.set(g.id, grp); }
        if (p.name && !grp.products.includes(p.name)) grp.products.push(p.name);
        for (const v of g.values) {
          if (!grp.options.some((o) => o.id === v.id)) grp.options.push({ id: v.id, name: v.name, code: v.toteat_modifier_code, price: v.price_delta, soldOut: v.is_sold_out === true });
        }
      }
    }
    return [...map.values()];
  }, [products]);

  const prodTotal = products.length;
  const prodWithCode = products.filter((p) => p.toteat_code).length;
  const modOptions = dedupGroups.flatMap((g) => g.options);
  const modTotal = modOptions.length;
  const modWithCode = modOptions.filter((o) => o.code).length;

  const q = search.trim().toLowerCase();
  const filteredProducts = q ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.toteat_code ?? "").toLowerCase().includes(q)) : products;
  const filteredGroups = q
    ? dedupGroups.map((g) => ({ ...g, options: g.options.filter((o) => o.name.toLowerCase().includes(q) || (o.code ?? "").toLowerCase().includes(q)) })).filter((g) => g.options.length)
    : dedupGroups;

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

      {/* Tabs */}
      {!loading && prodTotal > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <TabBtn active={tab === "productos"} onClick={() => { setTab("productos"); setSearch(""); }} icon={<Package size={15} />} label="Productos" count={`${prodWithCode}/${prodTotal}`} done={prodWithCode === prodTotal} />
          <TabBtn active={tab === "modificadores"} onClick={() => { setTab("modificadores"); setSearch(""); }} icon={<UtensilsCrossed size={15} />} label="Modificadores" count={`${modWithCode}/${modTotal}`} done={modTotal > 0 && modWithCode === modTotal} />
        </div>
      )}

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

          {tab === "productos" ? (
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
                        <Row key={p.id} name={p.name} initial={p.toteat_code} endpoint={`/api/admin/dishes/${p.id}/map-toteat`} toteatMap={toteatMap} qcPrice={p.price}
                          soldOut={p.is_sold_out} onToggleSoldOut={() => toggleSoldOut(p.id, !p.is_sold_out)} hidden={p.hidden}
                          star={{ on: bannerIds.includes(p.id), disabled: !bannerIds.includes(p.id) && bannerIds.length >= BANNER_MAX, onClick: () => toggleBanner(p.id) }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : modTotal === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)" }}>Tus productos no tienen modificadores.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {filteredGroups.map((g) => (
                <div key={g.id}>
                  <h2 style={sectionTitle}>{g.name}</h2>
                  {g.products.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 2px 10px" }}>
                      {g.products.map((pn) => (
                        <span key={pn} style={{ fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text2)", background: "var(--adm-card2, rgba(0,0,0,0.04))", border: "1px solid var(--adm-card-border)", borderRadius: 999, padding: "3px 9px" }}>{pn}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {g.options.map((o) => (
                      <Row key={o.id} name={o.name} initial={o.code} endpoint={`/api/admin/modifiers/${o.id}/map-toteat`} toteatMap={toteatMap} qcPrice={o.price}
                        soldOut={o.soldOut} onToggleSoldOut={() => toggleModSoldOut(o.id, !o.soldOut)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 2px 8px" };

function TabBtn({ active, onClick, icon, label, count, done }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: string; done: boolean }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, border: `1px solid ${active ? ACCENT : "var(--adm-card-border)"}`, background: active ? ACCENT : "var(--adm-hover)", color: active ? "#1a1a1a" : "var(--adm-text2)" }}>
      {icon} {label}
      <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 700, color: active ? "#1a1a1a" : done ? GREEN : "var(--adm-text3)", opacity: active ? 0.75 : 1 }}>{count}</span>
    </button>
  );
}

const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

function Row({ name, initial, endpoint, star, toteatMap, qcPrice, soldOut, onToggleSoldOut, hidden }: { name: string; initial: string | null; endpoint: string; star?: { on: boolean; disabled: boolean; onClick: () => void }; toteatMap?: Record<string, { name: string; price: number }> | null; qcPrice?: number; soldOut?: boolean; onToggleSoldOut?: () => void; hidden?: boolean }) {
  const [code, setCode] = useState(initial ?? "");
  const norm = code.trim().toUpperCase();
  const tInfo = toteatMap && norm ? toteatMap[norm] : undefined;
  const showToteat = !!toteatMap && norm.length > 0;
  const priceMismatch = tInfo != null && qcPrice != null && Math.round(tInfo.price) !== Math.round(qcPrice);
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {star && (
          <button
            onClick={star.disabled ? undefined : star.onClick}
            title={star.on ? "Quitar del banner" : star.disabled ? "Máximo 5 en el banner" : "Destacar en el banner"}
            style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: star.disabled ? "not-allowed" : "pointer", display: "grid", placeItems: "center", opacity: star.disabled ? 0.35 : 1 }}
          >
            <Star size={18} color={star.on ? ACCENT : "var(--adm-text3)"} fill={star.on ? ACCENT : "none"} />
          </button>
        )}
        <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
          <span style={{ minWidth: 0, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: soldOut ? "var(--adm-text3)" : "var(--adm-text)", textDecoration: soldOut ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {hidden && (
            <span title="No está visible para el cliente (categoría o producto inactivo/oculto)" style={{ flexShrink: 0, fontFamily: F, fontSize: "0.62rem", fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "#b45309", background: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.35)", padding: "2px 7px", borderRadius: 999 }}>Oculto</span>
          )}
        </span>
        {onToggleSoldOut && (
          <button
            onClick={onToggleSoldOut}
            title={soldOut ? "Marcar disponible" : "Marcar agotado"}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, border: `1px solid ${soldOut ? "#ef4444" : "var(--adm-card-border)"}`, background: soldOut ? "rgba(239,68,68,0.12)" : "transparent", color: soldOut ? "#ef4444" : "var(--adm-text2)" }}
          >
            <Ban size={13} /> {soldOut ? "Agotado" : "Agotar"}
          </button>
        )}
        <CodeInput initial={initial} endpoint={endpoint} onValue={setCode} />
      </div>

      <div style={{ paddingLeft: star ? 40 : 0, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: FB, fontSize: "0.72rem", lineHeight: 1.3 }}>
        {qcPrice != null && (
          <span style={{ color: "var(--adm-text2)" }}>QuieroComer: <strong style={{ color: "var(--adm-text)" }}>{clp(qcPrice)}</strong></span>
        )}
        {showToteat && tInfo != null && (
          <span style={{ color: priceMismatch ? "#f97316" : "var(--adm-text2)" }}>POS (Toteat): <strong style={{ color: priceMismatch ? "#f97316" : "var(--adm-text)" }}>{clp(tInfo.price)}</strong>{priceMismatch ? " ⚠ distinto" : ""}</span>
        )}
      </div>

      {showToteat && (
        <div style={{ paddingLeft: star ? 40 : 0, fontFamily: FB, fontSize: "0.72rem", lineHeight: 1.3 }}>
          {tInfo != null
            ? <span style={{ color: GREEN }}>Toteat: <strong style={{ color: "var(--adm-text)" }}>{tInfo.name || "(sin nombre)"}</strong></span>
            : <span style={{ color: "#f97316" }}>⚠ Ese código no existe en el catálogo de Toteat</span>}
        </div>
      )}
    </div>
  );
}

// Input de código POS con guardado on-blur (usa los endpoints map-toteat).
function CodeInput({ initial, endpoint, onValue }: { initial: string | null; endpoint: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState<string>(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const save = useCallback(async () => {
    const v = value.trim();
    if (v === saved) return;
    setBusy(true); setOk(false);
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toteatProductId: v || null }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "No se pudo guardar"); setBusy(false); return; }
      setSaved(v); setOk(true); setTimeout(() => setOk(false), 1500);
    } catch { toast.error("Error de conexión"); }
    setBusy(false);
  }, [value, saved, endpoint]);

  const dirty = value.trim() !== saved;
  return (
    <div style={{ position: "relative", flexShrink: 0, width: 150 }}>
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); onValue?.(e.target.value); }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="Código POS"
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 26px 8px 10px", borderRadius: 8, border: `1px solid ${dirty ? ACCENT : saved ? GREEN + "66" : "var(--adm-card-border)"}`, background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: "monospace", fontSize: "0.82rem", outline: "none" }}
      />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
        {busy ? <Loader2 size={13} className="animate-spin" color="var(--adm-text3)" /> : ok ? <Check size={14} color={GREEN} /> : saved ? <Check size={13} color={GREEN + "99"} /> : null}
      </span>
    </div>
  );
}
