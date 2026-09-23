"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

interface CentroPedidosConfig {
  autoDeliverPickup?: boolean;
}

export default function CentroPedidosConfigPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [cfg, setCfg] = useState<CentroPedidosConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/pos-orders/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) setCfg(d.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);
  useEffect(() => { load(); }, [load]);

  async function update(patch: Partial<CentroPedidosConfig>) {
    if (!restaurantId) return;
    const next = { ...cfg, ...patch };
    setCfg(next); // optimista
    setSaving(true);
    try {
      const r = await fetch("/api/panel/ecommerce/pos-orders/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, config: patch }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error || "No se pudo guardar"); load(); return; }
      toast.success("Configuración guardada");
    } catch { toast.error("Error de conexión"); load(); }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px 60px" }}>
      <Link href="/panel/centro-pedidos" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Centro de pedidos
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${ACCENT}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}><Settings size={20} color={ACCENT} /></div>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>Configuración</h1>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>Ajustes del Centro de pedidos.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 30, textAlign: "center" }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ToggleRow
            icon={ShoppingBag}
            title="Auto-entregar pedidos de retiro"
            desc="Los pedidos de retiro pasan automáticamente a «Entregado» al marcarlos «Listo» (el cliente los retira al estar listos, no hay reparto)."
            checked={!!cfg.autoDeliverPickup}
            disabled={saving}
            onChange={(v) => update({ autoDeliverPickup: v })}
          />
        </div>
      )}
    </div>
  );
}

function ToggleRow({ icon: Icon, title, desc, checked, disabled, onChange }: { icon: any; title: string; desc: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", background: "var(--adm-card)", border: `1px solid ${checked ? ACCENT : "var(--adm-card-border)"}`, borderRadius: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={18} color={checked ? ACCENT : "var(--adm-text3)"} /></div>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: F, fontSize: "0.92rem", fontWeight: 800, color: "var(--adm-text)", margin: 0 }}>{title}</p>
        <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "3px 0 0", lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{ width: 48, height: 28, borderRadius: 14, border: "none", cursor: disabled ? "wait" : "pointer", position: "relative", background: checked ? ACCENT : "var(--adm-hover)", transition: "background .2s", flexShrink: 0, opacity: disabled ? 0.6 : 1 }}
      >
        <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .2s" }} />
      </button>
    </div>
  );
}
