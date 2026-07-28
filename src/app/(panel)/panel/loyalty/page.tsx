"use client";

import { useState, useEffect, useCallback } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { CreditCard } from "lucide-react";
import LoyaltyNav from "./LoyaltyNav";

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

const DEFAULTS = {
  name: "Tarjeta de fidelidad",
  active: false,
  stampsRequired: 10,
  rewardText: "Un producto gratis",
  cardColorHex: "#111111",
  description: "",
};

interface LoyaltyProgram {
  name: string;
  active: boolean;
  stampsRequired: number;
  rewardText: string;
  cardColorHex: string;
  description: string | null;
}

export default function LoyaltyConfigPage() {
  const { restaurants, selectedRestaurantId, loading } = usePanelSession();

  const [form, setForm] = useState({ ...DEFAULTS });
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const restaurant = restaurants.find((r) => r.id === selectedRestaurantId);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoadingProgram(true);
    setSaved(false);
    setSaveError("");
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((data) => {
        const p: LoyaltyProgram | null = data.program;
        setForm(
          p
            ? {
                name: p.name,
                active: p.active,
                stampsRequired: p.stampsRequired,
                rewardText: p.rewardText,
                cardColorHex: p.cardColorHex,
                description: p.description || "",
              }
            : { ...DEFAULTS },
        );
      })
      .catch(() => setSaveError("No se pudo cargar la configuración."))
      .finally(() => setLoadingProgram(false));
  }, [selectedRestaurantId]);

  const update = useCallback((patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!selectedRestaurantId) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/loyalty/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, ...form }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      setSaved(true);
    } catch (e: any) {
      setSaveError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: F,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--adm-text)",
            margin: "0 0 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CreditCard size={20} color="var(--adm-text3)" /> Fidelidad
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Configura la tarjeta de sellos que tus clientes guardarán en Apple Wallet y Google Wallet.
        </p>
      </div>

      <LoyaltyNav />

      {loading || loadingProgram ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando configuración…</p>
      ) : (
        <div style={{ display: "grid", gap: 28, gridTemplateColumns: "minmax(0,1fr) 320px" }} className="loyalty-grid">
          {/* ── Formulario ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Activar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: 14,
                background: "var(--adm-card)",
                border: "1px solid var(--adm-card-border)",
                borderRadius: 12,
              }}
            >
              <div>
                <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>
                  Programa activo
                </p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                  Cuando esté activo, tus clientes podrán inscribirse y recibir su tarjeta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => update({ active: !form.active })}
                aria-pressed={form.active}
                style={{
                  position: "relative",
                  height: 26,
                  width: 46,
                  flexShrink: 0,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: form.active ? "#16a34a" : "var(--adm-card-border)",
                  transition: "background 0.15s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: form.active ? 23 : 3,
                    height: 20,
                    width: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.15s",
                  }}
                />
              </button>
            </div>

            {/* Nombre */}
            <div>
              <label style={labelStyle}>Nombre del programa</label>
              <input
                type="text"
                value={form.name}
                maxLength={80}
                onChange={(e) => update({ name: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* Sellos requeridos */}
            <div>
              <label style={labelStyle}>Sellos para ganar la recompensa</label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.stampsRequired}
                onChange={(e) => update({ stampsRequired: Number(e.target.value) })}
                style={{ ...inputStyle, width: 120 }}
              />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                Entre 1 y 50 sellos.
              </p>
            </div>

            {/* Recompensa */}
            <div>
              <label style={labelStyle}>Recompensa</label>
              <input
                type="text"
                value={form.rewardText}
                maxLength={120}
                placeholder="Ej: Un producto gratis"
                onChange={(e) => update({ rewardText: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* Descripción */}
            <div>
              <label style={labelStyle}>
                Descripción <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                value={form.description}
                maxLength={200}
                rows={2}
                placeholder="Ej: Válido de lunes a viernes."
                onChange={(e) => update({ description: e.target.value })}
                style={{ ...inputStyle, resize: "none" }}
              />
            </div>

            {/* Color */}
            <div>
              <label style={labelStyle}>Color de la tarjeta</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="color"
                  value={form.cardColorHex}
                  onChange={(e) => update({ cardColorHex: e.target.value })}
                  style={{
                    height: 40,
                    width: 56,
                    padding: 2,
                    cursor: "pointer",
                    borderRadius: 8,
                    border: "1px solid var(--adm-card-border)",
                    background: "var(--adm-card)",
                  }}
                />
                <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "var(--adm-text2)" }}>
                  {form.cardColorHex}
                </span>
              </div>
            </div>

            {/* Guardar */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 4 }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: `1.5px solid ${GOLD}`,
                  background: GOLD,
                  color: "#1a1a1a",
                  fontFamily: F,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              {saved && <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#16a34a" }}>✓ Guardado</span>}
              {saveError && <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#ef4444" }}>{saveError}</span>}
            </div>
          </div>

          {/* ── Vista previa ── */}
          <div style={{ height: "fit-content" }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Vista previa
            </p>
            <CardPreview
              color={form.cardColorHex}
              restaurantName={restaurant?.name || "Tu restaurante"}
              stampsRequired={form.stampsRequired}
              rewardText={form.rewardText}
              description={form.description}
            />
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Así se verá aproximadamente en el teléfono del cliente. Ejemplo con 3 sellos.
            </p>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 720px){ .loyalty-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function CardPreview({
  color,
  restaurantName,
  stampsRequired,
  rewardText,
  description,
}: {
  color: string;
  restaurantName: string;
  stampsRequired: number;
  rewardText: string;
  description: string;
}) {
  const demoStamps = Math.min(3, stampsRequired);
  const textColor = isLight(color) ? "#111111" : "#ffffff";
  const subColor = isLight(color) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";

  return (
    <div style={{ borderRadius: 18, padding: 20, background: color, color: textColor, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {restaurantName}
        </span>
        <span style={{ fontFamily: F, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.12em", color: subColor }}>
          Fidelidad
        </span>
      </div>

      <div style={{ fontFamily: F, fontSize: "0.62rem", color: subColor, margin: "24px 0 8px", letterSpacing: "0.1em" }}>SELLOS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {Array.from({ length: Math.max(stampsRequired, 1) }).map((_, i) => {
          const filled = i < demoStamps;
          return (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                fontSize: "0.8rem",
                border: `1.5px solid ${textColor}`,
                background: filled ? textColor : "transparent",
                color: filled ? color : textColor,
                opacity: filled ? 1 : 0.45,
              }}
            >
              {filled ? "★" : ""}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 22, borderTop: `1px solid ${subColor}`, paddingTop: 12 }}>
        <div style={{ fontFamily: F, fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.12em", color: subColor }}>
          Recompensa
        </div>
        <div style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, marginTop: 2 }}>{rewardText || "—"}</div>
        {description && <div style={{ fontFamily: FB, fontSize: "0.72rem", color: subColor, marginTop: 4 }}>{description}</div>}
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}
