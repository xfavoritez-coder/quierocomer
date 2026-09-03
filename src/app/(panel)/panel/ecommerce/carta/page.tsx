"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Search, ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import type { StorefrontData } from "@/lib/ecommerce/storefront-data";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e";

export default function EcommerceCatalogoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
  const total = products.length;
  const withCode = products.filter((p) => p.toteat_code).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.toteat_code ?? "").toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 14 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={20} color={ACCENT} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Catálogo</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Asigna el código de producto de Toteat a cada ítem para enviar los pedidos al POS.</p>
        </div>
      </div>

      {!loading && total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} color="var(--adm-text3)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o código…" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none" }} />
          </div>
          <span style={{ fontFamily: FB, fontSize: "0.76rem", color: withCode === total ? GREEN : "var(--adm-text3)", fontWeight: 700, flexShrink: 0 }}>{withCode}/{total} con código</span>
        </div>
      )}

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}><Loader2 size={16} className="animate-spin" /> Cargando catálogo…</p>
      ) : total === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)", marginTop: 16 }}>No hay productos en tu carta.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 4 }}>
          {(search.trim() ? [{ id: "_all", name: "", position: 0 }] : categories).map((cat) => {
            const catProducts = search.trim() ? filtered : filtered.filter((p) => p.category_id === cat.id);
            if (!catProducts.length) return null;
            return (
              <div key={cat.id}>
                {!search.trim() && <h2 style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 800, color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 2px 8px" }}>{cat.name}</h2>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {catProducts.map((p) => <ProductRow key={p.id} product={p} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Product = StorefrontData["products"][number];

function ProductRow({ product }: { product: Product }) {
  const hasOptions = (product.option_groups?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</p>
          {hasOptions && (
            <button onClick={() => setExpanded((v) => !v)} style={{ marginTop: 2, display: "inline-flex", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FB, fontSize: "0.72rem", color: ACCENT, fontWeight: 700 }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {product.option_groups.reduce((s, g) => s + g.values.length, 0)} modificadores
            </button>
          )}
        </div>
        <CodeInput initial={product.toteat_code} endpoint={`/api/admin/dishes/${product.id}/map-toteat`} />
      </div>

      {expanded && hasOptions && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {product.option_groups.map((g) => (
            <div key={g.id}>
              <p style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 5px" }}>{g.name}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {g.values.map((v) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 6 }}>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                    <CodeInput initial={v.toteat_modifier_code} endpoint={`/api/admin/modifiers/${v.id}/map-toteat`} small />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Input de código Toteat con guardado on-blur (usa los endpoints map-toteat).
function CodeInput({ initial, endpoint, small }: { initial: string | null; endpoint: string; small?: boolean }) {
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
    <div style={{ position: "relative", flexShrink: 0, width: small ? 130 : 150 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="Código Toteat"
        style={{ width: "100%", boxSizing: "border-box", padding: `${small ? 6 : 8}px 26px ${small ? 6 : 8}px 10px`, borderRadius: 8, border: `1px solid ${dirty ? ACCENT : saved ? GREEN + "66" : "var(--adm-card-border)"}`, background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: "monospace", fontSize: small ? "0.76rem" : "0.82rem", outline: "none" }}
      />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
        {busy ? <Loader2 size={13} className="animate-spin" color="var(--adm-text3)" /> : ok ? <Check size={14} color={GREEN} /> : saved ? <Check size={13} color={GREEN + "99"} /> : null}
      </span>
    </div>
  );
}
