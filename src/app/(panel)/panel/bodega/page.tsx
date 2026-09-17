"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Warehouse, Plus, Package, X, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { CATEGORIA_LABEL, CATEGORIA_ORDER, UNIDAD_LABEL, UNIDADES, clp, fmtStock } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";

type Insumo = {
  id: string;
  nombre: string;
  categoria: string;
  unidadBase: string;
  ultimoPrecio: number | null;
  stockActual: number;
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

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.insumos) setInsumos(d.insumos); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  // Agrupar por categoría, respetando el orden definido.
  const grupos = useMemo(() => {
    const byCat: Record<string, Insumo[]> = {};
    for (const it of insumos) (byCat[it.categoria] ??= []).push(it);
    return CATEGORIA_ORDER
      .filter((c) => byCat[c]?.length)
      .map((c) => {
        const items = byCat[c];
        const total = items.reduce((s, it) => s + it.stockActual * (it.ultimoPrecio || 0), 0);
        return { categoria: c, items, total };
      });
  }, [insumos]);

  const totalGeneral = useMemo(
    () => insumos.reduce((s, it) => s + it.stockActual * (it.ultimoPrecio || 0), 0),
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
            {insumos.length} insumo{insumos.length === 1 ? "" : "s"} · valor total {clp(totalGeneral)}
          </p>
        </div>
      </div>

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
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 4px 8px" }}>
              <h2 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>
                {CATEGORIA_LABEL[g.categoria] || g.categoria}
              </h2>
              <span style={{ fontFamily: FB, fontSize: "0.8rem", fontWeight: 700, color: ACCENT }}>{clp(g.total)}</span>
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", marginLeft: "auto" }}>{g.items.length} ítem{g.items.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {g.items.map((it) => (
                <InsumoCard key={it.id} it={it} />
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

      {modalOpen && restaurantId && (
        <CreateModal
          restaurantId={restaurantId}
          onClose={() => setModalOpen(false)}
          onCreated={(it) => { setInsumos((prev) => [...prev, it]); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

function InsumoCard({ it }: { it: Insumo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 12 }}>
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
          {it.ultimoPrecio ? clp(it.ultimoPrecio) : "—"} · Stock: <strong style={{ color: "var(--adm-text)" }}>{fmtStock(it.stockActual)}</strong> {UNIDAD_LABEL[it.unidadBase] || ""}
        </p>
      </div>
    </div>
  );
}

function CreateModal({ restaurantId, onClose, onCreated }: { restaurantId: string; onClose: () => void; onCreated: (it: Insumo) => void }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("ABARROTE");
  const [unidadBase, setUnidadBase] = useState("UN");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [esCritico, setEsCritico] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setSaving(true);
    try {
      const res = await fetch("/api/panel/bodega/insumos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, nombre, categoria, unidadBase, ultimoPrecio: precio, stockInicial: stock, fotoUrl, esCritico }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo crear"); setSaving(false); return; }
      toast.success("Insumo agregado");
      onCreated(d.insumo);
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "var(--adm-bg, var(--adm-card))", borderRadius: "18px 18px 0 0", padding: 20, boxShadow: "0 -8px 30px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: F, fontSize: "1.05rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Nuevo insumo</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text3)" }}><X size={20} /></button>
        </div>

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
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Arroz sushi" style={inputStyle} autoFocus />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block" }}>
              <span style={labelSpan}>Categoría</span>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
                {CATEGORIA_ORDER.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={labelSpan}>Unidad</span>
              <select value={unidadBase} onChange={(e) => setUnidadBase(e.target.value)} style={inputStyle}>
                {UNIDADES.map((u) => <option key={u} value={u}>{UNIDAD_LABEL[u]}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "block" }}>
              <span style={labelSpan}>Precio unitario (opcional)</span>
              <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder="$" style={inputStyle} />
            </label>
            <label style={{ display: "block" }}>
              <span style={labelSpan}>Stock inicial</span>
              <input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" style={inputStyle} />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={esCritico} onChange={(e) => setEsCritico(e.target.checked)} />
            <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)" }}>Insumo crítico (control frecuente)</span>
          </label>

          <button onClick={submit} disabled={saving || uploading} style={{ marginTop: 4, padding: "12px 16px", borderRadius: 11, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.92rem", fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: saving || uploading ? 0.7 : 1 }}>
            {saving ? "Guardando…" : "Agregar insumo"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelSpan: React.CSSProperties = { display: "block", fontFamily: F, fontSize: "0.76rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 5 };
