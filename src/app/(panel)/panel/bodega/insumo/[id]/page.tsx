"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Receipt, TrendingUp, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Trash2, Pencil, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { clp, fmtStock, UNIDAD_LABEL } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";
const TIPO_DOC: Record<string, string> = { factura: "Factura", boleta: "Boleta", nota_entrega: "Nota de entrega" };
const MOTIVO_LABEL: Record<string, string> = { consumo: "Consumo", merma: "Merma", ajuste: "Ajuste", otro: "Otro" };

type Item = {
  lineaId: string; compraId: string; fecha: string; proveedorNombre: string | null;
  documentoTipo: string | null; documentoFolio: string | null; cantidad: number;
  precioUnitNeto: number; precioUnitConIva: number; precioTotal: number;
};
type Movimiento = {
  id: string; tipo: string; motivo: string | null; cantidad: number;
  costoUnitario: number | null; costoTotal: number | null; nota: string | null; fecha: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box",
};

export default function InsumoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();

  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("UN");
  const [items, setItems] = useState<Item[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMov, setEditMov] = useState<Movimiento | null>(null);
  const [deletingMov, setDeletingMov] = useState<string | null>(null);

  const reloadMovs = () => {
    if (!restaurantId) return;
    fetch(`/api/panel/bodega/insumos/${id}/movimientos?restaurantId=${restaurantId}&from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d) setMovs(d.movimientos || []); }).catch(() => {});
  };

  async function eliminarMov(m: Movimiento) {
    if (!confirm(`¿Eliminar este movimiento? Se revierte su efecto en el stock.`)) return;
    setDeletingMov(m.id);
    try {
      const res = await fetch(`/api/panel/bodega/insumos/${id}/movimientos/${m.id}?restaurantId=${restaurantId}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo eliminar"); setDeletingMov(null); return; }
      toast.success("Movimiento eliminado"); reloadMovs();
    } catch { toast.error("Error de conexión"); }
    setDeletingMov(null);
  }

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/panel/bodega/insumos/${id}/compras?restaurantId=${restaurantId}&from=${from}&to=${to}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/panel/bodega/insumos/${id}/movimientos?restaurantId=${restaurantId}&from=${from}&to=${to}`).then((r) => r.ok ? r.json() : null),
    ]).then(([c, m]) => {
      if (c) { setItems(c.items || []); setNombre(c.nombre || ""); setUnidad(c.unidadBase || "UN"); }
      if (m) setMovs(m.movimientos || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId, id, from, to]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push("/panel/bodega")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{nombre || "Insumo"}</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Historial de compras y precio</p>
        </div>
      </div>

      {/* Rango de fechas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <label style={{ display: "block" }}><span style={{ display: "block", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 4 }}>Desde</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: "block" }}><span style={{ display: "block", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 4 }}>Hasta</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} /></label>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : (
        <>
          {/* Gráfico de precio */}
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <TrendingUp size={17} color={ACCENT} />
              <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>Precio de compra (con IVA)</span>
            </div>
            <PriceChart items={items} unidad={unidad} />
          </div>

          {/* Facturas */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 8px" }}>
            <Receipt size={16} color="var(--adm-text3)" />
            <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>Facturas ({items.length})</span>
          </div>
          {items.length === 0 ? (
            <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", padding: "20px 2px" }}>Sin compras de este insumo en el rango seleccionado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...items].reverse().map((it) => (
                <button key={it.lineaId} onClick={() => router.push(`/panel/bodega/compras/${it.compraId}`)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 12, cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>{it.proveedorNombre || "Sin proveedor"}</p>
                    <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0 }}>
                      {TIPO_DOC[it.documentoTipo || ""] || "Doc"} {it.documentoFolio || ""} · {new Date(it.fecha).toLocaleDateString("es-CL")} · {fmtStock(it.cantidad)} {UNIDAD_LABEL[unidad] || ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{clp(it.precioUnitConIva)}<span style={{ fontSize: "0.66rem", fontWeight: 500, color: "var(--adm-text3)" }}> c/u</span></p>
                    <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>{clp(it.precioTotal)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Movimientos (ingresos / retiros) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 2px 8px" }}>
            <ArrowLeftRight size={16} color="var(--adm-text3)" />
            <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>Movimientos ({movs.length})</span>
          </div>
          {movs.length === 0 ? (
            <p style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text3)", padding: "6px 2px" }}>Sin ingresos ni retiros manuales en el rango.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {movs.map((m) => {
                const isIng = m.tipo === "ingreso";
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "8px 8px 8px 12px" }}>
                    <button onClick={() => setEditMov(m)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isIng ? "rgba(45,212,191,0.14)" : "rgba(245,158,11,0.14)", color: isIng ? ACCENT : "#f59e0b" }}>
                        {isIng ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px" }}>
                          {isIng ? "Ingreso" : `Retiro · ${MOTIVO_LABEL[m.motivo || ""] || "Retiro"}`}
                        </p>
                        <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {new Date(m.fecha).toLocaleDateString("es-CL")} · {fmtStock(m.cantidad)} {UNIDAD_LABEL[unidad] || ""}{m.nota ? ` · ${m.nota}` : ""}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 800, color: isIng ? ACCENT : "#f59e0b", margin: 0 }}>{isIng ? "+" : "−"}{fmtStock(m.cantidad)}</p>
                        {m.costoTotal != null && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>{clp(m.costoTotal)}</p>}
                      </div>
                    </button>
                    <button onClick={() => eliminarMov(m)} disabled={deletingMov === m.id} title="Eliminar" aria-label="Eliminar" style={{ flexShrink: 0, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "transparent", color: "var(--adm-text3)", cursor: "pointer", opacity: 0.7 }}>
                      {deletingMov === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editMov && restaurantId && (
        <MovModal insumoId={id} restaurantId={restaurantId} unidad={unidad} mov={editMov} onClose={() => setEditMov(null)} onSaved={() => { setEditMov(null); reloadMovs(); }} />
      )}
    </div>
  );
}

function MovModal({ insumoId, restaurantId, unidad, mov, onClose, onSaved }: {
  insumoId: string; restaurantId: string; unidad: string; mov: Movimiento; onClose: () => void; onSaved: () => void;
}) {
  const isIng = mov.tipo === "ingreso";
  const [cantidad, setCantidad] = useState(String(mov.cantidad));
  const [precio, setPrecio] = useState(mov.costoUnitario != null ? String(Math.round(mov.costoUnitario)) : "");
  const [motivo, setMotivo] = useState(mov.motivo || "consumo");
  const [nota, setNota] = useState(mov.nota || "");
  const [saving, setSaving] = useState(false);

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.74rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };

  async function submit() {
    if (!(parseFloat(cantidad) > 0)) { toast.error("Cantidad inválida"); return; }
    setSaving(true);
    const body: any = { restaurantId, nota };
    if (parseFloat(cantidad) !== mov.cantidad) body.cantidad = cantidad;
    if (isIng) { if (mov.costoUnitario == null || parseFloat(precio) !== Math.round(mov.costoUnitario)) body.precioConIva = precio; }
    else body.motivo = motivo;
    try {
      const res = await fetch(`/api/panel/bodega/insumos/${insumoId}/movimientos/${mov.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      toast.success("Movimiento actualizado"); onSaved();
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--adm-bg, var(--adm-card))", borderRadius: 18, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: F, fontSize: "1.02rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Editar {isIng ? "ingreso" : "retiro"}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "block" }}><span style={lbl}>Cantidad ({UNIDAD_LABEL[unidad] || "un"})</span>
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" style={inp} /></label>
          {isIng ? (
            <label style={{ display: "block" }}><span style={lbl}>Precio unit. con IVA</span>
              <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" style={inp} /></label>
          ) : (
            <label style={{ display: "block" }}><span style={lbl}>Motivo</span>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={inp}>
                <option value="consumo">Consumo</option><option value="merma">Merma</option><option value="ajuste">Ajuste</option><option value="otro">Otro</option>
              </select></label>
          )}
          <label style={{ display: "block" }}><span style={lbl}>Nota <span style={{ fontWeight: 500, color: "var(--adm-text3)" }}>(opcional)</span></span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} style={inp} /></label>
          <button onClick={submit} disabled={saving} style={{ marginTop: 2, padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0, lineHeight: 1.5 }}>Cambiar la cantidad reajusta el stock y los lotes. Si el stock de este ingreso ya se consumió, no se puede editar la cantidad.</p>
        </div>
      </div>
    </div>
  );
}

function PriceChart({ items, unidad }: { items: Item[]; unidad: string }) {
  const pts = items.map((it) => ({ x: new Date(it.fecha).getTime(), y: it.precioUnitConIva, fecha: it.fecha }));
  const { path, dots, min, max, first, last } = useMemo(() => {
    if (pts.length === 0) return { path: "", dots: [] as any[], min: 0, max: 0, first: "", last: "" };
    const ys = pts.map((p) => p.y);
    let min = Math.min(...ys), max = Math.max(...ys);
    if (min === max) { min = min * 0.9; max = max * 1.1 || 1; }
    const W = 640, H = 180, padL = 8, padR = 8, padT = 14, padB = 22;
    const n = pts.length;
    const xAt = (i: number) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
    const yAt = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    const dots = pts.map((p, i) => ({ cx: xAt(i), cy: yAt(p.y), y: p.y }));
    const path = dots.map((d, i) => `${i === 0 ? "M" : "L"}${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(" ");
    return { path, dots, min, max, first: pts[0].fecha, last: pts[n - 1].fecha };
  }, [items]);

  if (pts.length === 0) return <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>Sin compras en el rango para graficar.</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", marginBottom: 4 }}>
        <span>máx {clp(max)}</span><span>mín {clp(min)}</span>
      </div>
      <svg viewBox="0 0 640 180" preserveAspectRatio="none" style={{ width: "100%", height: 160, display: "block" }}>
        <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {dots.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r={3.5} fill={ACCENT} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", marginTop: 2 }}>
        <span>{new Date(first).toLocaleDateString("es-CL")}</span>
        <span>{pts.length} compra{pts.length === 1 ? "" : "s"} · por {UNIDAD_LABEL[unidad] || "un"}</span>
        <span>{new Date(last).toLocaleDateString("es-CL")}</span>
      </div>
    </div>
  );
}
