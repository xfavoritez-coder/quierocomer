"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Package } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { CATEGORIA_LABEL, CATEGORIA_ORDER, UNIDAD_LABEL, clp, fmtStock } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";
const DANGER = "#ef4444";

type Insumo = {
  id: string; nombre: string; categoria: string; unidadBase: string;
  stockActual: number; precioConIva: number | null; fotoUrl: string | null;
};

const inputStyle: React.CSSProperties = {
  padding: "9px 10px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
  textAlign: "right", width: 92,
};

export default function ConteoPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({}); // insumoId → stock real (texto)

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.insumos) setInsumos(d.insumos); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const grupos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const vis = q ? insumos.filter((i) => i.nombre.toLowerCase().includes(q)) : insumos;
    const byCat: Record<string, Insumo[]> = {};
    for (const it of vis) (byCat[it.categoria] ??= []).push(it);
    return CATEGORIA_ORDER.filter((c) => byCat[c]?.length).map((c) => ({ categoria: c, items: byCat[c] }));
  }, [insumos, search]);

  // Resumen en vivo de las diferencias ya ingresadas (valorizadas con IVA, aprox).
  const resumen = useMemo(() => {
    let n = 0, faltante = 0, sobrante = 0;
    for (const it of insumos) {
      const raw = counts[it.id];
      if (raw === undefined || raw === "") continue;
      const real = Number(raw);
      if (!Number.isFinite(real) || real < 0) continue;
      const diff = real - it.stockActual;
      if (Math.abs(diff) < 1e-6) continue;
      n += 1;
      const val = (it.precioConIva || 0) * Math.abs(diff);
      if (diff < 0) faltante += val; else sobrante += val;
    }
    return { n, faltante, sobrante };
  }, [counts, insumos]);

  async function confirmar() {
    const items = Object.entries(counts)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([insumoId, v]) => ({ insumoId, stockReal: Number(v) }))
      .filter((x) => Number.isFinite(x.stockReal) && x.stockReal >= 0);
    if (items.length === 0) { toast.error("Ingresa al menos un conteo"); return; }
    if (!confirm(`Se generarán ajustes de stock para ${resumen.n} insumo${resumen.n === 1 ? "" : "s"} con diferencia. ¿Confirmar el conteo?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/bodega/conteo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, items }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo registrar el conteo"); setSaving(false); return; }
      toast.success(d.ajustes > 0 ? `Conteo listo — ${d.ajustes} ajuste${d.ajustes === 1 ? "" : "s"} aplicado${d.ajustes === 1 ? "" : "s"}` : "Conteo listo — sin diferencias");
      router.push("/panel/bodega");
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "8px 4px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={() => router.push("/panel/bodega")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={20} color={ACCENT} /> Conteo físico
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Anota el stock real de cada insumo. Al confirmar, el sistema ajusta las diferencias.</p>
        </div>
      </div>

      {!loading && insumos.length > 0 && (
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar insumo…" style={{ width: "100%", padding: "11px 13px", marginBottom: 14, background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 10, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
      )}

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando inventario…</div>
      ) : insumos.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>No hay insumos para contar.</div>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 8px", padding: "0 4px" }}>{CATEGORIA_LABEL[g.categoria] || g.categoria}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((it) => (
                <Fila key={it.id} it={it} value={counts[it.id] ?? ""} onChange={(v) => setCounts((p) => ({ ...p, [it.id]: v }))} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Barra inferior fija con resumen + confirmar */}
      {!loading && insumos.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "var(--adm-bg, var(--adm-card))", borderTop: "1px solid var(--adm-card-border)", padding: "12px 16px", boxShadow: "0 -6px 20px rgba(0,0,0,0.12)" }}>
          <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180, fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)" }}>
              {resumen.n === 0 ? "Sin diferencias aún" : (
                <span>
                  <strong style={{ color: "var(--adm-text)" }}>{resumen.n}</strong> con diferencia
                  {resumen.faltante > 0 && <> · <span style={{ color: DANGER }}>faltante {clp(Math.round(resumen.faltante))}</span></>}
                  {resumen.sobrante > 0 && <> · <span style={{ color: ACCENT }}>sobrante {clp(Math.round(resumen.sobrante))}</span></>}
                </span>
              )}
            </div>
            <button onClick={confirmar} disabled={saving} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.9rem", fontWeight: 800, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              <ClipboardCheck size={17} /> {saving ? "Aplicando…" : "Confirmar conteo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({ it, value, onChange }: { it: Insumo; value: string; onChange: (v: string) => void }) {
  const real = value === "" ? null : Number(value);
  const diff = real != null && Number.isFinite(real) ? real - it.stockActual : null;
  const hasDiff = diff != null && Math.abs(diff) > 1e-6;
  const u = UNIDAD_LABEL[it.unidadBase] || "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--adm-card)", border: `1px solid ${hasDiff ? (diff! < 0 ? "rgba(239,68,68,0.4)" : "rgba(45,212,191,0.4)") : "var(--adm-card-border)"}`, borderRadius: 12, padding: 10 }}>
      <div style={{ width: 42, height: 42, borderRadius: 9, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {it.fotoUrl ? <img src={it.fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={18} color="var(--adm-text3)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.nombre}</p>
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>
          Sistema: <strong style={{ color: "var(--adm-text2)" }}>{fmtStock(it.stockActual)} {u}</strong>
          {hasDiff && <span style={{ color: diff! < 0 ? DANGER : ACCENT, fontWeight: 700 }}>{"  "}· {diff! > 0 ? "+" : ""}{fmtStock(diff!)} {u}</span>}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="real" style={inputStyle} />
        <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", width: 26 }}>{u}</span>
      </div>
    </div>
  );
}
