"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Truck, Settings, X, AlertTriangle, CheckCircle2, HelpCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { fmtStock, UNIDAD_LABEL } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";
const WARN = "#f59e0b";

type Config = { stockMinimo: number; cantidadSolicitar: number; proveedorId: string | null; proveedorNombre: string | null };
type Familia = { familia: string; sumStock: number; insumos: number; unidad: string; config: Config | null };
type ProveedorLite = { id: string; nombre: string };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
};
const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };

export default function PorComprarPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorLite[]>([]);
  const [sinFamilia, setSinFamilia] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Familia | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/familias?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setFamilias(d.familias || []); setProveedores(d.proveedores || []); setSinFamilia(d.sinFamilia || 0); } })
      .catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  // Familias que llegaron al mínimo, agrupadas por proveedor.
  const gruposProveedor = useMemo(() => {
    const porComprar = familias.filter((f) => f.config && f.sumStock <= f.config.stockMinimo);
    const map = new Map<string, { nombre: string; items: Familia[] }>();
    for (const f of porComprar) {
      const key = f.config!.proveedorId || "__sin__";
      const nombre = f.config!.proveedorNombre || "Sin proveedor asignado";
      if (!map.has(key)) map.set(key, { nombre, items: [] });
      map.get(key)!.items.push(f);
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [familias]);

  const upsert = (c: Config & { familia: string }) =>
    setFamilias((prev) => prev.map((f) => f.familia === c.familia ? { ...f, config: { stockMinimo: c.stockMinimo, cantidadSolicitar: c.cantidadSolicitar, proveedorId: c.proveedorId, proveedorNombre: c.proveedorNombre } } : f));

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={22} color={ACCENT} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Por comprar</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Familias que llegaron a su stock mínimo</p>
        </div>
      </div>

      {!loading && sinFamilia > 0 && (
        <button onClick={() => router.push("/panel/bodega/por-comprar/sin-familia")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 12, padding: "13px 14px", cursor: "pointer", marginBottom: 16 }}>
          <HelpCircle size={20} color={WARN} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{sinFamilia} insumo{sinFamilia === 1 ? "" : "s"} sin familia</p>
            <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}>No aparecen en “Por comprar”. Toca para asignarles familia.</p>
          </div>
          <ChevronRight size={18} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
        </button>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : (
        <>
          {/* Lista Por comprar (por proveedor) */}
          {gruposProveedor.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 14, padding: 16, marginBottom: 24 }}>
              <CheckCircle2 size={22} color={ACCENT} />
              <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text)", margin: 0 }}>Nada por comprar. Todas las familias configuradas están sobre su mínimo.</p>
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              {gruposProveedor.map((g) => (
                <section key={g.nombre} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 8px" }}>
                    <Truck size={16} color="var(--adm-text3)" />
                    <h2 style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{g.nombre}</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {g.items.map((f) => (
                      <div key={f.familia} onClick={() => setEditing(f)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--adm-card)", border: `1px solid ${WARN}55`, borderRadius: 12, padding: 13, cursor: "pointer" }}>
                        <AlertTriangle size={18} color={WARN} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>{f.familia}</p>
                          <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}>
                            Stock {fmtStock(f.sumStock)} / mín {fmtStock(f.config!.stockMinimo)} {UNIDAD_LABEL[f.unidad] || ""}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: WARN, margin: 0 }}>Solicitar {fmtStock(f.config!.cantidadSolicitar)}</p>
                          <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0 }}>{UNIDAD_LABEL[f.unidad] || ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Configuración de familias */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 8px" }}>
            <Settings size={16} color="var(--adm-text3)" />
            <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>Familias ({familias.length})</span>
          </div>
          {familias.length === 0 ? (
            <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", padding: "6px 2px" }}>
              No hay familias. Asigna una familia a tus insumos (en Stock) para configurar su reposición.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {familias.map((f) => (
                <button key={f.familia} onClick={() => setEditing(f)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 13, cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>{f.familia} <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: 500, color: "var(--adm-text3)" }}>· {f.insumos} insumo{f.insumos === 1 ? "" : "s"}</span></p>
                    <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}>
                      Stock {fmtStock(f.sumStock)} {UNIDAD_LABEL[f.unidad] || ""}{f.config ? ` · mín ${fmtStock(f.config.stockMinimo)} · solicitar ${fmtStock(f.config.cantidadSolicitar)}${f.config.proveedorNombre ? ` · ${f.config.proveedorNombre}` : ""}` : ""}
                    </p>
                  </div>
                  <span style={{ fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: f.config ? "var(--adm-text3)" : ACCENT }}>{f.config ? "Editar" : "Configurar"}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {editing && restaurantId && (
        <FamiliaModal restaurantId={restaurantId} familia={editing} proveedores={proveedores} onClose={() => setEditing(null)} onSaved={(c) => { upsert(c); setEditing(null); }} />
      )}
    </div>
  );
}

function FamiliaModal({ restaurantId, familia, proveedores, onClose, onSaved }: {
  restaurantId: string; familia: Familia; proveedores: ProveedorLite[]; onClose: () => void; onSaved: (c: Config & { familia: string }) => void;
}) {
  const [min, setMin] = useState(familia.config ? String(familia.config.stockMinimo) : "");
  const [solicitar, setSolicitar] = useState(familia.config ? String(familia.config.cantidadSolicitar) : "");
  const [proveedorId, setProveedorId] = useState(familia.config?.proveedorId || "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/panel/bodega/familias", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, familia: familia.familia, stockMinimo: min || 0, cantidadSolicitar: solicitar || 0, proveedorId: proveedorId || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      toast.success("Configuración guardada");
      onSaved({ familia: familia.familia, ...d.config });
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--adm-bg, var(--adm-card))", borderRadius: 18, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{familia.familia}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: "0 0 16px" }}>
          Stock actual de la familia: <strong>{fmtStock(familia.sumStock)} {UNIDAD_LABEL[familia.unidad] || ""}</strong>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block" }}><span style={labelSpan}>Stock mínimo</span>
              <input value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" style={inputStyle} /></label>
            <label style={{ display: "block" }}><span style={labelSpan}>Cantidad a solicitar</span>
              <input value={solicitar} onChange={(e) => setSolicitar(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" style={inputStyle} /></label>
          </div>
          <label style={{ display: "block" }}><span style={labelSpan}>Proveedor</span>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={inputStyle}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></label>
          <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>
            Cuando la suma del stock de esta familia baje de <strong>{min || "0"}</strong>, aparecerá en “Por comprar” con la cantidad a solicitar a ese proveedor.
          </p>
          <button onClick={submit} disabled={saving} style={{ marginTop: 2, padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
