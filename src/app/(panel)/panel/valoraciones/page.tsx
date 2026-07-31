"use client";
import { useState, useEffect } from "react";
import { Star, ExternalLink, Gift, Eye } from "lucide-react";
import { toast } from "sonner";
import { usePanelLang } from "@/lib/i18n/panel";

const GOLD = "#F4A623";

export default function ValoracionesPage() {
  const { t } = usePanelLang();
  const [rid, setRid] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");
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
        setGoogleUrl(r.googleReviewUrl || "");
        setReward(r.reviewReward || "");
        setHasReward(!!r.reviewReward);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!rid) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/valoraciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: rid,
          googleReviewUrl: googleUrl.trim() || null,
          reviewReward: hasReward && reward.trim() ? reward.trim() : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Guardado");
    } catch {
      toast.error("Error al guardar");
    }
    setSaving(false);
  };

  // Preview button styles
  const previewBtn = {
    display: "flex", alignItems: "center", gap: 14,
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)",
    borderRadius: 14, padding: "14px 18px", color: "#fff",
    fontFamily: "system-ui, sans-serif",
  } as const;

  if (loading) return null;

  return (
    <div style={{ padding: "24px 16px", maxWidth: 720, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700,
        color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <Star size={20} color="var(--adm-text3)" /> Valoraciones
      </h1>
      <p style={{ fontSize: "0.92rem", color: "var(--adm-text2)", margin: "0 0 28px" }}>
        Muestra un botón en tu página para que los clientes te dejen una reseña en Google.
        Opcionalmente, ofrece un premio para incentivarlos.
      </p>

      {/* Link de Google */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 22, padding: "22px 20px", marginBottom: 12,
      }}>
        <h2 style={{
          fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
          color: "var(--adm-text3)", margin: "0 0 10px",
          textTransform: "uppercase", letterSpacing: ".6px",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <ExternalLink size={13} /> Link de Google Reviews
        </h2>
        <p style={{ fontSize: "0.82rem", color: "var(--adm-text2)", margin: "0 0 12px" }}>
          Abre Google Maps, busca tu local, ve a <strong>Reseñas</strong> → <strong>Escribir una reseña</strong> y copia el link del navegador.
        </p>
        <input
          value={googleUrl}
          onChange={e => setGoogleUrl(e.target.value)}
          placeholder="https://maps.google.com/..."
          style={{
            width: "100%", padding: "12px 14px", boxSizing: "border-box",
            background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)",
            borderRadius: 12, color: "var(--adm-text)", fontFamily: "var(--font-body)", fontSize: "0.85rem",
            outline: "none",
          }}
        />
      </div>

      {/* Premio */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
        borderRadius: 22, padding: "22px 20px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasReward ? 14 : 0 }}>
          <div>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
              color: "var(--adm-text3)", margin: "0 0 3px",
              textTransform: "uppercase", letterSpacing: ".6px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Gift size={13} /> Ofrecer un premio
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--adm-text2)", margin: 0 }}>
              {hasReward ? "El botón dirá «Comenta y gana»" : "El botón dirá «Déjanos una reseña»"}
            </p>
          </div>
          <button
            onClick={() => setHasReward(v => !v)}
            style={{
              width: 44, height: 24, borderRadius: 999,
              background: hasReward ? GOLD : "var(--adm-card-border)",
              border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
              transition: "background .2s",
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: hasReward ? 22 : 2,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              transition: "left .2s",
            }} />
          </button>
        </div>
        {hasReward && (
          <input
            value={reward}
            onChange={e => setReward(e.target.value)}
            placeholder="Ej: Un café gratis en tu próxima visita"
            style={{
              width: "100%", padding: "12px 14px", boxSizing: "border-box",
              background: "rgba(255,255,255,.04)", border: "1px solid var(--adm-card-border)",
              borderRadius: 12, color: "var(--adm-text)", fontFamily: "var(--font-body)", fontSize: "0.85rem",
              outline: "none",
            }}
          />
        )}
      </div>

      {/* Vista previa */}
      {googleUrl.trim() && (
        <div style={{
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
          borderRadius: 22, padding: "22px 20px", marginBottom: 16,
        }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 800,
            color: "var(--adm-text3)", margin: "0 0 14px",
            textTransform: "uppercase", letterSpacing: ".6px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Eye size={13} /> Vista previa en tu página
          </h2>
          <div style={{ background: "#111", borderRadius: 14, padding: "14px 12px" }}>
            <div style={previewBtn}>
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⭐</span>
              <span>
                <span style={{ display: "block", fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.2 }}>
                  {hasReward && reward.trim() ? "Comenta y gana" : "Déjanos una reseña"}
                </span>
                <span style={{ display: "block", fontSize: "0.72rem", color: "rgba(255,255,255,0.42)", marginTop: 2 }}>
                  {hasReward && reward.trim() ? reward.trim() : "Nos ayuda mucho en Google"}
                </span>
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

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "12px 28px",
          background: `linear-gradient(135deg, #ffc44f, ${GOLD})`,
          color: "#100b03", border: "none", borderRadius: 999,
          fontFamily: "var(--font-display)", fontSize: "0.88rem", fontWeight: 700,
          cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
