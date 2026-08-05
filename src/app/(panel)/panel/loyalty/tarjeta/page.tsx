"use client";

import { useState, useEffect, useCallback } from "react";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { CreditCard, Plus, Trash2, ChevronDown, ChevronRight, Link2, Copy, QrCode, Clock } from "lucide-react";
import { toast } from "sonner";
import SubirFoto from "@/components/SubirFoto";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const STAMP_ICONS = [
  // Símbolos y varios
  "★", "⭐", "🍀", "☘️", "❤️", "🔥", "✨", "👑", "💎", "🎁",
  // Comida y bebida
  "☕", "🧋", "🍺", "🍷", "🥤", "🍕", "🍔", "🍟", "🌭", "🌮",
  "🌯", "🥟", "🍣", "🍤", "🍜", "🍩", "🍦", "🍰", "🍫", "🧁",
  "🥐", "🥗", "🍎", "🍪",
  // Animales
  "🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮",
  "🐷", "🐸", "🐵", "🐔", "🐧", "🦄", "🐢", "🐙", "🦋", "🐝",
  "🐬", "🐳", "🦈", "🦩",
];

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

interface RewardTier {
  stamp: number;
  reward: string;
}

interface FormState {
  name: string;
  active: boolean;
  stampGoal: number;
  stampIcon: string;
  rewards: RewardTier[];
  cardColorHex: string;
  stampColorHex: string;
  bgImageUrl: string;
  description: string;
  showGiftBadge: boolean;
  cardExpiryDays: number | null;
}

const DEFAULTS: FormState = {
  name: "Tarjeta de fidelidad",
  active: false,
  stampGoal: 8,
  stampIcon: "★",
  rewards: [],
  cardColorHex: "#111111",
  stampColorHex: "#FFFFFF",
  bgImageUrl: "",
  description: "",
  showGiftBadge: true,
  cardExpiryDays: null,
};

const EXPIRY_OPTIONS = [
  { label: "Sin vencimiento", value: null },
  { label: "30 días", value: 30 },
  { label: "60 días", value: 60 },
  { label: "90 días (3 meses)", value: 90 },
  { label: "180 días (6 meses)", value: 180 },
  { label: "365 días (1 año)", value: 365 },
];

export default function LoyaltyCardPage() {
  const { restaurants, selectedRestaurantId, loading } = usePanelSession();

  const [form, setForm] = useState<FormState>({ ...DEFAULTS });
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dishPhotos, setDishPhotos] = useState<{ name: string; url: string }[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [customExpiry, setCustomExpiry] = useState("");
  const [accentColor, setAccentColor] = useState<string>("#F4A623");
  const [colorMode, setColorMode] = useState<"LIGHT" | "DARK">("DARK");

  const restaurant = restaurants.find((r) => r.id === selectedRestaurantId);
  const isStore = (restaurant as any)?.profileType === "STORE";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const enrollUrl = restaurant?.slug ? `${baseUrl}/fidelidad/${restaurant.slug}` : "";

  // Fetch accent color from restaurant settings
  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/admin/locales/${selectedRestaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setAccentColor(d?.cartaAccentColor || "#F4A623");
        setColorMode(d?.cartaColorMode === "LIGHT" ? "LIGHT" : "DARK");
      })
      .catch(() => {});
  }, [selectedRestaurantId]);

  // Fotos de platos para elegir fondo de la tarjeta
  useEffect(() => {
    if (!selectedRestaurantId) return;
    fetch(`/api/loyalty/dish-photos?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((d) => setDishPhotos(Array.isArray(d.photos) ? d.photos : []))
      .catch(() => setDishPhotos([]));
  }, [selectedRestaurantId]);

  // QR de inscripción
  useEffect(() => {
    if (!enrollUrl) return;
    import("qrcode").then((mod) =>
      mod.default.toDataURL(enrollUrl, { width: 300, margin: 2, errorCorrectionLevel: "H", color: { dark: "#1a1a1a", light: "#ffffff" } })
        .then(setQrDataUrl)
    ).catch(() => {});
  }, [enrollUrl]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setLoadingProgram(true);
    setSaved(false);
    setSaveError("");
    fetch(`/api/loyalty/program?restaurantId=${selectedRestaurantId}`)
      .then((r) => r.json())
      .then((data) => {
        const p = data.program;
        setForm(
          p
            ? {
                name: p.name,
                active: p.active,
                stampGoal: p.stampGoal,
                stampIcon: p.stampIcon || "★",
                rewards: Array.isArray(p.rewards) ? p.rewards : [],
                cardColorHex: p.cardColorHex,
                stampColorHex: p.stampColorHex || "#FFFFFF",
                bgImageUrl: p.bgImageUrl || "",
                description: p.description || "",
                showGiftBadge: p.showGiftBadge !== false,
                cardExpiryDays: p.cardExpiryDays ?? null,
              }
            : { ...DEFAULTS },
        );
      })
      .catch(() => setSaveError("No se pudo cargar la configuración."))
      .finally(() => setLoadingProgram(false));
  }, [selectedRestaurantId]);

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }, []);

  // ── Niveles de recompensa ──
  const addTier = () => {
    const used = new Set(form.rewards.map((r) => r.stamp));
    let next = 1;
    while (used.has(next) && next < form.stampGoal) next++;
    if (used.has(next)) next = form.stampGoal;
    update({ rewards: [...form.rewards, { stamp: Math.min(next, form.stampGoal), reward: "" }] });
  };
  const updateTier = (i: number, patch: Partial<RewardTier>) => {
    update({ rewards: form.rewards.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  };
  const removeTier = (i: number) => update({ rewards: form.rewards.filter((_, idx) => idx !== i) });

  const handleSave = async () => {
    if (!selectedRestaurantId) return;
    const cleanRewards = form.rewards
      .filter((r) => r.reward.trim() && r.stamp >= 1 && r.stamp <= form.stampGoal)
      .map((r) => ({ stamp: Number(r.stamp), reward: r.reward.trim() }));

    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/loyalty/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId, ...form, rewards: cleanRewards, showGiftBadge: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      const d = await res.json();
      if (d.program?.rewards) update({ rewards: d.program.rewards });

      // Actualizar todos los pases instalados automáticamente
      const refreshRes = await fetch("/api/loyalty/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurantId }),
      });
      const rd = await refreshRes.json();
      const devCount = (rd.appleDevices || 0) + (rd.google || 0);
      if (devCount > 0) {
        toast.success(`Guardado · diseño enviado a ${devCount} tarjeta${devCount === 1 ? "" : "s"}`);
      } else {
        setSaved(true);
      }
    } catch (e: any) {
      setSaveError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={20} color="var(--adm-text3)" /> Tarjeta de fidelización
        </h1>
        <p style={{ fontFamily: FB, fontSize: "0.88rem", color: "var(--adm-text2)", margin: 0, lineHeight: 1.5 }}>
          Configura la tarjeta de sellos que tus clientes guardarán en Apple Wallet y Google Wallet.
        </p>
      </div>

      {loading || loadingProgram ? (
        <p style={{ fontFamily: FB, color: "var(--adm-text3)", fontSize: "0.85rem" }}>Cargando configuración…</p>
      ) : (
        <div style={{ display: "grid", gap: 28, gridTemplateColumns: "minmax(0,1fr) 320px" }} className="loyalty-grid">
          {/* ── Formulario ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Activar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 14, background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>Programa activo</p>
                <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>
                  Cuando esté activo, tus clientes podrán inscribirse y recibir su tarjeta.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const newActive = !form.active;
                  update({ active: newActive });
                  if (!selectedRestaurantId) return;
                  try {
                    const res = await fetch("/api/loyalty/program", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ restaurantId: selectedRestaurantId, ...form, active: newActive, showGiftBadge: true }),
                    });
                    if (!res.ok) throw new Error();
                    setSaved(true);
                  } catch {
                    update({ active: !newActive });
                    toast.error("Error al guardar");
                  }
                }}
                aria-pressed={form.active}
                style={{ position: "relative", height: 26, width: 46, flexShrink: 0, borderRadius: 999, border: "none", cursor: "pointer", background: form.active ? "#16a34a" : "var(--adm-card-border)", transition: "background 0.15s" }}
              >
                <span style={{ position: "absolute", top: 3, left: form.active ? 23 : 3, height: 20, width: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
              </button>
            </div>

            {/* Link de inscripción + QR — solo restaurantes (STORE lo tiene en el dashboard) */}
            {!isStore && enrollUrl && (
              <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                  <Link2 size={14} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
                  <input readOnly value={enrollUrl} onFocus={(e) => e.target.select()} style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: "0.78rem", border: "none", background: "transparent", color: "var(--adm-text2)", minWidth: 0 }} />
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(enrollUrl); toast.success("Link copiado"); }} title="Copiar link" style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontFamily: F, fontWeight: 600 }}>
                    <Copy size={12} /> Copiar
                  </button>
                  <a href={enrollUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 6, border: `1px solid ${GOLD}40`, color: GOLD, fontSize: "0.75rem", fontFamily: F, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                    Ver →
                  </a>
                </div>
                <div style={{ borderTop: "1px solid var(--adm-card-border)" }}>
                  <button
                    type="button"
                    onClick={() => setShowQr((s) => !s)}
                    style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--adm-text2)", fontFamily: F, fontSize: "0.75rem", fontWeight: 600 }}
                  >
                    <QrCode size={13} />
                    {showQr ? "Ocultar QR de inscripción" : "Ver QR de inscripción"}
                    {showQr ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  {showQr && qrDataUrl && (
                    <div style={{ padding: "0 12px 14px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ background: "#fff", padding: 8, borderRadius: 10, border: "1px solid var(--adm-card-border)", flexShrink: 0 }}>
                        <img src={qrDataUrl} alt="QR inscripción" width={110} height={110} style={{ display: "block" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", lineHeight: 1.5 }}>
                          Imprime este QR y ponlo en tus mesas o mostrador. El cliente lo escanea y la tarjeta queda en su teléfono.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const win = window.open("", "_blank");
                            if (!win) return;
                            win.document.write(`<!DOCTYPE html><html><head><title>QR Fidelización</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px;padding:32px}img{width:260px;height:260px}p{font-size:14px;color:#555;margin:0}@media print{button{display:none}}</style></head><body><img src="${qrDataUrl}" /><p>${enrollUrl}</p><button onclick="window.print()">Imprimir</button></body></html>`);
                            win.document.close();
                          }}
                          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${GOLD}50`, background: `${GOLD}15`, color: GOLD, fontFamily: F, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                        >
                          🖨️ Imprimir QR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Nombre */}
            <div>
              <label style={labelStyle}>Nombre del programa</label>
              <input type="text" value={form.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} style={inputStyle} />
            </div>

            {/* Cantidad de sellos */}
            <div>
              <label style={labelStyle}>Cantidad de sellos de la tarjeta</label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.stampGoal}
                onChange={(e) => update({ stampGoal: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                style={{ ...inputStyle, width: 120 }}
              />
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "6px 0 0" }}>
                Cuántos espacios de sello tiene la tarjeta (entre 1 y 50).
              </p>
            </div>

            {/* Niveles de recompensa */}
            <div>
              <label style={labelStyle}>Recompensas por nivel</label>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "-2px 0 10px" }}>
                Define qué gana el cliente al llegar a cierto número de sellos. Puedes poner varias (ej: sello 3 y sello {form.stampGoal}).
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.rewards.map((tier, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>Al sello</span>
                      <select
                        value={tier.stamp}
                        onChange={(e) => updateTier(i, { stamp: Number(e.target.value) })}
                        style={{ ...inputStyle, width: 64, padding: "8px 6px" }}
                      >
                        {Array.from({ length: form.stampGoal }, (_, k) => k + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={tier.reward}
                      maxLength={120}
                      placeholder="Ej: Un café gratis"
                      onChange={(e) => updateTier(i, { reward: e.target.value })}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      title="Quitar nivel"
                      style={{ height: 38, width: 38, flexShrink: 0, borderRadius: 8, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTier}
                  style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: "8px 12px", borderRadius: 8, border: "1px dashed var(--adm-card-border)", background: "transparent", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                >
                  <Plus size={14} /> Agregar recompensa
                </button>
              </div>
            </div>

            {/* Condiciones (pie de tarjeta) */}
            <div>
              <label style={labelStyle}>Condiciones <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(se muestran al pie de la tarjeta)</span></label>
              <textarea
                value={form.description}
                maxLength={300}
                rows={2}
                placeholder="Ej: Válido de lunes a viernes. No acumulable con otras promociones."
                onChange={(e) => update({ description: e.target.value })}
                style={{ ...inputStyle, resize: "none" }}
              />
            </div>

            {/* Vencimiento de tarjeta */}
            <div style={{ padding: "14px 16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Clock size={15} color="var(--adm-text3)" />
                <label style={{ ...labelStyle, margin: 0 }}>Vencimiento de la tarjeta</label>
              </div>
              <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 10px", lineHeight: 1.5 }}>
                Si el cliente no usa la tarjeta durante este período, quedará expirada. Útil para mantener el programa activo.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={EXPIRY_OPTIONS.some(o => o.value === form.cardExpiryDays) ? (form.cardExpiryDays ?? "") : "custom"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { update({ cardExpiryDays: null }); setCustomExpiry(""); }
                    else if (v === "custom") { setCustomExpiry(String(form.cardExpiryDays ?? "")); }
                    else { update({ cardExpiryDays: Number(v) }); setCustomExpiry(""); }
                  }}
                  style={{ ...inputStyle, width: "auto", minWidth: 180 }}
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.value ?? "none"} value={o.value ?? ""}>{o.label}</option>
                  ))}
                  <option value="custom">Personalizado…</option>
                </select>
                {(!EXPIRY_OPTIONS.some(o => o.value === form.cardExpiryDays) && form.cardExpiryDays !== null) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      min={7}
                      max={3650}
                      value={customExpiry || form.cardExpiryDays || ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setCustomExpiry(e.target.value);
                        if (n >= 7 && n <= 3650) update({ cardExpiryDays: n });
                      }}
                      style={{ ...inputStyle, width: 80 }}
                    />
                    <span style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text3)" }}>días</span>
                  </div>
                )}
              </div>
            </div>

            {/* Icono del sello — colapsable */}
            <div>
              <button
                type="button"
                onClick={() => setShowIcons((s) => !s)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 8, borderRadius: 10, cursor: "pointer", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 600 }}
              >
                <span style={{ height: 38, width: 38, borderRadius: 8, flexShrink: 0, background: "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: form.stampIcon === "logo" ? "0.58rem" : "1.2rem" }}>
                  {form.stampIcon === "logo" && restaurant?.logoUrl
                    ? <img src={restaurant.logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover" }} />
                    : form.stampIcon}
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>Icono del sello</span>
                {showIcons ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {showIcons && (
                <div style={{ marginTop: 8, padding: "12px", borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {restaurant?.logoUrl && (
                      <button
                        type="button"
                        onClick={() => update({ stampIcon: "logo" })}
                        title="Usar el logo del restaurante"
                        style={{
                          height: 42, minWidth: 42, padding: "0 8px", borderRadius: 10, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 6,
                          background: form.stampIcon === "logo" ? "rgba(244,166,35,0.14)" : "var(--adm-hover)",
                          border: `1.5px solid ${form.stampIcon === "logo" ? GOLD : "var(--adm-card-border)"}`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={restaurant.logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover" }} />
                        <span style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text2)" }}>Logo</span>
                      </button>
                    )}
                    {STAMP_ICONS.map((icon) => {
                      const active = form.stampIcon === icon;
                      return (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => update({ stampIcon: icon })}
                          style={{
                            height: 42, width: 42, borderRadius: 10, fontSize: "1.2rem", cursor: "pointer",
                            background: active ? "rgba(244,166,35,0.14)" : "var(--adm-hover)",
                            border: `1.5px solid ${active ? GOLD : "var(--adm-card-border)"}`,
                          }}
                        >
                          {icon}
                        </button>
                      );
                    })}
                    <input
                      type="text"
                      value={form.stampIcon}
                      onChange={(e) => update({ stampIcon: [...e.target.value.trim()][0] || "★" })}
                      title="O escribe tu propio símbolo/emoji"
                      style={{ ...inputStyle, width: 60, textAlign: "center", fontSize: "1.1rem" }}
                    />
                  </div>
                </div>
              )}
            </div>


            {/* Color de la tarjeta en Wallet (Apple/Google Wallet — fondo sólido en el celular) */}
            <div style={{ padding: "14px 16px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12 }}>
              <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Color de la tarjeta en el celular</p>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 12px", lineHeight: 1.45 }}>
                Fondo sólido que se ve en Apple Wallet y Google Wallet. No afecta la página de inscripción.
              </p>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div>
                  <label style={labelStyle}>Color de fondo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input type="color" value={form.cardColorHex} onChange={(e) => update({ cardColorHex: e.target.value })} style={{ height: 40, width: 56, padding: 2, cursor: "pointer", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)" }} />
                    <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "var(--adm-text2)" }}>{form.cardColorHex}</span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Color de los sellos</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input type="color" value={form.stampColorHex} onChange={(e) => update({ stampColorHex: e.target.value })} style={{ height: 40, width: 56, padding: 2, cursor: "pointer", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)" }} />
                    <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "var(--adm-text2)" }}>{form.stampColorHex}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Imagen de fondo */}
            <div>
              <label style={labelStyle}>Imagen de fondo <span style={{ color: "var(--adm-text3)", fontWeight: 400 }}>(opcional)</span></label>
              {/* STORE: siempre puede subir foto */}
              {isStore ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {form.bgImageUrl && (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.bgImageUrl} alt="Fondo" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: "1px solid var(--adm-card-border)", display: "block" }} />
                      <button type="button" onClick={() => update({ bgImageUrl: "" })} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>×</button>
                    </div>
                  )}
                  <SubirFoto
                    folder="loyalty-bg"
                    label={form.bgImageUrl ? "Cambiar imagen" : "Subir imagen de fondo"}
                    height="40px"
                    onUpload={(url: string) => update({ bgImageUrl: url })}
                  />
                </div>
              ) : dishPhotos.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {form.bgImageUrl && (
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.bgImageUrl} alt="Fondo" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: "1px solid var(--adm-card-border)", display: "block" }} />
                      <button type="button" onClick={() => update({ bgImageUrl: "" })} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>×</button>
                    </div>
                  )}
                  <SubirFoto
                    folder="loyalty-bg"
                    label={form.bgImageUrl ? "Cambiar imagen" : "Subir imagen de fondo"}
                    height="40px"
                    onUpload={(url: string) => update({ bgImageUrl: url })}
                  />
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPhotos((s) => !s)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 8, borderRadius: 10, cursor: "pointer", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.82rem", fontWeight: 600 }}
                  >
                    <span style={{ height: 38, width: 38, borderRadius: 8, flexShrink: 0, background: form.bgImageUrl ? `center/cover url(${form.bgImageUrl})` : "var(--adm-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", color: "var(--adm-text3)" }}>
                      {!form.bgImageUrl && "Sin"}
                    </span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      {form.bgImageUrl ? "Imagen seleccionada" : "Elegir una foto de fondo"}
                    </span>
                    <ChevronDown size={16} style={{ transform: showPhotos ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </button>

                  {showPhotos && (
                    <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", padding: 10, borderRadius: 10, border: "1px solid var(--adm-card-border)", background: "var(--adm-card)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: 8 }}>
                      <button type="button" onClick={() => update({ bgImageUrl: "" })} title="Sin imagen de fondo" style={{ aspectRatio: "1", borderRadius: 8, cursor: "pointer", background: "var(--adm-hover)", border: `2px solid ${!form.bgImageUrl ? GOLD : "var(--adm-card-border)"}`, color: "var(--adm-text3)", fontFamily: F, fontSize: "0.6rem", fontWeight: 600 }}>
                        Ninguna
                      </button>
                      {dishPhotos.map((ph) => {
                        const active = form.bgImageUrl === ph.url;
                        return (
                          <button key={ph.url} type="button" onClick={() => update({ bgImageUrl: ph.url })} title={ph.name} style={{ aspectRatio: "1", borderRadius: 8, cursor: "pointer", padding: 0, overflow: "hidden", border: `2px solid ${active ? GOLD : "var(--adm-card-border)"}`, backgroundImage: `url(${ph.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Guardar */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 4 }}>
              <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${GOLD}`, background: GOLD, color: "#1a1a1a", fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              {saved && <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#16a34a" }}>✓ Guardado</span>}
              {saveError && <span style={{ fontFamily: F, fontSize: "0.8rem", color: "#ef4444" }}>{saveError}</span>}
            </div>

          </div>

          {/* ── Vista previa ── */}
          <div style={{ height: "fit-content" }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 600, color: "var(--adm-text3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vista previa</p>
            <CardPreview
              color={form.cardColorHex}
              stampColor={form.stampColorHex}
              bgImage={form.bgImageUrl}
              logoUrl={restaurant?.logoUrl || ""}
              restaurantName={restaurant?.name || "Tu restaurante"}
              programName={form.name}
              stampGoal={form.stampGoal}
              stampIcon={form.stampIcon}
              rewards={form.rewards}
              description={form.description}
            />
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Así se verá aproximadamente en el teléfono del cliente. Ejemplo con algunos sellos.
            </p>
          </div>
        </div>
      )}


      <style>{`@media (max-width: 760px){ .loyalty-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// Vista previa — muestra el fondo sólido del Wallet (Apple/Google), no la página de inscripción
function CardPreview({ color, stampColor, bgImage, logoUrl, restaurantName, programName, stampGoal, stampIcon, rewards, description }: {
  color: string;
  stampColor: string;
  bgImage: string;
  logoUrl: string;
  restaurantName: string;
  programName: string;
  stampGoal: number;
  stampIcon: string;
  rewards: RewardTier[];
  description: string;
}) {
  const bgIsLight = isLight(color);
  const textColor = bgIsLight ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.92)";
  const subTextColor = bgIsLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
  const iconText = stampIcon === "logo" ? "★" : stampIcon;
  const rewardStamps = new Set(rewards.map((r) => r.stamp));
  const cols = stampGoal <= 6 ? stampGoal : stampGoal <= 8 ? 4 : stampGoal <= 10 ? 5 : 6;
  const stampFontSize = cols <= 4 ? "1.1rem" : cols <= 5 ? "1rem" : "0.9rem";
  const stampNumFontSize = cols <= 4 ? "0.7rem" : cols <= 5 ? "0.65rem" : "0.6rem";
  const sortedRewards = [...rewards].filter((r) => r.reward.trim()).sort((a, b) => a.stamp - b.stamp);
  const stampOnColor = isLight(stampColor) ? "#111" : "#fff";

  return (
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid var(--adm-card-border)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      background: color,
      backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      position: "relative",
    }}>
      {/* Overlay oscuro si hay imagen de fondo */}
      {bgImage && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 0 }} />
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "18px 16px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${bgImage ? "rgba(255,255,255,0.4)" : (bgIsLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.25)")}` }} />
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: bgImage ? "rgba(255,255,255,0.7)" : subTextColor }}>{restaurantName}</p>
            <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: bgImage ? "#fff" : textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{programName || "Tarjeta de premios"}</p>
          </div>
        </div>

        {/* Grid de sellos */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, marginBottom: sortedRewards.length > 0 ? 14 : 0 }}>
          {Array.from({ length: stampGoal }).map((_, i) => {
            const num = i + 1;
            const isReward = rewardStamps.has(num);
            const isFilled = i < 1;
            const cellBg = isFilled ? stampColor : isReward ? `${stampColor}35` : `${stampColor}15`;
            const cellColor = isFilled ? stampOnColor : (bgImage ? "rgba(255,255,255,0.55)" : (bgIsLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45))"));
            return (
              <div key={i} style={{
                aspectRatio: "1", borderRadius: "50%",
                background: cellBg,
                border: `1.5px solid ${isFilled ? stampColor : `${stampColor}50`}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isFilled ? stampFontSize : isReward ? "0.85rem" : stampFontSize,
                color: isFilled ? stampOnColor : cellColor,
                fontWeight: 900,
              }}>
                {isFilled ? iconText : isReward ? "🎁" : <span style={{ fontSize: stampNumFontSize, opacity: 0.6 }}>{num}</span>}
              </div>
            );
          })}
        </div>

        {/* Recompensas */}
        {sortedRewards.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: description ? 10 : 0 }}>
            {sortedRewards.map((r) => (
              <div key={r.stamp} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: bgImage ? "rgba(0,0,0,0.3)" : (bgIsLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"),
                borderRadius: 8, padding: "6px 8px",
                border: `1px solid ${bgImage ? "rgba(255,255,255,0.15)" : (bgIsLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)")}`,
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 900, color: bgImage ? "rgba(255,255,255,0.7)" : subTextColor, flexShrink: 0 }}>×{r.stamp}</span>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.75rem", color: bgImage ? "#fff" : textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reward}</p>
              </div>
            ))}
          </div>
        )}

        {description && (
          <p style={{ margin: 0, fontSize: "0.62rem", color: bgImage ? "rgba(255,255,255,0.5)" : subTextColor, lineHeight: 1.4 }}>{description}</p>
        )}
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
