"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";
import { parseHours, DAY_KEYS, DAY_NAMES, type EcommerceHours } from "@/lib/ecommerce/hours";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

export default function HoursPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [hours, setHours] = useState<EcommerceHours>(() => parseHours(null));
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/hours?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setHours(parseHours(d.hours)); setOpenNow(d.openNow); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const setEnabled = (v: boolean) => setHours((h) => ({ ...h, enabled: v }));
  const updDay = (k: string, patch: Partial<EcommerceHours["days"][string]>) =>
    setHours((h) => ({ ...h, days: { ...h.days, [k]: { ...h.days[k], ...patch } } }));

  async function save() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/ecommerce/hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, hours }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSaving(false); return; }
      setHours(parseHours(data.hours));
      setOpenNow(data.openNow);
      toast.success("Horario guardado");
    } catch { toast.error("Error de conexión"); }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Link href="/panel/ecommerce" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 18 }}>
        <ArrowLeft size={15} /> Ecommerce
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={20} color={ACCENT} /></div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Horario de atención</h1>
          <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Fuera de horario, la tienda aparece cerrada y no se pueden hacer pedidos.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", marginTop: 24 }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
          {/* Master toggle */}
          <section style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Aplicar horario</p>
              <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                {hours.enabled ? (openNow === false ? "Ahora: cerrado 🔒" : "Ahora: abierto ✅") : "Desactivado — la tienda está siempre abierta"}
              </p>
            </div>
            <Toggle on={hours.enabled} onClick={() => setEnabled(!hours.enabled)} />
          </section>

          {/* Días */}
          {hours.enabled && (
            <section style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              {DAY_KEYS.map((k) => {
                const d = hours.days[k];
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: k !== "6" ? "1px solid var(--adm-card-border)" : "none", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", width: 90, flexShrink: 0 }}>{DAY_NAMES[Number(k)]}</span>
                    <Toggle on={d.open} onClick={() => updDay(k, { open: !d.open })} />
                    {d.open ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="time" value={d.from} onChange={(e) => updDay(k, { from: e.target.value })} style={inp} />
                        <span style={{ fontFamily: FB, color: "var(--adm-text3)" }}>a</span>
                        <input type="time" value={d.to} onChange={(e) => updDay(k, { to: e.target.value })} style={inp} />
                      </div>
                    ) : (
                      <span style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text3)" }}>Cerrado</span>
                    )}
                  </div>
                );
              })}
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "4px 2px 0" }}>
                Para horario nocturno que cruza medianoche, pon la hora de cierre menor a la de apertura (ej: 20:00 a 02:00).
              </p>
            </section>
          )}

          <button onClick={save} disabled={saving} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 20px", background: ACCENT, border: "none", borderRadius: 10, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar horario"}
          </button>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 18 };
const inp: React.CSSProperties = { padding: "6px 8px", background: "var(--adm-input, var(--adm-card))", border: "1px solid var(--adm-input-border, var(--adm-card-border))", borderRadius: 8, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.82rem", outline: "none" };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", background: on ? "#22c55e" : "var(--adm-toggle-off, #ccc)", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} /></button>;
}
