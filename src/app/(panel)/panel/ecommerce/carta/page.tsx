"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Search, Check, Loader2, UtensilsCrossed, Package } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import type { StorefrontData } from "@/lib/ecommerce/storefront-data";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";
const GREEN = "#22c55e";

type Product = StorefrontData["products"][number];
interface DedupOption { id: string; name: string; code: string | null }
interface DedupGroup { id: string; name: string; options: DedupOption[] }

export default function EcommerceCatalogoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [data, setData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"productos" | "modificadores">("productos");
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

  // Modificadores deduplicados (un template compartido aparece en varios productos).
  const dedupGroups = useMemo<DedupGroup[]>(() => {
    const map = new Map<string, DedupGroup>();
    for (const p of products) {
      for (const g of p.option_groups ?? []) {
        let grp = map.get(g.id);
        if (!grp) { grp = { id: g.id, name: g.name, options: [] }; map.set(g.id, grp); }
        for (const v of g.values) {
          if (!grp.options.some((o) => o.id === v.id)) grp.options.push({ id: v.id, name: v.name, code: v.toteat_modifier_code });
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
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Asigna el código de Toteat a cada producto y modificador para enviar los pedidos al POS.</p>
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "productos" ? "Buscar producto o código…" : "Buscar modificador o código…"} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", outline: "none" }} />
          </div>

          {tab === "productos" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {(q ? [{ id: "_all", name: "", position: 0 }] : categories).map((cat) => {
                const catProducts = q ? filteredProducts : filteredProducts.filter((p) => p.category_id === cat.id);
                if (!catProducts.length) return null;
                return (
                  <div key={cat.id}>
                    {!q && <h2 style={sectionTitle}>{cat.name}</h2>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {catProducts.map((p) => (
                        <Row key={p.id} name={p.name} initial={p.toteat_code} endpoint={`/api/admin/dishes/${p.id}/map-toteat`} />
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {g.options.map((o) => (
                      <Row key={o.id} name={o.name} initial={o.code} endpoint={`/api/admin/modifiers/${o.id}/map-toteat`} />
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

function Row({ name, initial, endpoint }: { name: string; initial: string | null; endpoint: string }) {
  return (
    <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <CodeInput initial={initial} endpoint={endpoint} />
    </div>
  );
}

// Input de código Toteat con guardado on-blur (usa los endpoints map-toteat).
function CodeInput({ initial, endpoint }: { initial: string | null; endpoint: string }) {
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
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="Código Toteat"
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 26px 8px 10px", borderRadius: 8, border: `1px solid ${dirty ? ACCENT : saved ? GREEN + "66" : "var(--adm-card-border)"}`, background: "var(--adm-input, var(--adm-card))", color: "var(--adm-text)", fontFamily: "monospace", fontSize: "0.82rem", outline: "none" }}
      />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
        {busy ? <Loader2 size={13} className="animate-spin" color="var(--adm-text3)" /> : ok ? <Check size={14} color={GREEN} /> : saved ? <Check size={13} color={GREEN + "99"} /> : null}
      </span>
    </div>
  );
}
