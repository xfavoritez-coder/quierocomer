"use client";
import { useEffect, useState } from "react";
import { Truck, Plus, X, Pencil, Trash2, Phone, Mail, MapPin, Globe, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { clp } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";
const TIPO_DOC: Record<string, string> = { factura: "Factura", boleta: "Boleta", nota_entrega: "Nota de entrega" };
const TIPO_CTA: Record<string, string> = { corriente: "Cuenta corriente", vista: "Cuenta vista", ahorro: "Cuenta de ahorro", rut: "Cuenta RUT" };

type Proveedor = {
  id: string; nombre: string; rut: string | null; razonSocial: string | null; telefono: string | null;
  correo: string | null; direccion: string | null; web: string | null;
  ctaNombre: string | null; ctaRut: string | null; ctaBanco: string | null; ctaTipo: string | null; ctaNumero: string | null;
  _count: { compras: number };
};
type CompraLite = { id: string; fecha: string; documentoTipo: string | null; documentoFolio: string | null; totalDeclarado: number | null; estadoPago: string | null; _count: { lineas: number } };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
};
const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };

export default function ProveedoresPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/proveedores?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.proveedores) setProveedores(d.proveedores); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const upsert = (p: Proveedor) => setProveedores((prev) => prev.some((x) => x.id === p.id) ? prev.map((x) => x.id === p.id ? { ...x, ...p } : x) : [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Truck size={22} color={ACCENT} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Proveedores</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{proveedores.length} proveedor{proveedores.length === 1 ? "" : "es"}</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.86rem", fontWeight: 800, cursor: "pointer" }}>
          <Plus size={17} /> Nuevo proveedor
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : proveedores.length === 0 ? (
        <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Truck size={28} color="var(--adm-text3)" /></div>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Aún no hay proveedores</p>
          <p style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>Créalos con <strong>Nuevo proveedor</strong> para asociarlos a tus compras.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {proveedores.map((p) => (
            <button key={p.id} onClick={() => { setEditing(p); setModalOpen(true); }} style={{ textAlign: "left", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 14, cursor: "pointer" }}>
              <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 3px" }}>{p.nombre}</p>
              {p.razonSocial && <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text2)", margin: "0 0 6px" }}>{p.razonSocial}</p>}
              <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: 0 }}>
                {p.telefono || p.correo || "Sin contacto"} · {p._count.compras} factura{p._count.compras === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </div>
      )}

      {modalOpen && restaurantId && (
        <ProveedorModal
          restaurantId={restaurantId}
          proveedor={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={(p) => upsert(p)}
          onDeleted={(id) => { setProveedores((prev) => prev.filter((x) => x.id !== id)); setModalOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProveedorModal({ restaurantId, proveedor, onClose, onSaved, onDeleted }: {
  restaurantId: string; proveedor: Proveedor | null; onClose: () => void; onSaved: (p: Proveedor) => void; onDeleted: (id: string) => void;
}) {
  const editingExisting = !!proveedor;
  const [mode, setMode] = useState<"view" | "edit">(editingExisting ? "view" : "edit");
  const [cur, setCur] = useState<Proveedor | null>(proveedor);
  const [compras, setCompras] = useState<CompraLite[]>([]);
  const [totalComprado, setTotalComprado] = useState(0);

  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [rut, setRut] = useState(proveedor?.rut ?? "");
  const [razonSocial, setRazonSocial] = useState(proveedor?.razonSocial ?? "");
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? "");
  const [correo, setCorreo] = useState(proveedor?.correo ?? "");
  const [direccion, setDireccion] = useState(proveedor?.direccion ?? "");
  const [web, setWeb] = useState(proveedor?.web ?? "");
  const [ctaNombre, setCtaNombre] = useState(proveedor?.ctaNombre ?? "");
  const [ctaRut, setCtaRut] = useState(proveedor?.ctaRut ?? "");
  const [ctaBanco, setCtaBanco] = useState(proveedor?.ctaBanco ?? "");
  const [ctaTipo, setCtaTipo] = useState(proveedor?.ctaTipo ?? "");
  const [ctaNumero, setCtaNumero] = useState(proveedor?.ctaNumero ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!editingExisting || !proveedor) return;
    fetch(`/api/panel/bodega/proveedores/${proveedor.id}?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d) { setCompras(d.compras || []); setTotalComprado(d.totalComprado || 0); if (d.proveedor) setCur(d.proveedor); } }).catch(() => {});
  }, [editingExisting, proveedor, restaurantId]);

  function startEdit() {
    const p = cur;
    setNombre(p?.nombre ?? ""); setRut(p?.rut ?? ""); setRazonSocial(p?.razonSocial ?? ""); setTelefono(p?.telefono ?? "");
    setCorreo(p?.correo ?? ""); setDireccion(p?.direccion ?? ""); setWeb(p?.web ?? "");
    setCtaNombre(p?.ctaNombre ?? ""); setCtaRut(p?.ctaRut ?? ""); setCtaBanco(p?.ctaBanco ?? ""); setCtaTipo(p?.ctaTipo ?? ""); setCtaNumero(p?.ctaNumero ?? "");
    setMode("edit");
  }

  async function submit() {
    if (!nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = { restaurantId, nombre, rut, razonSocial, telefono, correo, direccion, web, ctaNombre, ctaRut, ctaBanco, ctaTipo, ctaNumero };
      const res = await fetch(editingExisting ? `/api/panel/bodega/proveedores/${proveedor!.id}` : "/api/panel/bodega/proveedores", {
        method: editingExisting ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      onSaved(d.proveedor);
      if (editingExisting) { toast.success("Proveedor actualizado"); setCur(d.proveedor); setSaving(false); setMode("view"); }
      else { toast.success("Proveedor creado"); onClose(); }
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  async function eliminar() {
    if (!editingExisting) return;
    if (!confirm(`¿Eliminar el proveedor "${cur?.nombre}"? Sus facturas registradas se conservan.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/panel/bodega/proveedores/${proveedor!.id}?restaurantId=${restaurantId}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo eliminar"); setDeleting(false); return; }
      toast.success("Proveedor eliminado"); onDeleted(proveedor!.id);
    } catch { toast.error("Error de conexión"); setDeleting(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: "var(--adm-bg, var(--adm-card))", borderRadius: 18, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>
            {!editingExisting ? "Nuevo proveedor" : mode === "edit" ? "Editar proveedor" : "Proveedor"}
          </h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>

        {mode === "edit" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "block" }}><span style={labelSpan}>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Distribuidora Sur" style={inputStyle} autoFocus /></label>
            <label style={{ display: "block" }}><span style={labelSpan}>RUT</span>
              <input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="Ej: 76.123.456-7" style={inputStyle} /></label>
            <label style={{ display: "block" }}><span style={labelSpan}>Razón social</span>
              <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Ej: Comercial Sur SpA" style={inputStyle} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "block" }}><span style={labelSpan}>Teléfono</span>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 …" style={inputStyle} /></label>
              <label style={{ display: "block" }}><span style={labelSpan}>Correo</span>
                <input value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="ventas@…" style={inputStyle} /></label>
            </div>
            <label style={{ display: "block" }}><span style={labelSpan}>Dirección</span>
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, comuna" style={inputStyle} /></label>
            <label style={{ display: "block" }}><span style={labelSpan}>Página web</span>
              <input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="www…" style={inputStyle} /></label>

            {/* Datos de cuenta bancaria */}
            <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 12, marginTop: 2 }}>
              <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 10px" }}>Datos de cuenta bancaria</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}><span style={labelSpan}>Nombre del titular</span>
                    <input value={ctaNombre} onChange={(e) => setCtaNombre(e.target.value)} placeholder="Titular de la cuenta" style={inputStyle} /></label>
                  <label style={{ display: "block" }}><span style={labelSpan}>RUT del titular</span>
                    <input value={ctaRut} onChange={(e) => setCtaRut(e.target.value)} placeholder="Ej: 12.345.678-9" style={inputStyle} /></label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}><span style={labelSpan}>Banco</span>
                    <input value={ctaBanco} onChange={(e) => setCtaBanco(e.target.value)} placeholder="Ej: Banco Estado" style={inputStyle} /></label>
                  <label style={{ display: "block" }}><span style={labelSpan}>Tipo de cuenta</span>
                    <select value={ctaTipo} onChange={(e) => setCtaTipo(e.target.value)} style={inputStyle}>
                      <option value="">—</option>
                      <option value="corriente">Cuenta corriente</option>
                      <option value="vista">Cuenta vista</option>
                      <option value="ahorro">Cuenta de ahorro</option>
                      <option value="rut">Cuenta RUT</option>
                    </select></label>
                </div>
                <label style={{ display: "block" }}><span style={labelSpan}>Número de cuenta</span>
                  <input value={ctaNumero} onChange={(e) => setCtaNumero(e.target.value)} placeholder="N° de cuenta" style={inputStyle} /></label>
              </div>
            </div>

            <button onClick={submit} disabled={saving} style={{ marginTop: 4, padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Guardando…" : editingExisting ? "Guardar cambios" : "Crear proveedor"}
            </button>
            {editingExisting && (
              <button onClick={() => setMode("view")} style={{ padding: "9px 16px", borderRadius: 11, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            )}
          </div>
        ) : cur ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "1.1rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 2px" }}>{cur.nombre}</p>
              {cur.rut && <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>RUT {cur.rut}</p>}
              {cur.razonSocial && <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>{cur.razonSocial}</p>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cur.telefono && <ContactRow icon={Phone} value={cur.telefono} />}
              {cur.correo && <ContactRow icon={Mail} value={cur.correo} />}
              {cur.direccion && <ContactRow icon={MapPin} value={cur.direccion} />}
              {cur.web && <ContactRow icon={Globe} value={cur.web} />}
              {!cur.telefono && !cur.correo && !cur.direccion && !cur.web && (
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: 0 }}>Sin datos de contacto. Usa Editar para completarlos.</p>
              )}
            </div>

            {/* Cuenta bancaria */}
            {(cur.ctaNombre || cur.ctaRut || cur.ctaBanco || cur.ctaTipo || cur.ctaNumero) && (
              <div style={{ background: "var(--adm-hover)", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 8px" }}>Cuenta bancaria</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 6, columnGap: 12 }}>
                  {cur.ctaNombre && <BankItem label="Titular" value={cur.ctaNombre} />}
                  {cur.ctaRut && <BankItem label="RUT" value={cur.ctaRut} />}
                  {cur.ctaBanco && <BankItem label="Banco" value={cur.ctaBanco} />}
                  {cur.ctaTipo && <BankItem label="Tipo" value={TIPO_CTA[cur.ctaTipo] || cur.ctaTipo} />}
                  {cur.ctaNumero && <BankItem label="N° de cuenta" value={cur.ctaNumero} />}
                </div>
              </div>
            )}

            {/* Facturas del proveedor */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 800, color: "var(--adm-text)" }}>Facturas ({compras.length})</span>
                {compras.length > 0 && <span style={{ fontFamily: FB, fontSize: "0.78rem", fontWeight: 700, color: ACCENT }}>Total {clp(totalComprado)}</span>}
              </div>
              {compras.length === 0 ? (
                <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)", margin: 0 }}>Aún no hay facturas de este proveedor.</p>
              ) : (
                <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
                  {compras.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--adm-card-border)" }}>
                      <FileText size={15} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text)" }}>{TIPO_DOC[c.documentoTipo || ""] || "Doc"} {c.documentoFolio || ""}</span>
                      <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>{new Date(c.fecha).toLocaleDateString("es-CL")}</span>
                      <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", minWidth: 64, textAlign: "right" }}>{c.totalDeclarado != null ? clp(c.totalDeclarado) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
              <button onClick={startEdit} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 11, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>
                <Pencil size={15} /> Editar
              </button>
              <button onClick={eliminar} disabled={deleting} title="Eliminar proveedor" aria-label="Eliminar proveedor" style={{ flexShrink: 0, width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "none", background: "transparent", color: "var(--adm-text3)", cursor: "pointer", opacity: 0.6 }}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BankItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: FB, fontSize: "0.66rem", color: "var(--adm-text3)", margin: "0 0 1px" }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)", margin: 0, wordBreak: "break-word" }}>{value}</p>
    </div>
  );
}

function ContactRow({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <Icon size={15} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: FB, fontSize: "0.84rem", color: "var(--adm-text)", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
