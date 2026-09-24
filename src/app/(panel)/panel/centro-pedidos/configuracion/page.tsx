"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, ShoppingBag, Link2, Send, Copy, ChevronDown, ChevronUp, Database } from "lucide-react";
import { toast } from "sonner";
import { useSessionContext } from "@/lib/admin/SessionContext";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const ACCENT = "#F4A623";

interface CentroPedidosConfig {
  autoDeliverPickup?: boolean;
  posMode?: boolean;
}

export default function CentroPedidosConfigPage() {
  const session = useSessionContext();
  const restaurantId = session?.selectedRestaurantId;
  const [cfg, setCfg] = useState<CentroPedidosConfig>({});
  const [posMode, setPosMode] = useState(false); // valor efectivo mostrado en el toggle
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Conexión con Toteat (webhook)
  const [token, setToken] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const load = useCallback(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetch(`/api/panel/ecommerce/pos-orders/settings?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { if (d.config) setCfg(d.config); if (typeof d.posModeEffective === "boolean") setPosMode(d.posModeEffective); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);
  useEffect(() => { load(); }, [load]);

  const reloadConfig = useCallback(() => {
    if (!restaurantId) return;
    fetch(`/api/panel/ecommerce/pos-orders/config?restaurantId=${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setToken(d.token); if (!d.token) setSetupOpen(true); } })
      .catch(() => {});
  }, [restaurantId]);
  useEffect(() => { reloadConfig(); }, [reloadConfig]);

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

  async function generarToken() {
    if (!restaurantId) return;
    try {
      const r = await fetch("/api/panel/ecommerce/pos-orders/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "No se pudo generar"); return; }
      setToken(d.token);
      toast.success("Token generado");
    } catch { toast.error("Error de conexión"); }
  }

  async function probarConexion() {
    if (!restaurantId) return;
    setTesting(true);
    try {
      const r = await fetch("/api/panel/ecommerce/pos-orders/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "La prueba falló"); setTesting(false); return; }
      const created = d.webhook?.created ?? 0;
      toast.success(created > 0 ? "¡Funciona! Pedido de prueba recibido — míralo en el tablero." : "El webhook respondió, pero no creó el pedido de prueba.");
      reloadConfig();
    } catch { toast.error("Error de conexión"); }
    setTesting(false);
  }

  const base = typeof window !== "undefined" ? window.location.origin : "https://quierocomer.com";
  const webhookUrl = `${base}/api/ecommerce/toteat/webhook`;
  const webhookUrlToken = token ? `${webhookUrl}?token=${token}` : webhookUrl;
  const copy = (txt: string, msg: string) => { navigator.clipboard?.writeText(txt).then(() => toast.success(msg)).catch(() => {}); };

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

      {/* Conexión con Toteat */}
      <section style={{ background: "var(--adm-card)", border: `1px solid ${token ? "var(--adm-card-border)" : ACCENT}`, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
        <button onClick={() => setSetupOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--adm-text)" }}>
          <Link2 size={17} color={ACCENT} />
          <span style={{ flex: 1, textAlign: "left", fontFamily: F, fontSize: "0.95rem", fontWeight: 800 }}>Conexión con Toteat {token ? "" : "· pendiente"}</span>
          {setupOpen ? <ChevronUp size={17} color="var(--adm-text3)" /> : <ChevronDown size={17} color="var(--adm-text3)" />}
        </button>
        {setupOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 16px" }}>
          <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
            En Toteat, configura el <strong>Post Hook URL</strong> de pedidos apuntando a esta URL y agrega el header <strong>x-webhook-token</strong> con el token del local. Si Toteat no permite headers, usa la URL con el token incluido.
          </p>
          {!token ? (
            <button onClick={generarToken} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: ACCENT, color: "#1a1a1a", fontFamily: F, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}>
              Generar token del local
            </button>
          ) : (
            <>
              <Field label="Post Hook URL" value={webhookUrl} onCopy={() => copy(webhookUrl, "URL copiada")} />
              <Field label="Header · x-webhook-token" value={token} onCopy={() => copy(token, "Token copiado")} />
              <Field label="Alternativa · URL con token" value={webhookUrlToken} onCopy={() => copy(webhookUrlToken, "URL copiada")} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                <button onClick={probarConexion} disabled={testing} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: `${ACCENT}1a`, color: ACCENT, fontFamily: F, fontSize: "0.84rem", fontWeight: 800, cursor: testing ? "wait" : "pointer", opacity: testing ? 0.6 : 1 }}>
                  <Send size={15} /> {testing ? "Probando…" : "Probar conexión"}
                </button>
                <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)" }}>Envía un pedido de prueba por el webhook (verifica token, guardado y tablero en vivo).</span>
              </div>
              <button onClick={generarToken} style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "transparent", color: "var(--adm-text3)", fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                Regenerar token (invalida el anterior)
              </button>
            </>
          )}
        </div>
        )}
      </section>

      {/* Ajustes del flujo */}
      {loading ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", padding: 30, textAlign: "center" }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ToggleRow
            icon={Database}
            title="Gestionar todos los pedidos del POS"
            desc="Activado: el Centro de pedidos se alimenta SOLO de los pedidos que envía tu POS (Toteat) y NO trae los de ecommerce ni los de Tomar pedidos (así no llegan duplicados). Desactivado: los pedidos de ecommerce y manuales sí aparecen aquí (para locales sin POS)."
            checked={posMode}
            disabled={saving}
            onChange={(v) => { setPosMode(v); update({ posMode: v }); }}
          />
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

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div>
      <span style={{ display: "block", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-text2)", marginBottom: 4 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 8, padding: "8px 10px" }}>
        <code style={{ flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: "0.74rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</code>
        <button onClick={onCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Copy size={12} /> Copiar</button>
      </div>
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
