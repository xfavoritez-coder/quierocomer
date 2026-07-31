"use client";
import { useState, useEffect } from "react";
import { Star, ExternalLink, Gift, Eye, Lock } from "lucide-react";
import { toast } from "sonner";

const GOLD = "#F4A623";
const F = "var(--font-display)";
const FB = "var(--font-body)";

const CARD = {
  background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
  borderRadius: 22, padding: "22px 20px", marginBottom: 12,
} as const;

const LABEL = {
  fontFamily: F, fontSize: "0.82rem", fontWeight: 800,
  color: "var(--adm-text3)", margin: "0 0 10px",
  textTransform: "uppercase" as const, letterSpacing: ".6px",
  display: "flex", alignItems: "center", gap: 6,
} as const;

const INPUT = {
  width: "100%", padding: "12px 14px", boxSizing: "border-box" as const,
  background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)",
  borderRadius: 12, color: "var(--adm-text)", fontFamily: FB, fontSize: "0.85rem",
  outline: "none",
} as const;

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 999, flexShrink: 0,
      background: on ? GOLD : "var(--adm-card-border)",
      border: "none", cursor: "pointer", position: "relative", transition: "background .2s",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s",
      }} />
    </button>
  );
}

export default function ValoracionesPage() {
  const [rid, setRid] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"google" | "private">("google");
  const [savedMode, setSavedMode] = useState<"google" | "private" | "off">("off");
  const [googleUrl, setGoogleUrl] = useState("");
  const [hasReward, setHasReward] = useState(false);
  const [reward, setReward] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/panel/me")
      .then(r => r.json())
      .then(d => {
        const r = d.restaurants?.[0];
        if (!r) return;
        setRid(r.id);
        setSlug(r.slug || "");
        const rm = r.reviewMode || "off";
        setSavedMode(rm);
        if (rm !== "off") {
          setEnabled(true);
          setMode(rm as "google" | "private");
        } else {
          setEnabled(false);
          setMode("google");
        }
        setGoogleUrl(r.googleReviewUrl || "");
        setReward(r.reviewReward || "");
        setHasReward(!!r.reviewReward);
      })
      .finally(() => setLoading(false));
  }, []);

  const effectiveMode = enabled ? mode : "off";

  const handleSave = async () => {
    if (!rid) return;
    if (enabled && mode === "google" && !googleUrl.trim()) {
      toast.error("Agrega el link de Google antes de guardar");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/panel/valoraciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: rid,
          reviewMode: effectiveMode,
          googleReviewUrl: enabled && mode === "google" ? googleUrl.trim() || null : null,
          reviewReward: hasReward && reward.trim() ? reward.trim() : null,
        }),
      });
      if (!res.ok) throw new Error();
      setSavedMode(effectiveMode as "google" | "private" | "off");
      toast.success("Guardado");
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  const previewLabel = hasReward && reward.trim() ? "Comenta y gana" : mode === "private" ? "Déjanos tu opinión" : "Déjanos una reseña";
  const previewSub = hasReward && reward.trim() ? reward.trim()
    : mode === "google" ? "Nos ayuda mucho en Google" : "Tu opinión es privada y va directo al local";
  const showPreview = enabled;

  if (loading) return null;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: FB }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <Star size={20} color="var(--adm-text3)" /> Valoraciones
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 28px" }}>
        Muestra un botón en tu página para que los clientes te dejen una reseña.
      </p>

      {/* Toggle maestro */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ ...LABEL, margin: "0 0 3px" }}><Star size={13} /> Mostrar botón de reseña</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>
              {enabled ? "Activo · El botón aparecerá en tu página" : "Desactivado · No se muestra ningún botón de reseña"}
            </p>
          </div>
          <Toggle on={enabled} onToggle={() => setEnabled(v => !v)} />
        </div>
      </div>

      {/* Configuración — solo si activo */}
      {enabled && (
        <>
          {/* Modo */}
          <div style={CARD}>
            <h2 style={LABEL}>Tipo de reseña</h2>
            <div style={{ display: "flex", gap: 10 }}>
              {([["google", "🌐", "Google Reviews", "Públicas en Google Maps"], ["private", "🔒", "Reseña privada", "Solo tú las ves en el panel"]] as const).map(([val, icon, title, desc]) => (
                <button key={val} onClick={() => setMode(val)} style={{
                  flex: 1, padding: "14px 12px", borderRadius: 16, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${mode === val ? GOLD : "var(--adm-card-border)"}`,
                  background: mode === val ? `${GOLD}10` : "rgba(255,255,255,.02)",
                }}>
                  <span style={{ fontSize: 20, display: "block", marginBottom: 6 }}>{icon}</span>
                  <span style={{ display: "block", fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 2 }}>{title}</span>
                  <span style={{ display: "block", fontFamily: FB, fontSize: "0.76rem", color: "var(--adm-text3)" }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Google URL */}
          {mode === "google" && (
            <div style={CARD}>
              <h2 style={LABEL}><ExternalLink size={13} /> Link de Google Reviews</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px" }}>
                Abre Google Maps, busca tu local, ve a <strong>Reseñas</strong> → <strong>Escribir una reseña</strong> y copia el link del navegador.
              </p>
              <input value={googleUrl} onChange={e => setGoogleUrl(e.target.value)}
                placeholder="https://maps.google.com/..." style={INPUT} />
            </div>
          )}

          {/* Google Reviews — info */}
          {mode === "google" && (
            <div style={CARD}>
              <h2 style={LABEL}><ExternalLink size={13} /> ¿Cómo funciona?</h2>
              <p style={{ fontSize: "0.83rem", color: "var(--adm-text2)", margin: 0 }}>
                Al hacer clic, el cliente es llevado directamente a Google Maps donde puede dejar su reseña pública.
                Estas reseñas aparecen en tu ficha de Google y ayudan a tu posicionamiento.
              </p>
            </div>
          )}

          {/* Modo privado — info */}
          {mode === "private" && (
            <div style={CARD}>
              <h2 style={LABEL}><Lock size={13} /> Reseñas privadas</h2>
              <p style={{ fontSize: "0.83rem", color: "var(--adm-text2)", margin: "0 0 10px" }}>
                Los clientes van a tu página de local en <strong>quierocomer.com/{slug || "tu-local"}</strong> y pueden dejar su rating y comentario.
                Solo tú puedes ver las reseñas en la sección <strong>Reseñas recibidas</strong>.
              </p>
              {slug && (
                <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "0.8rem", color: GOLD, textDecoration: "none" }}>
                  Ver tu página →
                </a>
              )}
            </div>
          )}

          {/* Premio */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasReward ? 14 : 0 }}>
              <div>
                <h2 style={{ ...LABEL, margin: "0 0 3px" }}><Gift size={13} /> Ofrecer un premio</h2>
              </div>
              <Toggle on={hasReward} onToggle={() => setHasReward(v => !v)} />
            </div>
            {hasReward && (
              <input value={reward} onChange={e => setReward(e.target.value)}
                placeholder="Ej: Un café gratis en tu próxima visita" style={INPUT} />
            )}
          </div>

          {/* Vista previa */}
          {showPreview && (
            <div style={CARD}>
              <h2 style={LABEL}><Eye size={13} /> Vista previa en tu página</h2>
              <div style={{ background: "#111", borderRadius: 14, padding: "14px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 14, padding: "14px 18px", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⭐</span>
                  <span>
                    <span style={{ display: "block", fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.2 }}>{previewLabel}</span>
                    <span style={{ display: "block", fontSize: "0.72rem", color: "rgba(255,255,255,0.42)", marginTop: 2 }}>{previewSub}</span>
                  </span>
                </div>
              </div>
              {slug && (
                <p style={{ fontSize: "0.78rem", color: "var(--adm-text3)", margin: "10px 0 0" }}>
                  Aparecerá en{" "}
                  <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: "none" }}>
                    quierocomer.com/{slug}
                  </a>
                </p>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={handleSave} disabled={saving} style={{
        padding: "12px 28px",
        background: `linear-gradient(135deg, #ffc44f, ${GOLD})`,
        color: "#100b03", border: "none", borderRadius: 999,
        fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
        cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
      }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
