"use client";

import { useState, useEffect } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import { MapPin, AlertTriangle } from "lucide-react";
import LoyaltyNav from "../LoyaltyNav";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  background: "var(--adm-card)",
  border: "1px solid var(--adm-card-border)",
  borderRadius: 8,
  color: "var(--adm-text)",
  fontFamily: FB,
  fontSize: "0.88rem",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: F,
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--adm-text2)",
  marginBottom: 6,
};

const PRESETS = [
  { label: "150 m", km: 0.15 },
  { label: "500 m", km: 0.5 },
  { label: "1 km", km: 1 },
  { label: "2 km", km: 2 },
];

export default function LoyaltyGeoPage() {
  const { selectedRestaurantId, loading } = usePanelSession();

  const [enabled, setEnabled] = useState(false);
  const [radiusKm, setRadiusKm] = useState(1);
  const [message, setMessage] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoadingProgram(true);
    setSaved(false);
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.program) {
          setEnabled(!!d.program.geoEnabled);
          setRadiusKm(d.program.geoRadiusKm ?? 1);
          setMessage(d.program.geoMessage || "");
        }
        setAddress(d.restaurant?.address ?? null);
        setHasLocation(!!d.restaurant?.hasLocation);
      })
      .catch(() => {})
      .finally(() => setLoadingProgram(false));
  }, [selectedRestaurantId]);

  const save = async () => {
    if (!selectedRestaurantId) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/loyalty/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, geoEnabled: enabled, geoRadiusKm: radiusKm, geoMessage: message }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      setSaved(true);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const refreshAll = async () => {
    if (!selectedRestaurantId) return;
    if (!window.confirm("¿Aplicar la configuración de cercanía a todas las tarjetas ya instaladas?")) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/loyalty/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      toast.success(`Aplicado · ${d.appleDevices} iPhone${d.google ? " + Android" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={20} color="var(--adm-text3)" /> Notificaciones por cercanía
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Avisa al cliente en su pantalla cuando pasa cerca de tu local. El teléfono lo detecta solo (usa la ubicación del local en QuieroComer).
        </p>
      </div>

      <LoyaltyNav />

      {loading || loadingProgram ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Dirección desde donde se envían los avisos (solo lectura) */}
          {hasLocation ? (
            <div style={{ padding: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <label style={labelStyle}>Los avisos se enviarán desde:</label>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <MapPin size={16} color={GOLD} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontFamily: FB, fontSize: "0.9rem", color: "var(--adm-text)" }}>
                  {address || "Ubicación de tu local (configurada)"}
                </span>
              </div>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0", lineHeight: 1.5 }}>
                Es la dirección de tu restaurante en QuieroComer. Para cambiarla, edítala en los <b>Ajustes</b> de tu local.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 14, background: "rgba(224,160,32,0.08)", border: "1px solid rgba(224,160,32,0.35)", borderRadius: 12 }}>
              <AlertTriangle size={18} color="#e0a020" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontFamily: F, fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>Tu local no tiene ubicación configurada</p>
                <p style={{ fontFamily: FB, fontSize: "0.8rem", color: "var(--adm-text2)", margin: "3px 0 0", lineHeight: 1.5 }}>
                  Para enviar avisos por cercanía, configura la dirección de tu restaurante en los <b>Ajustes</b> de QuieroComer. Sin ubicación, los avisos no se enviarán.
                </p>
              </div>
            </div>
          )}

          {/* Activar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
            <div>
              <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>Activar avisos por cercanía</p>
              <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                Requiere que tu local tenga ubicación configurada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setEnabled((v) => !v); setSaved(false); }}
              aria-pressed={enabled}
              style={{ position: "relative", height: 26, width: 46, flexShrink: 0, borderRadius: 999, border: "none", cursor: "pointer", background: enabled ? "#16a34a" : "var(--adm-card-border)", transition: "background 0.15s" }}
            >
              <span style={{ position: "absolute", top: 3, left: enabled ? 23 : 3, height: 20, width: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
            </button>
          </div>

          {enabled && (
            <>
              <div>
                <label style={labelStyle}>Distancia del aviso</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PRESETS.map((opt) => {
                    const active = Math.abs(radiusKm - opt.km) < 0.001;
                    return (
                      <button
                        key={opt.km}
                        type="button"
                        onClick={() => { setRadiusKm(opt.km); setSaved(false); }}
                        style={{ padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, background: active ? "rgba(244,166,35,0.14)" : "var(--adm-card)", border: `1.5px solid ${active ? GOLD : "var(--adm-card-border)"}`, color: active ? GOLD : "var(--adm-text2)" }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                  A qué distancia del local se activa (iPhone). En Android el radio es fijo (~150 m).
                </p>
              </div>

              <div>
                <label style={labelStyle}>Mensaje del aviso</label>
                <input
                  type="text"
                  value={message}
                  maxLength={120}
                  placeholder="Ej: ¡Estás cerca! Pásate por tus sellos 🍣"
                  onChange={(e) => { setMessage(e.target.value); setSaved(false); }}
                  style={inputStyle}
                />
              </div>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 2 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{ padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {saved && <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#16a34a" }}>✓ Guardado</span>}
          </div>

          <div style={{ borderTop: "1px solid var(--adm-card-border)", paddingTop: 16 }}>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", color: "var(--adm-text)", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshing ? "Aplicando…" : "↻ Aplicar a las tarjetas ya instaladas"}
            </button>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "8px 0 0", lineHeight: 1.5 }}>
              Guarda primero. Las tarjetas nuevas ya incluyen esta configuración.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
