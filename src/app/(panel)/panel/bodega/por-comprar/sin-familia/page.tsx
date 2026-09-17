"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { CATEGORIA_LABEL, UNIDAD_LABEL, fmtStock } from "@/lib/bodega/labels";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";

type Insumo = { id: string; nombre: string; categoria: string; unidadBase: string; familia: string | null; stockActual: number };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 9,
  color: "var(--adm-text)", fontFamily: FB, fontSize: "0.86rem", outline: "none", boxSizing: "border-box",
};

export default function SinFamiliaPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [familias, setFamilias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/panel/bodega/insumos?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/panel/bodega/familias?restaurantId=${restaurantId}`).then((r) => r.ok ? r.json() : null),
    ]).then(([i, fam]) => {
      if (i?.insumos) setInsumos((i.insumos as Insumo[]).filter((x) => !x.familia));
      if (fam?.familias) setFamilias((fam.familias as any[]).map((f) => f.familia));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  const onAssigned = (id: string, familia: string) => {
    setInsumos((prev) => prev.filter((x) => x.id !== id));
    setFamilias((prev) => prev.includes(familia) ? prev : [...prev, familia].sort());
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push("/panel/bodega/por-comprar")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text)", cursor: "pointer", flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: F, fontSize: "1.25rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Insumos sin familia</h1>
          <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Asígnales una familia para que entren en “Por comprar”</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : insumos.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 14, padding: 16 }}>
          <CheckCircle2 size={22} color={ACCENT} />
          <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text)", margin: 0 }}>Todos los insumos tienen familia asignada. 🎉</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <datalist id="familias-existentes">{familias.map((f) => <option key={f} value={f} />)}</datalist>
          {insumos.map((it) => (
            <Row key={it.id} insumo={it} restaurantId={restaurantId!} onAssigned={onAssigned} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ insumo, restaurantId, onAssigned }: { insumo: Insumo; restaurantId: string; onAssigned: (id: string, familia: string) => void }) {
  const [familia, setFamilia] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    const fam = familia.trim();
    if (!fam) { toast.error("Escribe o elige una familia"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/panel/bodega/insumos/${insumo.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, familia: fam }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); setSaving(false); return; }
      toast.success(`${insumo.nombre} → ${fam}`);
      onAssigned(insumo.id, fam);
    } catch { toast.error("Error de conexión"); setSaving(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F, fontSize: "0.86rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{insumo.nombre}</p>
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>{CATEGORIA_LABEL[insumo.categoria] || insumo.categoria} · {fmtStock(insumo.stockActual)} {UNIDAD_LABEL[insumo.unidadBase] || ""}</p>
      </div>
      <input list="familias-existentes" value={familia} onChange={(e) => setFamilia(e.target.value)} placeholder="Familia…" style={{ ...inputStyle, width: 150, flexShrink: 0 }} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }} />
      <button onClick={guardar} disabled={saving} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 9, border: "none", background: ACCENT, color: "#0b3b36", fontFamily: F, fontSize: "0.8rem", fontWeight: 800, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "…" : <><Plus size={14} /> Asignar</>}
      </button>
    </div>
  );
}
