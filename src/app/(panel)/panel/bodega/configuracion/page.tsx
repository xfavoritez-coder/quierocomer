"use client";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#2dd4bf";

export default function BodegaConfigPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [ingresoManual, setIngresoManual] = useState(true);
  const [conIva, setConIva] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/bodega/config?restaurantId=${restaurantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setIngresoManual(d.ingresoManualEnabled !== false); setConIva(d.mostrarPreciosConIva !== false); } })
      .catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  async function save(patch: any, revert: () => void) {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/bodega/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, ...patch }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "No se pudo guardar"); revert(); setSaving(false); return; }
      toast.success("Configuración guardada");
    } catch { toast.error("Error de conexión"); revert(); }
    setSaving(false);
  }
  const toggleIngreso = (next: boolean) => { setIngresoManual(next); save({ ingresoManualEnabled: next }, () => setIngresoManual(!next)); };
  const toggleIva = (next: boolean) => { setConIva(next); save({ mostrarPreciosConIva: next }, () => setConIva(!next)); };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px 96px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(45,212,191,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Settings size={22} color={ACCENT} /></div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.35rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Configuración</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Ajustes de la bodega</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: FB, color: "var(--adm-text3)" }}>Cargando…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ToggleRow
            titulo="Permitir ingreso manual de stock"
            desc={<>Si lo desactivas, el botón <strong>Ingreso</strong> del detalle de insumo se oculta y el stock solo entra desde <strong>Compras</strong>. Los retiros siguen disponibles.</>}
            on={ingresoManual} saving={saving} onToggle={toggleIngreso}
          />
          <ToggleRow
            titulo="Mostrar precios con IVA"
            desc={<>En <strong>Stock</strong>, los precios y el valor del inventario se muestran {conIva ? "con IVA" : "sin IVA (neto)"}. Desactívalo para verlos sin IVA.</>}
            on={conIva} saving={saving} onToggle={toggleIva}
          />
        </div>
      )}

      <p style={{ fontFamily: FB, fontSize: "0.74rem", color: "var(--adm-text3)", margin: "12px 2px 0", lineHeight: 1.5 }}>
        Esta configuración es de la bodega: si dos locales comparten bodega, aplica para ambos.
      </p>
    </div>
  );
}

function ToggleRow({ titulo, desc, on, saving, onToggle }: { titulo: string; desc: React.ReactNode; on: boolean; saving: boolean; onToggle: (next: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 16 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 3px" }}>{titulo}</p>
        <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => !saving && onToggle(!on)}
        style={{ width: 50, height: 30, borderRadius: 15, border: "none", cursor: saving ? "default" : "pointer", position: "relative", flexShrink: 0, background: on ? ACCENT : "var(--adm-card-border)", transition: "background 0.2s", opacity: saving ? 0.6 : 1 }}
      >
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </button>
    </div>
  );
}
