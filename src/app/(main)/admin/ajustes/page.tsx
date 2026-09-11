"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import { TRACKING_TEXT_GROUPS, DEFAULT_TRACKING_TEXTS, type TrackingTexts } from "@/lib/ecommerce/trackingTexts";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

type SyncResult = {
  planId: string;
  name: string;
  amountNet: number;
  amountIva: number;
  amountGross: number;
  action: "created" | "updated" | "no_change" | "error";
  previousAmount?: number;
  error?: string;
};

type SyncResponse = {
  ok: boolean;
  flowApiUrl: string;
  callbackUrl: string;
  results: SyncResult[];
};

const ACTION_LABEL: Record<SyncResult["action"], { label: string; color: string }> = {
  created: { label: "Creado", color: "#16a34a" },
  updated: { label: "Actualizado", color: "#2563eb" },
  no_change: { label: "Sin cambios", color: "#666" },
  error: { label: "Error", color: "#dc2626" },
};

export default function AjustesPage() {
  const { isSuper } = useAdminSession();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [googleKey, setGoogleKey] = useState("");
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [texts, setTexts] = useState<TrackingTexts>(DEFAULT_TRACKING_TEXTS);
  const [textsLoaded, setTextsLoaded] = useState(false);
  const [textsSaving, setTextsSaving] = useState(false);

  const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setGoogleKey(d.googleApiKey || ""); })
      .catch(() => {})
      .finally(() => setKeyLoaded(true));
  }, []);

  useEffect(() => {
    fetch("/api/admin/tracking-texts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setTexts(d); })
      .catch(() => {})
      .finally(() => setTextsLoaded(true));
  }, []);

  const saveTexts = async () => {
    setTextsSaving(true);
    try {
      const res = await fetch("/api/admin/tracking-texts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(texts) });
      if (!res.ok) { toast.error("No se pudo guardar"); setTextsSaving(false); return; }
      toast.success("Textos de seguimiento guardados");
    } catch { toast.error("Error de conexión"); }
    setTextsSaving(false);
  };

  const saveKeys = async () => {
    setKeySaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleApiKey: googleKey.trim() }) });
      if (!res.ok) { toast.error("No se pudo guardar"); setKeySaving(false); return; }
      toast.success("API keys guardadas");
    } catch { toast.error("Error de conexión"); }
    setKeySaving(false);
  };

  const handleSync = async () => {
    if (!confirm(
      "¿Sincronizar planes en Flow.cl con el monto BRUTO (neto + 19% IVA)?\n\n" +
      "Esto actualiza los planes en el dashboard de Flow para que cobren con IVA incluido. " +
      "Las suscripciones existentes pasarán a cobrar el nuevo monto en su próximo ciclo."
    )) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/billing/sync-flow-plans", { method: "POST" });
      const data: SyncResponse | { error: string } = await res.json();
      if (!res.ok && !("ok" in data)) {
        toast.error(("error" in data && data.error) || "Error al sincronizar");
        setSyncing(false);
        return;
      }
      setResult(data as SyncResponse);
      const ok = (data as SyncResponse).ok;
      if (ok) toast.success("Planes sincronizados en Flow");
      else toast.error("Algunos planes fallaron — revisa el detalle");
    } catch {
      toast.error("Error de conexión");
    }
    setSyncing(false);
  };

  if (!isSuper) {
    return <div style={{ padding: 32, color: "#888", fontFamily: FB }}>Solo superadmin</div>;
  }

  return (
    <div style={{ padding: "24px 24px 60px", maxWidth: 760, fontFamily: FB }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#F4A623", margin: "0 0 4px" }}>Ajustes</h1>
      <p style={{ fontSize: "0.85rem", color: "#888", margin: "0 0 28px" }}>Herramientas administrativas del sistema</p>

      {/* API Keys de integraciones */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2A2A2A", borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <h2 style={{ fontFamily: F, fontSize: "1rem", color: "#fff", margin: "0 0 6px" }}>API Keys de integraciones</h2>
        <p style={{ fontSize: "0.85rem", color: "#999", lineHeight: 1.5, margin: "0 0 16px" }}>
          Claves globales de la plataforma. La de Google se usa en <strong style={{ color: "#ddd" }}>Configuración → General → Dirección</strong> de los locales (autocompletado de direcciones).
        </p>

        <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Google API Key (Places / Geocoding)</label>
        <input
          value={googleKey}
          onChange={(e) => setGoogleKey(e.target.value)}
          placeholder={keyLoaded ? "AIzaSy…" : "Cargando…"}
          type="password"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #2A2A2A", borderRadius: 8, color: "#fff", fontFamily: "monospace", fontSize: "0.82rem", outline: "none", marginBottom: 12 }}
        />
        <button onClick={saveKeys} disabled={keySaving || !keyLoaded} style={{
          padding: "10px 18px", background: GOLD, color: "#1a1a1a", border: "none", borderRadius: 8,
          fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: keySaving ? "wait" : "pointer", opacity: keySaving || !keyLoaded ? 0.6 : 1,
        }}>
          {keySaving ? "Guardando…" : "Guardar API keys"}
        </button>
      </div>

      {/* Sync Flow Plans */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2A2A2A", borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <h2 style={{ fontFamily: F, fontSize: "1rem", color: "#fff", margin: "0 0 6px" }}>Sincronizar planes Flow.cl</h2>
        <p style={{ fontSize: "0.85rem", color: "#999", lineHeight: 1.5, margin: "0 0 14px" }}>
          Crea o actualiza los planes en Flow con el monto BRUTO (neto + 19% IVA).
          Los precios netos viven en <code style={{ background: "#000", padding: "1px 6px", borderRadius: 3, color: "#F4A623" }}>plans-config.ts</code> —
          este botón los empuja a Flow para que los cobros mensuales ya incluyan IVA.
        </p>

        <button onClick={handleSync} disabled={syncing} style={{
          padding: "10px 18px", background: GOLD, color: "#1a1a1a", border: "none", borderRadius: 8,
          fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: syncing ? "wait" : "pointer",
        }}>
          {syncing ? "Sincronizando…" : "Sincronizar planes en Flow"}
        </button>

        {result && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #2A2A2A" }}>
            <p style={{ fontSize: "0.75rem", color: "#666", margin: "0 0 4px" }}>
              Endpoint: <span style={{ color: "#999" }}>{result.flowApiUrl}</span>
            </p>
            <p style={{ fontSize: "0.75rem", color: "#666", margin: "0 0 14px" }}>
              Callback: <span style={{ color: "#999" }}>{result.callbackUrl}</span>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.results.map((r) => {
                const status = ACTION_LABEL[r.action];
                return (
                  <div key={r.planId} style={{ background: "#0d0d0d", border: "1px solid #2A2A2A", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>
                        {r.name} <span style={{ color: "#666", fontWeight: 400, fontSize: "0.75rem" }}>({r.planId})</span>
                      </span>
                      <span style={{ fontFamily: F, fontSize: "0.7rem", fontWeight: 700, color: status.color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {status.label}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "#bbb", margin: 0 }}>
                      Neto {fmt(r.amountNet)} + IVA {fmt(r.amountIva)} = <strong style={{ color: "#F4A623" }}>{fmt(r.amountGross)}</strong>
                      {r.previousAmount !== undefined && r.previousAmount !== r.amountGross && (
                        <span style={{ color: "#666" }}> · antes: {fmt(r.previousAmount)}</span>
                      )}
                    </p>
                    {r.error && <p style={{ fontSize: "0.78rem", color: "#ef4444", margin: "6px 0 0" }}>{r.error}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Textos del seguimiento del pedido */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2A2A2A", borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <h2 style={{ fontFamily: F, fontSize: "1rem", color: "#fff", margin: "0 0 6px" }}>Textos del seguimiento del pedido</h2>
        <p style={{ fontSize: "0.85rem", color: "#999", lineHeight: 1.5, margin: "0 0 18px" }}>
          Todo lo que ve el cliente en su página de seguimiento (<code style={{ background: "#000", padding: "1px 6px", borderRadius: 3, color: "#F4A623" }}>/pedido/…</code>, el link que llega por correo), en cada estado. Aplica a todos los locales. Deja un campo vacío para usar el texto por defecto.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {TRACKING_TEXT_GROUPS.map((grp) => (
            <div key={grp.group}>
              <h3 style={{ fontFamily: F, fontSize: "0.8rem", fontWeight: 700, color: "#F4A623", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>{grp.group}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {grp.fields.map((f) => (
                  <label key={f.key} style={{ display: "block" }}>
                    <span style={{ display: "block", fontFamily: FB, fontSize: "0.72rem", fontWeight: 600, color: "#888", marginBottom: 5 }}>{f.label}</span>
                    {f.multiline ? (
                      <textarea
                        value={texts[f.key]}
                        onChange={(e) => setTexts((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={textsLoaded ? DEFAULT_TRACKING_TEXTS[f.key] : "Cargando…"}
                        rows={2}
                        style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "#0d0d0d", border: "1px solid #2A2A2A", borderRadius: 8, color: "#fff", fontFamily: FB, fontSize: "0.85rem", outline: "none", resize: "vertical" }}
                      />
                    ) : (
                      <input
                        value={texts[f.key]}
                        onChange={(e) => setTexts((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={textsLoaded ? DEFAULT_TRACKING_TEXTS[f.key] : "Cargando…"}
                        style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "#0d0d0d", border: "1px solid #2A2A2A", borderRadius: 8, color: "#fff", fontFamily: FB, fontSize: "0.85rem", outline: "none" }}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={saveTexts} disabled={textsSaving || !textsLoaded} style={{
            padding: "10px 18px", background: GOLD, color: "#1a1a1a", border: "none", borderRadius: 8,
            fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: textsSaving ? "wait" : "pointer", opacity: textsSaving || !textsLoaded ? 0.6 : 1,
          }}>
            {textsSaving ? "Guardando…" : "Guardar textos"}
          </button>
          <button onClick={() => setTexts({ ...DEFAULT_TRACKING_TEXTS })} disabled={textsSaving} style={{
            padding: "10px 18px", background: "transparent", color: "#999", border: "1px solid #2A2A2A", borderRadius: 8,
            fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
          }}>
            Restaurar por defecto
          </button>
        </div>
      </div>
    </div>
  );
}
