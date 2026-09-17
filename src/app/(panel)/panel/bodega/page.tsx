"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Warehouse, Plus, Package, X, ImagePlus, Loader2, Trash2, Pencil, ArrowDownToLine, ArrowUpFromLine, LineChart } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { CATEGORIA_LABEL, CATEGORIA_ORDER, UNIDAD_LABEL, UNIDADES, UNIDAD_NOMBRE, clp, fmtStock } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";

type Insumo = {
  id: string;
  nombre: string;
  categoria: string;
  unidadBase: string;
  ultimoPrecio: number | null;
  rendimiento: number | null;
  precioConRendimiento: number | null;
  familia: string | null;
  stockActual: number;
  valorStock: number;
  precioConIva: number | null;
  fotoUrl: string | null;
  esCritico: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
};

export default function BodegaHome() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [search, setSearch] = useState("");
  const [ingresoManual, setIngresoManual] = useState(true);
  const [conIva, setConIva] = useState(true);
  const f = conIva ? 1 : 1 / 1.19; // factor de display: con IVA o neto

  const reloadInsumos = () => {
    if (!restaurantId) return;
    fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.insumos) setInsumos(d.insumos); })
      .catch(() => {});
  };

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.insumos) setInsumos(d.insumos); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(`/api/panel/bodega/config?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setIngresoManual(d.ingresoManualEnabled !== false); setConIva(d.mostrarPreciosConIva !== false); } })
      .catch(() => {});
  }, [restaurantId]);

  // Agrupar por categoría, respetando el orden definido (filtrado por búsqueda).
  const grupos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const vis = q ? insumos.filter((i) => i.nombre.toLowerCase().includes(q) || (i.familia || "").toLowerCase().includes(q)) : insumos;
    const byCat: Record<string, Insumo[]> = {};
    for (const it of vis) (byCat[it.categoria] ??= []).push(it);
    return CATEGORIA_ORDER
      .filter((c) => byCat[c]?.length)
      .map((c) => {
        const items = byCat[c];
        const total = items.reduce((s, it) => s + (it.valorStock || 0), 0);
        return { categoria: c, items, total };
      });
  }, [insumos, search]);

  const totalGeneral = useMemo(
    () => insumos.reduce((s, it) => s + (it.valorStock || 0), 0),
    [insumos]
  );

  const familias = useMemo(
    () => Array.from(new Set(insumos.map((i) => i.familia).filter(Boolean))).sort() as string[],
    [insumos]
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 4px 96px" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Warehouse size={24} color={ACCENT} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Stock Bodega
            <span style={{ fontSize: "0.58rem", fontWeight: 800, color: ACCENT, background: "rgba(45,212,191,0.18)", padding: "2px 8px", borderRadius: 999 }}>BETA</span>
          </h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>
            {insumos.length} insumo{insumos.length === 1 ? "" : "s"} · valor total {clp(totalGeneral * f)} <span style={{ color: "var(--adm-text3)" }}>({conIva ? "con IVA" : "sin IVA"})</span>
          </p>
        </div>
      </div>

      {!loading && insumos.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar insumo…"
          style={{ width: "100%", padding: "11px 13px", marginBottom: 14, background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 10, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
        />
      )}

      {loading ? (
        <div style={{ padding: 50, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando inventario…</div>
      ) : insumos.length === 0 ? (
        <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Package size={28} color="var(--adm-text3)" />
          </div>
          <p style={{ fontFamily: F, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 6px" }}>Aún no hay insumos</p>
          <p style={{ fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text2)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Agrega tu primer insumo con el botón <strong>+</strong> para empezar a controlar el stock.
          </p>
          <button onClick={() => setModalOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.88rem", fontWeight: 800, cursor: "pointer" }}>
            <Plus size={17} /> Agregar insumo
          </button>
        </div>
      ) : grupos.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, fontSize: "0.86rem", color: "var(--adm-text3)" }}>Sin resultados para “{search}”.</div>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 4px 8px" }}>
              <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>
                {CATEGORIA_LABEL[g.categoria] || g.categoria}
              </h2>
              <span style={{ fontFamily: FB, fontSize: "0.8rem", fontWeight: 700, color: ACCENT }}>{clp(g.total * f)}</span>
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginLeft: "auto" }}>{g.items.length} ítem{g.items.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {g.items.map((it) => (
                <InsumoCard key={it.id} it={it} conIva={conIva} onOpen={() => setEditing(it)} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Botón flotante de crear insumo */}
      <button
        onClick={() => setModalOpen(true)}
        title="Agregar insumo"
        style={{
          position: "fixed", right: 24, bottom: 24, width: 56, height: 56, borderRadius: "50%",
          border: "none", background: ACCENT, color: "#0b3b36", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 20px rgba(45,212,191,0.45)", zIndex: 40,
        }}
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      {(modalOpen || editing) && restaurantId && (
        <InsumoModal
          restaurantId={restaurantId}
          familias={familias}
          insumo={editing}
          ingresoManual={ingresoManual}
          conIva={conIva}
          onReload={reloadInsumos}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onChange={(it) => setInsumos((prev) => prev.some((x) => x.id === it.id) ? prev.map((x) => x.id === it.id ? it : x) : [...prev, it])}
          onDeleted={(delId) => setInsumos((prev) => prev.filter((x) => x.id !== delId))}
        />
      )}
    </div>
  );
}

function InsumoCard({ it, conIva, onOpen }: { it: Insumo; conIva: boolean; onOpen: () => void }) {
  const f = conIva ? 1 : 1 / 1.19;
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 12, cursor: "pointer" }}>
      <div style={{ width: 52, height: 52, borderRadius: 10, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {it.fotoUrl
          ? <img src={it.fotoUrl} alt={it.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Package size={22} color="var(--adm-text3)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 3px", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {it.nombre}{it.esCritico ? " ★" : ""}
        </p>
        <p style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", margin: 0 }}>
          {it.precioConIva ? clp(it.precioConIva * f) : "—"} · Stock: <strong style={{ color: "var(--adm-text)" }}>{fmtStock(it.stockActual)}</strong> {UNIDAD_LABEL[it.unidadBase] || ""}
        </p>
      </div>
    </div>
  );
}

function InsumoModal({ restaurantId, familias, insumo, ingresoManual, conIva, onClose, onChange, onDeleted, onReload }: { restaurantId: string; familias: string[]; insumo: Insumo | null; ingresoManual: boolean; conIva: boolean; onClose: () => void; onChange: (it: Insumo) => void; onDeleted: (id: string) => void; onReload: () => void }) {
  const priceF = conIva ? 1 : 1 / 1.19;
  const editing = !!insumo;
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">(editing ? "view" : "edit");
  const [cur, setCur] = useState<Insumo | null>(insumo); // datos actuales (se refrescan tras editar/mover)

  const [nombre, setNombre] = useState(insumo?.nombre ?? "");
  const [categoria, setCategoria] = useState(insumo?.categoria ?? "ABARROTE");
  const [unidad, setUnidad] = useState(insumo?.unidadBase ?? "UN");
  const [precio, setPrecio] = useState(insumo?.ultimoPrecio != null ? String(insumo.ultimoPrecio) : "");
  const [rendimiento, setRendimiento] = useState(insumo?.rendimiento != null ? String(insumo.rendimiento) : "");
  const [familia, setFamilia] = useState(insumo?.familia ?? "");
  const [creandoFamilia, setCreandoFamilia] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(insumo?.fotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Movimiento de stock (ingreso / retiro)
  const [moveType, setMoveType] = useState<"ingreso" | "retiro" | null>(null);
  const [moveQty, setMoveQty] = useState("");
  const [movePrecio, setMovePrecio] = useState("");
  const [moveMotivo, setMoveMotivo] = useState("consumo");
  const [moveNota, setMoveNota] = useState("");
  const [moving, setMoving] = useState(false);

  type Lote = { id: string; fecha: string; precioUnitario: number; cantidadInicial: number; cantidadRestante: number };
  const [lotes, setLotes] = useState<Lote[]>([]);
  const cargarLotes = () => {
    if (!editing) return;
    fetch(`/api/panel/bodega/insumos/${insumo!.id}/lotes?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d?.lotes) setLotes(d.lotes); }).catch(() => {});
  };
  useEffect(() => { cargarLotes(); /* eslint-disable-next-line */ }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  const precioNum = parseFloat(precio);
  const rendNum = parseFloat(rendimiento); // porcentaje: 90 = 90%
  const precioConRend = Number.isFinite(precioNum) && Number.isFinite(rendNum) && rendNum > 0 ? precioNum / (rendNum / 100) : null;

  // Al pasar a edición, recargar los inputs desde los datos actuales.
  function startEdit() {
    const it = cur;
    setNombre(it?.nombre ?? ""); setCategoria(it?.categoria ?? "ABARROTE"); setUnidad(it?.unidadBase ?? "UN");
    setPrecio(it?.ultimoPrecio != null ? String(it.ultimoPrecio) : "");
    setRendimiento(it?.rendimiento != null ? String(it.rendimiento) : "");
    setFamilia(it?.familia ?? ""); setCreandoFamilia(false); setFotoUrl(it?.fotoUrl ?? null);
    setMode("edit");
  }

  async function uploadFoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "insumos");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) { toast.error(d.error || "No se pudo subir la foto"); setUploading(false); return; }
      setFotoUrl(d.url);
    } catch { toast.error("Error de conexión"); }
    setUploading(false);
  }

  async function submit() {
    if (!nombre.trim()) { toast.error("Escribe el nombre del insumo"); return; }
    if (!Number.isFinite(precioNum) || precioNum < 0) { toast.error("El precio es obligatorio"); return; }
    if (!Number.isFinite(rendNum) || rendNum <= 0) { toast.error("El rendimiento es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = { restaurantId, nombre, categoria, unidadBase: unidad, ultimoPrecio: precio, rendimiento, familia, fotoUrl };
      const res = await fetch(editing ? `/api/panel/bodega/insumos/${insumo!.id}` : "/api/panel/bodega/insumos", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      onChange(d.insumo); onReload();
      if (editing) { toast.success("Insumo actualizado"); setCur({ ...(cur as Insumo), ...d.insumo }); setSaving(false); setMode("view"); }
      else { toast.success("Insumo agregado"); onClose(); }
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  async function eliminar() {
    if (!editing) return;
    if (!confirm(`¿Eliminar el insumo "${cur?.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/panel/bodega/insumos/${insumo!.id}?restaurantId=${restaurantId}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo eliminar"); setDeleting(false); return; }
      toast.success("Insumo eliminado");
      onDeleted(insumo!.id); onClose();
    } catch { toast.error("Error de conexión"); setDeleting(false); }
  }

  async function confirmarMovimiento() {
    const qty = parseFloat(moveQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error("Cantidad inválida"); return; }
    setMoving(true);
    try {
      const payload: any = { restaurantId, tipo: moveType, cantidad: qty };
      if (moveType === "ingreso" && parseFloat(movePrecio) >= 0) payload.precioConIva = movePrecio;
      if (moveType === "retiro") { payload.motivo = moveMotivo; if (moveNota.trim()) payload.nota = moveNota.trim(); }
      const res = await fetch(`/api/panel/bodega/insumos/${insumo!.id}/movimiento`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo registrar"); setMoving(false); return; }
      toast.success(moveType === "ingreso" ? "Ingreso registrado" : (d.costoConsumido != null ? `Retiro registrado — costo ${clp(Math.round(d.costoConsumido))}` : "Retiro registrado"));
      onReload(); // refresca la lista de Stock (precios/valor recalculados)
      if (moveType === "retiro") { onClose(); return; } // tras un retiro: cerrar y volver a Stock
      setCur({ ...(cur as Insumo), ...d.insumo }); cargarLotes();
      setMoving(false); setMoveType(null); setMoveQty(""); setMovePrecio(""); setMoveMotivo("consumo"); setMoveNota("");
    } catch { toast.error("Error de conexión"); setMoving(false); }
  }

  const showForm = !editing || mode === "edit";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: "var(--adm-bg, var(--adm-card))", borderRadius: 18, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 8 }}>
          <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>
            {!editing ? "Nuevo insumo" : mode === "edit" ? "Editar insumo" : "Detalle del insumo"}
          </h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>

        {showForm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Foto */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ width: 64, height: 64, borderRadius: 12, background: "var(--adm-hover)", border: "1px dashed var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
                {uploading ? <Loader2 size={20} className="animate-spin" color="var(--adm-text3)" />
                  : fotoUrl ? <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <ImagePlus size={22} color="var(--adm-text3)" />}
              </button>
              <div style={{ fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text2)", lineHeight: 1.4 }}>
                Foto del insumo (opcional).<br />Toca para subir.
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f); }} />
            </div>

            <label style={{ display: "block" }}>
              <span style={labelSpan}>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Aceite 5 litros" style={inputStyle} autoFocus />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "block", minWidth: 0 }}>
                <span style={labelSpan}>Categoría</span>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
                  {CATEGORIA_ORDER.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
                </select>
              </label>
              <label style={{ display: "block", minWidth: 0 }}>
                <span style={labelSpan}>Unidad de medida</span>
                <select value={unidad} onChange={(e) => setUnidad(e.target.value)} style={inputStyle}>
                  {UNIDADES.map((u) => <option key={u} value={u}>{UNIDAD_NOMBRE[u]} ({UNIDAD_LABEL[u]})</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "block" }}>
                <span style={labelSpan}>Precio</span>
                <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="$" style={inputStyle} />
              </label>
              <label style={{ display: "block" }}>
                <span style={labelSpan}>Rendimiento (%)</span>
                <input value={rendimiento} onChange={(e) => setRendimiento(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Ej: 90" style={inputStyle} />
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.28)", borderRadius: 9, padding: "10px 12px" }}>
              <span style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-text)" }}>Precio con rendimiento</span>
              <span style={{ fontFamily: FB, fontSize: "0.95rem", fontWeight: 800, color: ACCENT }}>{precioConRend !== null ? clp(precioConRend) : "—"}</span>
            </div>

            <div style={{ display: "block" }}>
              <span style={labelSpan}>Familia <span style={{ fontWeight: 500, color: "var(--adm-text3)" }}>(agrupa variantes, ej: “Aceite”)</span></span>
              {creandoFamilia ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={familia} onChange={(e) => setFamilia(e.target.value)} placeholder="Nombre de la nueva familia" style={{ ...inputStyle, flex: 1 }} autoFocus />
                  <button type="button" onClick={() => { setCreandoFamilia(false); setFamilia(""); }} title="Cancelar" style={{ flexShrink: 0, padding: "0 12px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer", fontFamily: F, fontWeight: 700 }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={familia} onChange={(e) => setFamilia(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Sin familia</option>
                    {familias.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <button type="button" onClick={() => { setCreandoFamilia(true); setFamilia(""); }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                    <Plus size={15} /> Nueva
                  </button>
                </div>
              )}
            </div>

            <button onClick={submit} disabled={saving || uploading} style={{ marginTop: 4, padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: saving || uploading ? 0.7 : 1 }}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar insumo"}
            </button>
            {editing && (
              <button onClick={() => setMode("view")} disabled={saving} style={{ padding: "9px 16px", borderRadius: 11, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
            )}
          </div>
        ) : cur ? (
          // ─── Ficha (solo lectura) ───
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 68, height: 68, borderRadius: 14, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {cur.fotoUrl ? <img src={cur.fotoUrl} alt={cur.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={26} color="var(--adm-text3)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 2px", lineHeight: 1.2 }}>{cur.nombre}</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>{CATEGORIA_LABEL[cur.categoria] || cur.categoria}{cur.familia ? ` · ${cur.familia}` : ""}</p>
              </div>
              <button onClick={startEdit} title="Editar insumo" aria-label="Editar insumo" style={{ flexShrink: 0, width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}>
                <Pencil size={16} />
              </button>
              <button onClick={eliminar} disabled={deleting} title="Eliminar insumo" aria-label="Eliminar insumo" style={{ flexShrink: 0, width: 38, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text3)", cursor: "pointer", opacity: deleting ? 0.5 : 1 }}>
                <Trash2 size={16} />
              </button>
            </div>

            {/* Stock destacado */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, background: "var(--adm-hover)", borderRadius: 12, padding: "12px 14px" }}>
              <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)" }}>Stock actual</span>
              <span style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", marginLeft: "auto" }}>{fmtStock(cur.stockActual)}</span>
              <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>{UNIDAD_LABEL[cur.unidadBase] || ""}</span>
            </div>

            {/* Datos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--adm-card-border)", border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
              <DataCell label={conIva ? "Precio prom. con IVA" : "Precio prom. sin IVA"} value={cur.precioConIva != null ? clp(cur.precioConIva * priceF) : "—"} />
              <DataCell label="Rendimiento" value={cur.rendimiento != null ? `${fmtStock(cur.rendimiento)}%` : "—"} />
              <DataCell label="Precio con rendimiento" value={cur.precioConRendimiento != null ? clp(cur.precioConRendimiento) : "—"} />
              <DataCell label={conIva ? "Valor en stock (con IVA)" : "Valor en stock (sin IVA)"} value={clp((cur.valorStock || 0) * priceF)} />
            </div>

            <button onClick={() => router.push(`/panel/bodega/insumo/${cur.id}`)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "1px solid rgba(45,212,191,0.4)", background: "rgba(45,212,191,0.08)", color: ACCENT, fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}>
              <LineChart size={16} /> Ver ficha completa · facturas y precios
            </button>

            {/* Lotes en stock (FIFO) */}
            {lotes.length > 0 && (
              <div>
                <p style={{ fontFamily: F, fontSize: "0.78rem", fontWeight: 800, color: "var(--adm-text)", margin: "0 0 6px" }}>Lotes en stock (se consumen de arriba hacia abajo)</p>
                <div style={{ border: "1px solid var(--adm-card-border)", borderRadius: 12, overflow: "hidden" }}>
                  {lotes.map((l) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--adm-card-border)" }}>
                      <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)" }}>{fmtStock(l.cantidadRestante)} {UNIDAD_LABEL[cur.unidadBase] || ""}</span>
                      <span style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)" }}>{new Date(l.fecha).toLocaleDateString("es-CL")}</span>
                      <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: ACCENT, marginLeft: "auto" }}>{clp(l.precioUnitario * priceF)} c/u</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ingreso / Retiro (parte inferior) */}
            {moveType ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, background: moveType === "ingreso" ? "rgba(45,212,191,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${moveType === "ingreso" ? "rgba(45,212,191,0.3)" : "rgba(245,158,11,0.3)"}`, borderRadius: 12, padding: 12 }}>
                <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 800, color: "var(--adm-text)" }}>{moveType === "ingreso" ? "Ingreso de stock" : "Retiro de stock (FIFO)"}</span>
                {moveType === "ingreso" && (
                  <input value={movePrecio} onChange={(e) => setMovePrecio(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Precio con IVA (unitario)" style={inputStyle} />
                )}
                {moveType === "retiro" && (
                  <>
                    <select value={moveMotivo} onChange={(e) => setMoveMotivo(e.target.value)} style={inputStyle}>
                      <option value="consumo">Consumo</option>
                      <option value="merma">Merma</option>
                      <option value="ajuste">Ajuste</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input value={moveNota} onChange={(e) => setMoveNota(e.target.value)} placeholder="Nota (opcional)" style={inputStyle} />
                    <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Se descuenta del lote más antiguo primero (FIFO); se guarda el costo consumido.</span>
                  </>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={moveQty} onChange={(e) => setMoveQty(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={`Cantidad (${UNIDAD_LABEL[cur.unidadBase] || "un"})`} style={{ ...inputStyle, flex: 1 }} autoFocus />
                  <button onClick={confirmarMovimiento} disabled={moving} style={{ flexShrink: 0, padding: "0 16px", borderRadius: 9, border: "none", background: moveType === "ingreso" ? ACCENT : "#f59e0b", color: moveType === "ingreso" ? "#0b3b36" : "#3a2a00", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", opacity: moving ? 0.7 : 1 }}>
                    {moving ? "…" : "Confirmar"}
                  </button>
                  <button onClick={() => { setMoveType(null); setMoveQty(""); }} style={{ flexShrink: 0, padding: "0 12px", borderRadius: 9, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer" }}><X size={16} /></button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: ingresoManual ? "1fr 1fr" : "1fr", gap: 10 }}>
                {ingresoManual && (
                  <button onClick={() => { setMoveType("ingreso"); setMoveQty(""); setMovePrecio(""); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.9rem", fontWeight: 800, cursor: "pointer" }}>
                    <ArrowDownToLine size={17} /> Ingreso
                  </button>
                )}
                <button onClick={() => { setMoveType("retiro"); setMoveQty(""); setMovePrecio(""); setMoveMotivo("consumo"); setMoveNota(""); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 11, border: "none", background: "#f59e0b", color: "#3a2a00", fontFamily: F, fontSize: "0.9rem", fontWeight: 800, cursor: "pointer" }}>
                  <ArrowUpFromLine size={17} /> Retiro
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--adm-card)", padding: "10px 12px" }}>
      <p style={{ fontFamily: FB, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{value}</p>
    </div>
  );
}

const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };
