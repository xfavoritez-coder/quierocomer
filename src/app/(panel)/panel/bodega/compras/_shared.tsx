"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clp, fmtStock, UNIDAD_LABEL } from "@/lib/bodega/labels";

export const F = "var(--font-display)";
export const FB = "var(--font-body)";
export const ACCENT = "#2dd4bf";

export const TIPO_DOC: Record<string, string> = { factura: "Factura", boleta: "Boleta", nota_entrega: "Nota de entrega" };
export const METODO: Record<string, string> = { transferencia: "Transferencia", efectivo: "Efectivo", debito: "Débito", webpay: "Webpay" };
export const ESTADO_PAGO: Record<string, string> = { por_pagar: "Por pagar", pagada: "Pagada" };

export type Compra = {
  id: string; fecha: string; fechaSolicitud: string | null; proveedorId: string | null; proveedorNombre: string | null;
  documentoTipo: string | null; documentoFolio: string | null; totalDeclarado: number | null;
  metodoPago: string | null; estadoPago: string | null; comentarios: string | null;
  fotoUrl: string | null; fotoPagoUrl: string | null; _count: { lineas: number };
};
export type InsumoLite = { id: string; nombre: string; unidadBase: string; ultimoPrecio: number | null };
export type ProveedorLite = { id: string; nombre: string };

export const inputStyle: React.CSSProperties = {
  width: "100%", minWidth: 0, padding: "11px 12px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
};
export const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };
export const btnPrimary: React.CSSProperties = { padding: "13px 16px", borderRadius: 12, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.95rem", fontWeight: 800, cursor: "pointer", width: "100%" };

export function FotoField({ label, url, onUrl, folder }: { label: string; url: string | null; onUrl: (u: string | null) => void; folder: string }) {
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
      <button type="button" onClick={() => ref.current?.click()} style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", borderRadius: 12, background: "var(--adm-hover)", border: "1px dashed var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", padding: 0 }}>
        {uploading ? <Loader2 size={22} className="animate-spin" color="var(--adm-text3)" />
          : url ? <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.72rem" }}><ImagePlus size={24} /> Subir</span>}
        {url && !uploading && <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.55)", color: "white", fontFamily: FB, fontSize: "0.64rem", padding: "2px 8px", borderRadius: 999 }}>Cambiar</span>}
      </button>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) up(f); }} />
    </div>
  );
}

// ─── Formulario de cabecera (crear o editar) ───
export function CompraHeaderForm({ restaurantId, existing, onCreated, onSaved }: {
  restaurantId: string; existing: Compra | null; onCreated?: (c: Compra) => void; onSaved?: (c: Compra) => void;
}) {
  const editing = !!existing;
  const [proveedores, setProveedores] = useState<ProveedorLite[]>([]);
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

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/bodega/proveedores?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.proveedores) setProveedores(d.proveedores.map((x: any) => ({ id: x.id, nombre: x.nombre }))); }).catch(() => {});
  }, [restaurantId]);

  async function crearProveedor() {
    const nombre = nuevoProvNombre.trim();
    if (!nombre) { toast.error("Escribe el nombre del proveedor"); return; }
    setCreandoProvBusy(true);
    try {
      const res = await fetch("/api/panel/bodega/proveedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, nombre }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo crear"); setCreandoProvBusy(false); return; }
      const p = { id: d.proveedor.id, nombre: d.proveedor.nombre };
      setProveedores((prev) => [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSelected(p); setNuevoProvNombre(""); setCreandoProv(false); toast.success("Proveedor creado");
    } catch { toast.error("Error de conexión"); }
    setCreandoProvBusy(false);
  }

  async function submit() {
    if (!selected) { toast.error("Selecciona el proveedor"); return; }
    if (!fechaEntrega) { toast.error("Indica la fecha de entrega"); return; }
    if (!(parseFloat(total) >= 0)) { toast.error("Indica el total"); return; }
    if (!documentoFolio.trim()) { toast.error("Indica el número de documento"); return; }
    setSaving(true);
    const payload = { restaurantId, proveedorId: selected.id, fechaSolicitud: fechaSolicitud || null, fechaEntrega, totalDeclarado: total, metodoPago, estadoPago, documentoTipo, documentoFolio, comentarios, fotoUrl, fotoPagoUrl };
    try {
      const res = await fetch(editing ? `/api/panel/bodega/compras/${existing!.id}` : "/api/panel/bodega/compras", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      if (editing) { toast.success("Factura actualizada"); setSaving(false); onSaved?.(d.compra); }
      else onCreated?.(d.compra);
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const matches = (q ? proveedores.filter((p) => p.nombre.toLowerCase().includes(q)) : proveedores).slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Proveedor */}
      <div>
        <span style={labelSpan}>Proveedor</span>
        {selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 9, padding: "11px 12px" }}>
            <span style={{ flex: 1, fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)" }}>{selected.nombre}</span>
            <button type="button" onClick={() => { setSelected(null); setSearch(""); }} style={{ flexShrink: 0, background: "transparent", border: "none", color: "var(--adm-text2)", cursor: "pointer", fontFamily: F, fontSize: "0.78rem", fontWeight: 700 }}>Cambiar</button>
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
            {proveedores.length === 0 ? <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>No hay proveedores. Crea uno con “Nuevo”.</p>
              : matches.length === 0 ? <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>Sin resultados. Puedes crearlo con “Nuevo”.</p>
              : (
                <div style={{ marginTop: 6, border: "1px solid var(--adm-card-border)", borderRadius: 9, overflow: "hidden" }}>
                  {matches.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelected(p); setSearch(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--adm-card-border)", color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", cursor: "pointer" }}>{p.nombre}</button>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>

      <label style={{ display: "block" }}><span style={labelSpan}>Fecha de solicitud <span style={{ fontWeight: 500, color: "var(--adm-text3)" }}>(opcional)</span></span>
        <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} style={inputStyle} /></label>
      <label style={{ display: "block" }}><span style={labelSpan}>Fecha de entrega</span>
        <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} style={inputStyle} /></label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "block", minWidth: 0 }}><span style={labelSpan}>Tipo de documento</span>
          <select value={documentoTipo} onChange={(e) => setDocumentoTipo(e.target.value)} style={inputStyle}>{Object.entries(TIPO_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label style={{ display: "block", minWidth: 0 }}><span style={labelSpan}>N° de documento</span>
          <input value={documentoFolio} onChange={(e) => setDocumentoFolio(e.target.value)} placeholder="Ej: 12345" style={inputStyle} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "block", minWidth: 0 }}><span style={labelSpan}>Total de la factura</span>
          <input value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="$" style={inputStyle} /></label>
        <label style={{ display: "block", minWidth: 0 }}><span style={labelSpan}>Método de pago</span>
          <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} style={inputStyle}>{Object.entries(METODO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>

      <label style={{ display: "block" }}><span style={labelSpan}>Estado</span>
        <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} style={inputStyle}>{Object.entries(ESTADO_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>

      <label style={{ display: "block" }}><span style={labelSpan}>Comentarios <span style={{ fontWeight: 500, color: "var(--adm-text3)" }}>(opcional)</span></span>
        <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FotoField label="Foto de la factura" url={fotoUrl} onUrl={setFotoUrl} folder="compras" />
        <FotoField label="Foto del pago" url={fotoPagoUrl} onUrl={setFotoPagoUrl} folder="compras" />
      </div>

      <button onClick={submit} disabled={saving} style={{ ...btnPrimary, marginTop: 4, opacity: saving ? 0.7 : 1 }}>
        {saving ? "Guardando…" : editing ? "Guardar cambios de la factura" : "Guardar y continuar a insumos"}
      </button>
    </div>
  );
}

// ─── Editor de insumos de una factura (pantalla aparte) ───
export function LineasEditor({ restaurantId, compraId, totalDoc }: { restaurantId: string; compraId: string; totalDoc: number | null }) {
  type Linea = { id: string; cantidad: number; unidad: string; precioNeto: number | null; iva: number | null; precioTotal: number; insumo: { id: string; nombre: string } };
  const [insumos, setInsumos] = useState<InsumoLite[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [neto, setNeto] = useState("");
  const [bruto, setBruto] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.insumos) setInsumos(d.insumos); }).catch(() => {});
    fetch(`/api/panel/bodega/compras/${compraId}/lineas?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.lineas) setLineas(d.lineas); }).catch(() => {});
  }, [restaurantId, compraId]);

  const onNeto = (v: string) => { v = v.replace(/[^\d.]/g, ""); setNeto(v); const n = parseFloat(v); setBruto(Number.isFinite(n) ? String(Math.round(n * 1.19)) : ""); };
  const onBruto = (v: string) => { v = v.replace(/[^\d.]/g, ""); setBruto(v); const b = parseFloat(v); setNeto(Number.isFinite(b) ? String(Math.round(b / 1.19)) : ""); };
  const netoN = parseFloat(neto), brutoN = parseFloat(bruto);
  const ivaN = Number.isFinite(netoN) && Number.isFinite(brutoN) ? Math.round(brutoN - netoN) : null;

  const sumLineas = lineas.reduce((s, l) => s + l.precioTotal, 0);
  const diff = totalDoc != null ? totalDoc - sumLineas : null;

  async function agregar() {
    if (!insumoId) { toast.error("Elige un insumo"); return; }
    if (!(parseFloat(cantidad) > 0)) { toast.error("Cantidad inválida"); return; }
    if (!(netoN >= 0)) { toast.error("Ingresa el precio sin IVA"); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/panel/bodega/compras/${compraId}/lineas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, insumoId, cantidad, precioNeto: neto, precioTotal: bruto }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo agregar"); setAdding(false); return; }
      setLineas((prev) => [...prev, d.linea]);
      const st = d.insumo?.stockActual;
      toast.success(st != null ? `Agregado — stock ahora ${fmtStock(st)}` : "Insumo agregado a la factura");
      setInsumoId(""); setCantidad(""); setNeto(""); setBruto("");
    } catch { toast.error("Error de conexión"); }
    setAdding(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {lineas.length > 0 && (
        <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
          {lineas.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--adm-card-border)" }}>
              <span style={{ flex: 1, fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)" }}>{l.insumo.nombre}</span>
              <span style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)" }}>{fmtStock(l.cantidad)} {UNIDAD_LABEL[l.unidad] || ""}</span>
              <span style={{ fontFamily: F, fontSize: "0.84rem", fontWeight: 700, color: "var(--adm-text)", minWidth: 72, textAlign: "right" }}>{clp(l.precioTotal)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--adm-hover)" }}>
            <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text2)" }}>Suma de insumos (con IVA)</span>
            <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>{clp(sumLineas)}</span>
          </div>
        </div>
      )}
      {diff != null && lineas.length > 0 && Math.abs(diff) > 0.5 && (
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: diff > 0 ? "#f59e0b" : "#ef4444", margin: 0 }}>
          {diff > 0 ? `Faltan ${clp(diff)} para llegar al total del documento (${clp(totalDoc!)}).` : `La suma supera el total del documento en ${clp(-diff)}.`}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 14 }}>
        <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Agregar insumo</p>
        <select value={insumoId} onChange={(e) => setInsumoId(e.target.value)} style={inputStyle}>
          <option value="">Elige un insumo…</option>
          {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ minWidth: 0 }}><span style={{ ...labelSpan, fontSize: "0.68rem", marginBottom: 3 }}>Cantidad</span>
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" style={inputStyle} /></div>
          <div style={{ minWidth: 0 }}><span style={{ ...labelSpan, fontSize: "0.68rem", marginBottom: 3 }}>Precio sin IVA</span>
            <input value={neto} onChange={(e) => onNeto(e.target.value)} inputMode="decimal" placeholder="$ neto" style={inputStyle} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
          <div style={{ padding: "9px 10px", background: "var(--adm-hover)", borderRadius: 9, minWidth: 0 }}>
            <span style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", display: "block" }}>IVA (19%)</span>
            <span style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 700, color: "var(--adm-text)" }}>{ivaN != null ? clp(ivaN) : "—"}</span>
          </div>
          <div style={{ minWidth: 0 }}><span style={{ ...labelSpan, fontSize: "0.68rem", marginBottom: 3 }}>Precio con IVA</span>
            <input value={bruto} onChange={(e) => onBruto(e.target.value)} inputMode="decimal" placeholder="$ con IVA" style={inputStyle} /></div>
        </div>
        <button onClick={agregar} disabled={adding} style={{ padding: "11px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.88rem", fontWeight: 800, cursor: adding ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agregar a la factura
        </button>
        {insumos.length === 0 && <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>No tienes insumos. Créalos en Stock Bodega primero.</p>}
      </div>
    </div>
  );
}
