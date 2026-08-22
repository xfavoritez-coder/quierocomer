"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Truck, Save } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import type { DeliveryZone } from "@/lib/ecommerce/delivery";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

function newZone(): DeliveryZone {
  return { id: Math.random().toString(36).slice(2, 10), name: "", fee: 0, minOrder: null, estimatedTime: null, active: true };
}

export default function EcommerceDeliveryPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/delivery?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setZones(d.zones || []); setDeliveryEnabled(d.deliveryEnabled); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  function update(id: string, patch: Partial<DeliveryZone>) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }
  function remove(id: string) { setZones((prev) => prev.filter((z) => z.id !== id)); }
  function add() { setZones((prev) => [...prev, newZone()]); }

  async function save() {
    if (!restaurantId) return;
    const clean = zones.filter((z) => z.name.trim());
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/delivery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, zones: clean }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return; }
      setZones(data.zones);
      toast.success("Zonas guardadas");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Truck size={20} color={ACCENT} />
        </div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Zonas de delivery</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Define a qué comunas/sectores repartes y su costo de despacho.</p>
        </div>
      </div>

      {!deliveryEnabled && (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.3)", fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)" }}>
          El delivery está desactivado en la configuración de Pedidos. Actívalo para que estas zonas se apliquen en la tienda.
        </div>
      )}

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {zones.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 20px", border: "1px dashed var(--adm-card-border)", borderRadius: 14, fontFamily: FB, color: "var(--adm-text3)" }}>
                Aún no tienes zonas. Agrega la primera comuna/sector a la que repartes.
              </div>
            )}
            {zones.map((z) => (
              <div key={z.id} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 180px", minWidth: 140 }}>
                    <label style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Comuna / sector</label>
                    <input value={z.name} onChange={(e) => update(z.id, { name: e.target.value })} placeholder="Ej: La Florida" style={inp} />
                  </div>
                  <div style={{ flex: "0 1 120px", minWidth: 100 }}>
                    <label style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Costo despacho</label>
                    <input value={z.fee || ""} onChange={(e) => update(z.id, { fee: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" placeholder="0" style={inp} />
                  </div>
                  <div style={{ flex: "0 1 120px", minWidth: 100 }}>
                    <label style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Mínimo (opc.)</label>
                    <input value={z.minOrder || ""} onChange={(e) => update(z.id, { minOrder: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} inputMode="numeric" placeholder="—" style={inp} />
                  </div>
                  <div style={{ flex: "0 1 130px", minWidth: 110 }}>
                    <label style={{ fontFamily: FB, fontSize: "0.66rem", fontWeight: 700, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Tiempo (opc.)</label>
                    <input value={z.estimatedTime || ""} onChange={(e) => update(z.id, { estimatedTime: e.target.value || null })} placeholder="30-45 min" style={inp} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <button onClick={() => update(z.id, { active: !z.active })} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: FB, fontSize: "0.78rem", fontWeight: 600, color: z.active ? "#22c55e" : "var(--adm-text3)" }}>
                    <span style={{ width: 34, height: 20, borderRadius: 12, background: z.active ? "#22c55e" : "var(--adm-toggle-off, #ccc)", position: "relative", transition: "background .2s" }}>
                      <span style={{ position: "absolute", top: 2, left: z.active ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />
                    </span>
                    {z.active ? "Activa" : "Inactiva"}
                  </button>
                  <button onClick={() => remove(z.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: FB, fontSize: "0.76rem", fontWeight: 600, color: "#ef4444" }}>
                    <Trash2 size={14} /> Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={add} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              <Plus size={16} /> Agregar zona
            </button>
            <button onClick={save} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
              <Save size={16} /> {saving ? "Guardando…" : "Guardar zonas"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", marginTop: 4, padding: "8px 10px", background: "var(--adm-input, var(--adm-card))",
  border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8,
  color: "var(--adm-text)", fontFamily: "var(--font-body)", fontSize: "0.85rem", outline: "none",
};
