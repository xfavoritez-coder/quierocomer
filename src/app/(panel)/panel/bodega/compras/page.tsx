"use client";
import { useEffect, useRef, useState } from "react";
import { Receipt, Plus, X, ImagePlus, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { clp, fmtStock, UNIDAD_LABEL } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";

const TIPO_DOC: Record<string, string> = { factura: "Factura", boleta: "Boleta", nota_entrega: "Nota de entrega" };
const METODO: Record<string, string> = { transferencia: "Transferencia", efectivo: "Efectivo", debito: "Débito", webpay: "Webpay" };
const ESTADO_PAGO: Record<string, string> = { por_pagar: "Por pagar", pagada: "Pagada" };

type Compra = {
  id: string; fecha: string; fechaSolicitud: string | null; proveedorId: string | null; proveedorNombre: string | null;
  documentoTipo: string | null; documentoFolio: string | null; totalDeclarado: number | null;
  metodoPago: string | null; estadoPago: string | null; comentarios: string | null;
  fotoUrl: string | null; fotoPagoUrl: string | null; _count: { lineas: number };
};
type InsumoLite = { id: string; nombre: string; unidadBase: string; ultimoPrecio: number | null };
type ProveedorLite = { id: string; nombre: string };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
};
const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };

export default function ComprasPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;

  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorLite[]>([]);
  const [insumos, setInsumos] = useState<InsumoLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<null | { compra: Compra | null }>(null);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/panel/bodega/compras?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/panel/bodega/proveedores?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
    ]).then(([c, i, p]) => {
      if (c) setCompras(c.compras || []);
      if (i?.insumos) setInsumos(i.insumos);
      if (p?.proveedores) setProveedores(p.proveedores.map((x: any) => ({ id: x.id, nombre: x.nombre })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Receipt size={22} color={ACCENT} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Compras</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{compras.length} documento{compras.length === 1 ? "" : "s"} registrado{compras.length === 1 ? "" : "s"}</p>
        </div>
        <button onClick={() => setFlow({ compra: null })} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.86rem", fontWeight: 800, cursor: "pointer" }}>
          <Plus size={17} /> Registrar compra
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando compras…</div>
      ) : compras.length === 0 ? (
        <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Receipt size={28} color="var(--adm-text3)" />
          </div>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Aún no hay compras</p>
          <p style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            Registra una factura, boleta o nota de venta con el botón <strong>Registrar compra</strong>.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {compras.map((c) => (
            <button key={c.id} onClick={() => setFlow({ compra: c })} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 14, cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)" }}>{c.proveedorNombre || "Sin proveedor"}</span>
                  <span style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: c.estadoPago === "pagada" ? "#16a34a" : "#f59e0b", background: c.estadoPago === "pagada" ? "rgba(22,163,74,0.14)" : "rgba(245,158,11,0.14)", padding: "1px 7px", borderRadius: 999 }}>
                    {ESTADO_PAGO[c.estadoPago || ""] || "—"}
                  </span>
                </div>
                <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: 0 }}>
                  {TIPO_DOC[c.documentoTipo || ""] || "Doc"} {c.documentoFolio || ""} · {new Date(c.fecha).toLocaleDateString("es-CL")} · {c._count.lineas} insumo{c._count.lineas === 1 ? "" : "s"}
                </p>
              </div>
              <span style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)" }}>{c.totalDeclarado != null ? clp(c.totalDeclarado) : "—"}</span>
              <ChevronRight size={18} color="var(--adm-text3)" />
            </button>
          ))}
        </div>
      )}

      {flow && restaurantId && (
        <CompraFlow
          restaurantId={restaurantId}
          insumos={insumos}
          proveedores={proveedores}
          existing={flow.compra}
          onClose={() => setFlow(null)}
          onCreated={(c) => setCompras((prev) => [c, ...prev])}
          onUpdated={(c) => setCompras((prev) => prev.map((x) => x.id === c.id ? { ...x, ...c } : x))}
          onProveedorCreated={(p) => setProveedores((prev) => [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
          onLineCountChange={(compraId, n) => setCompras((prev) => prev.map((x) => x.id === compraId ? { ...x, _count: { lineas: n } } : x))}
        />
      )}
    </div>
  );
}

function CompraFlow({ restaurantId, insumos, proveedores, existing, onClose, onCreated, onUpdated, onProveedorCreated, onLineCountChange }: {
  restaurantId: string; insumos: InsumoLite[]; proveedores: ProveedorLite[]; existing: Compra | null;
  onClose: () => void; onCreated: (c: Compra) => void; onUpdated: (c: Compra) => void; onProveedorCreated: (p: ProveedorLite) => void; onLineCountChange: (compraId: string, n: number) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [compraId, setCompraId] = useState<string | null>(existing?.id ?? null);
  const [totalDoc, setTotalDoc] = useState<number | null>(existing?.totalDeclarado ?? null);

  const title = existing ? "Editar factura" : (step === 1 ? "Nueva compra · documento" : "Insumos de la compra");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", background: "var(--adm-bg, var(--adm-card))", borderRadius: 18, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>

        {existing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <HeaderForm
              restaurantId={restaurantId} proveedores={proveedores} onProveedorCreated={onProveedorCreated}
              existing={existing}
              onSaved={(c) => { setTotalDoc(c.totalDeclarado ?? null); onUpdated(c); }}
            />
            <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 14 }}>
              <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 10px" }}>Insumos de la factura</p>
              <LineasForm
                restaurantId={restaurantId} compraId={existing.id} insumos={insumos} totalDoc={totalDoc}
                onCountChange={(n) => onLineCountChange(existing.id, n)} onClose={onClose}
              />
            </div>
          </div>
        ) : step === 1 ? (
          <HeaderForm
            restaurantId={restaurantId} proveedores={proveedores} onProveedorCreated={onProveedorCreated}
            onCreated={(c, total) => { setCompraId(c.id); setTotalDoc(total); onCreated(c); setStep(2); }}
          />
        ) : (
          <LineasForm
            restaurantId={restaurantId} compraId={compraId!} insumos={insumos} totalDoc={totalDoc}
            onCountChange={(n) => onLineCountChange(compraId!, n)} onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function HeaderForm({ restaurantId, proveedores, onProveedorCreated, existing, onCreated, onSaved }: { restaurantId: string; proveedores: ProveedorLite[]; onProveedorCreated: (p: ProveedorLite) => void; existing?: Compra | null; onCreated?: (c: Compra, total: number) => void; onSaved?: (c: Compra) => void }) {
  const editing = !!existing;
  const [selected, setSelected] = useState<ProveedorLite | null>(existing?.proveedorId ? { id: existing.proveedorId, nombre: existing.proveedorNombre || "" } : null);
  const [search, setSearch] = useState("");
  const [creandoProv, setCreandoProv] = useState(false);
  const [nuevoProvNombre, setNuevoProvNombre] = useState("");
  const [creandoProvBusy, setCreandoProvBusy] = useState(false);
  const [fechaSolicitud, setFechaSolicitud] = useState(existing?.fechaSolicitud ? existing.fechaSolicitud.slice(0, 10) : "");
  const [fechaEntrega, setFechaEntrega] = useState(existing ? existing.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState(existing?.totalDeclarado != null ? String(existing.totalDeclarado) : "");
  const [metodoPago, setMetodoPago] = useState(existing?.metodoPago || "transferencia");
  const [estadoPago, setEstadoPago] = useState(existing?.estadoPago || "por_pagar");
  const [documentoTipo, setDocumentoTipo] = useState(existing?.documentoTipo || "factura");
  const [documentoFolio, setDocumentoFolio] = useState(existing?.documentoFolio || "");
  const [comentarios, setComentarios] = useState(existing?.comentarios || "");
  const [fotoUrl, setFotoUrl] = useState<string | null>(existing?.fotoUrl ?? null);
  const [fotoPagoUrl, setFotoPagoUrl] = useState<string | null>(existing?.fotoPagoUrl ?? null);
  const [saving, setSaving] = useState(false);

  async function crearProveedor() {
    const nombre = nuevoProvNombre.trim();
    if (!nombre) { toast.error("Escribe el nombre del proveedor"); return; }
    setCreandoProvBusy(true);
    try {
      const res = await fetch("/api/panel/bodega/proveedores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, nombre }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo crear"); setCreandoProvBusy(false); return; }
      const p = { id: d.proveedor.id, nombre: d.proveedor.nombre };
      onProveedorCreated(p);
      setSelected(p); setNuevoProvNombre(""); setCreandoProv(false);
      toast.success("Proveedor creado");
    } catch { toast.error("Error de conexión"); }
    setCreandoProvBusy(false);
  }

  async function submit() {
    if (!selected) { toast.error("Selecciona el proveedor"); return; }
    if (!fechaEntrega) { toast.error("Indica la fecha de entrega"); return; }
    if (!(parseFloat(total) >= 0)) { toast.error("Indica el total"); return; }
    if (!documentoFolio.trim()) { toast.error("Indica el número de documento"); return; }
    setSaving(true);
    const payload = {
      restaurantId, proveedorId: selected.id, fechaSolicitud: fechaSolicitud || null, fechaEntrega,
      totalDeclarado: total, metodoPago, estadoPago, documentoTipo, documentoFolio, comentarios, fotoUrl, fotoPagoUrl,
    };
    try {
      const res = await fetch(editing ? `/api/panel/bodega/compras/${existing!.id}` : "/api/panel/bodega/compras", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      const total0 = parseFloat(total) || 0;
      if (editing) { toast.success("Factura actualizada"); setSaving(false); onSaved?.(d.compra); return; }
      onCreated?.({
        id: d.compra.id, fecha: fechaEntrega, fechaSolicitud: fechaSolicitud || null, proveedorId: selected.id, proveedorNombre: selected.nombre,
        documentoTipo, documentoFolio, totalDeclarado: total0, metodoPago, estadoPago, comentarios: comentarios || null,
        fotoUrl, fotoPagoUrl, _count: { lineas: 0 },
      }, total0);
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Proveedor */}
      <div>
        <span style={labelSpan}>Proveedor</span>
        {selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 9, padding: "9px 12px" }}>
            <span style={{ flex: 1, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>{selected.nombre}</span>
            <button type="button" onClick={() => { setSelected(null); setSearch(""); }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--adm-text2)", cursor: "pointer", fontFamily: F, fontSize: "0.76rem", fontWeight: 700 }}>Cambiar</button>
          </div>
        ) : creandoProv ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={nuevoProvNombre} onChange={(e) => setNuevoProvNombre(e.target.value)} placeholder="Nombre del nuevo proveedor" style={{ ...inputStyle, flex: 1 }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") crearProveedor(); }} />
            <button type="button" onClick={crearProveedor} disabled={creandoProvBusy} style={{ flexShrink: 0, padding: "0 14px", borderRadius: 9, border: "none", background: ACCENT, color: "#0b3b36", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 800 }}>{creandoProvBusy ? "…" : "Crear"}</button>
            <button type="button" onClick={() => { setCreandoProv(false); setNuevoProvNombre(""); }} style={{ flexShrink: 0, padding: "0 12px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><X size={16} /></button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor…" style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={() => { setCreandoProv(true); setNuevoProvNombre(search); }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" }}><Plus size={15} /> Nuevo</button>
            </div>
            {(() => {
              const q = search.trim().toLowerCase();
              const matches = (q ? proveedores.filter((p) => p.nombre.toLowerCase().includes(q)) : proveedores).slice(0, 8);
              if (proveedores.length === 0) return <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>No hay proveedores. Crea uno con “Nuevo”.</p>;
              if (matches.length === 0) return <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>Sin resultados. Puedes crearlo con “Nuevo”.</p>;
              return (
                <div style={{ marginTop: 6, border: "1px solid var(--adm-card-border)", borderRadius: 9, overflow: "hidden" }}>
                  {matches.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelected(p); setSearch(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.84rem", cursor: "pointer" }}>{p.nombre}</button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "5px 0 0" }}>Los datos completos del proveedor (RUT, cuenta bancaria, etc.) se editan en el módulo Proveedores.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "block" }}><span style={labelSpan}>Fecha de solicitud <span style={{ fontWeight: 500, color: "var(--adm-text3)" }}>(opc.)</span></span>
          <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: "block" }}><span style={labelSpan}>Fecha de entrega</span>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} style={inputStyle} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "block" }}><span style={labelSpan}>Tipo de documento</span>
          <select value={documentoTipo} onChange={(e) => setDocumentoTipo(e.target.value)} style={inputStyle}>
            {Object.entries(TIPO_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label style={{ display: "block" }}><span style={labelSpan}>N° de documento</span>
          <input value={documentoFolio} onChange={(e) => setDocumentoFolio(e.target.value)} placeholder="Ej: 12345" style={inputStyle} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "block" }}><span style={labelSpan}>Total de la factura</span>
          <input value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="$" style={inputStyle} /></label>
        <label style={{ display: "block" }}><span style={labelSpan}>Método de pago</span>
          <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} style={inputStyle}>
            {Object.entries(METODO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
      </div>

      <label style={{ display: "block" }}><span style={labelSpan}>Estado</span>
        <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} style={inputStyle}>
          {Object.entries(ESTADO_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>

      <label style={{ display: "block" }}><span style={labelSpan}>Comentarios <span style={{ fontWeight: 500, color: "var(--adm-text3)" }}>(opc.)</span></span>
        <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FotoField label="Foto de la factura" url={fotoUrl} onUrl={setFotoUrl} folder="compras" />
        <FotoField label="Foto del pago" url={fotoPagoUrl} onUrl={setFotoPagoUrl} folder="compras" />
      </div>

      <button onClick={submit} disabled={saving} style={{ marginTop: 4, padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Guardando…" : editing ? "Guardar cambios de la factura" : "Continuar → agregar insumos"}
      </button>
    </div>
  );
}

function LineasForm({ restaurantId, compraId, insumos, totalDoc, onCountChange, onClose }: {
  restaurantId: string; compraId: string; insumos: InsumoLite[]; totalDoc: number | null;
  onCountChange: (n: number) => void; onClose: () => void;
}) {
  type Linea = { id: string; cantidad: number; unidad: string; precioNeto: number | null; iva: number | null; precioTotal: number; insumo: { id: string; nombre: string } };
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [neto, setNeto] = useState("");
  const [bruto, setBruto] = useState("");
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // IVA 19%: al escribir el neto se calcula el con-IVA y viceversa.
  const onNeto = (v: string) => { v = v.replace(/[^\d.]/g, ""); setNeto(v); const n = parseFloat(v); setBruto(Number.isFinite(n) ? String(Math.round(n * 1.19)) : ""); };
  const onBruto = (v: string) => { v = v.replace(/[^\d.]/g, ""); setBruto(v); const b = parseFloat(v); setNeto(Number.isFinite(b) ? String(Math.round(b / 1.19)) : ""); };
  const netoN = parseFloat(neto), brutoN = parseFloat(bruto);
  const ivaN = Number.isFinite(netoN) && Number.isFinite(brutoN) ? Math.round(brutoN - netoN) : null;

  useEffect(() => {
    fetch(`/api/panel/bodega/compras/${compraId}/lineas?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.lineas) setLineas(d.lineas); }).finally(() => setLoaded(true));
  }, [compraId, restaurantId]);

  const sumLineas = lineas.reduce((s, l) => s + l.precioTotal, 0);
  const diff = totalDoc != null ? totalDoc - sumLineas : null;

  async function agregar() {
    if (!insumoId) { toast.error("Elige un insumo"); return; }
    if (!(parseFloat(cantidad) > 0)) { toast.error("Cantidad inválida"); return; }
    if (!(netoN >= 0)) { toast.error("Ingresa el precio sin IVA"); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/panel/bodega/compras/${compraId}/lineas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, insumoId, cantidad, precioNeto: neto, precioTotal: bruto }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo agregar"); setAdding(false); return; }
      const next = [...lineas, d.linea];
      setLineas(next); onCountChange(next.length);
      setInsumoId(""); setCantidad(""); setNeto(""); setBruto("");
    } catch { toast.error("Error de conexión"); }
    setAdding(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Líneas agregadas */}
      {loaded && lineas.length > 0 && (
        <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
          {lineas.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--adm-card-border)" }}>
              <span style={{ flex: 1, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)" }}>{l.insumo.nombre}</span>
              <span style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)" }}>{fmtStock(l.cantidad)} {UNIDAD_LABEL[l.unidad] || ""}</span>
              <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", minWidth: 70, textAlign: "right" }}>{clp(l.precioTotal)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", background: "var(--adm-hover)" }}>
            <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text2)" }}>Suma de insumos</span>
            <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 800, color: "var(--adm-text)" }}>{clp(sumLineas)}</span>
          </div>
        </div>
      )}

      {diff != null && lineas.length > 0 && Math.abs(diff) > 0.5 && (
        <p style={{ fontFamily: FB, fontSize: "0.74rem", color: diff > 0 ? "#f59e0b" : "#ef4444", margin: 0 }}>
          {diff > 0 ? `Faltan ${clp(diff)} para llegar al total del documento (${clp(totalDoc!)}).` : `La suma supera el total del documento en ${clp(-diff)}.`}
        </p>
      )}

      {/* Agregar línea */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px dashed var(--adm-card-border)", borderRadius: 12, padding: 12 }}>
        <select value={insumoId} onChange={(e) => setInsumoId(e.target.value)} style={inputStyle}>
          <option value="">Elige un insumo…</option>
          {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><span style={{ ...labelSpan, fontSize: "0.68rem", marginBottom: 3 }}>Cantidad</span>
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" style={inputStyle} /></div>
          <div><span style={{ ...labelSpan, fontSize: "0.68rem", marginBottom: 3 }}>Precio sin IVA</span>
            <input value={neto} onChange={(e) => onNeto(e.target.value)} inputMode="decimal" placeholder="$ neto" style={inputStyle} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
          <div style={{ padding: "8px 10px", background: "var(--adm-hover)", borderRadius: 9 }}>
            <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", display: "block" }}>IVA (19%)</span>
            <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 700, color: "var(--adm-text)" }}>{ivaN != null ? clp(ivaN) : "—"}</span>
          </div>
          <div><span style={{ ...labelSpan, fontSize: "0.68rem", marginBottom: 3 }}>Precio con IVA</span>
            <input value={bruto} onChange={(e) => onBruto(e.target.value)} inputMode="decimal" placeholder="$ con IVA" style={inputStyle} /></div>
        </div>
        <button onClick={agregar} disabled={adding} style={{ padding: "10px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.86rem", fontWeight: 800, cursor: adding ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agregar insumo a la compra
        </button>
        {insumos.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>No tienes insumos aún. Créalos en Stock Bodega primero.</p>}
      </div>

      <button onClick={onClose} style={{ padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: "pointer" }}>
        Listo
      </button>
      <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0, textAlign: "center" }}>
        Cada insumo agregado suma su stock y actualiza su último precio.
      </p>
    </div>
  );
}

function FotoField({ label, url, onUrl, folder }: { label: string; url: string | null; onUrl: (u: string | null) => void; folder: string }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  async function up(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) { toast.error(d.error || "No se pudo subir"); setUploading(false); return; }
      onUrl(d.url);
    } catch { toast.error("Error de conexión"); }
    setUploading(false);
  }
  return (
    <div>
      <span style={labelSpan}>{label}</span>
      <button type="button" onClick={() => ref.current?.click()} style={{ width: "100%", height: 72, borderRadius: 12, background: "var(--adm-hover)", border: "1px dashed var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}>
        {uploading ? <Loader2 size={20} className="animate-spin" color="var(--adm-text3)" />
          : url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <ImagePlus size={22} color="var(--adm-text3)" />}
      </button>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f); }} />
    </div>
  );
}
