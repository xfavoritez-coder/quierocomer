"use client";
import { useState, useEffect, useCallback } from "react";
import { Settings, Moon, Sun, Camera, ExternalLink, Copy, Palette } from "lucide-react";
import SubirFoto from "@/components/SubirFoto";
import AddressPicker from "@/components/admin/AddressPicker";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const ACCENT_OPTIONS = [
  { value: null,      label: "Amber",   color: "#F4A623" },
  { value: "#ef4444", label: "Rojo",    color: "#ef4444" },
  { value: "#22c55e", label: "Verde",   color: "#22c55e" },
  { value: "#3b82f6", label: "Azul",    color: "#3b82f6" },
  { value: "#a855f7", label: "Morado",  color: "#a855f7" },
  { value: "#ec4899", label: "Rosa",    color: "#ec4899" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500,
};

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
        background: active ? GOLD : "var(--adm-toggle-off)",
        boxShadow: active ? "0 0 8px rgba(244,166,35,0.3)" : "none",
        transition: "all 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 3,
        left: active ? 23 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)", pointerEvents: "none",
      }} />
    </button>
  );
}

export default function ConfiguracionGeneralPage() {
  const { selectedRestaurantId, restaurants } = useAdminSession();
  const selectedRestaurant = restaurants?.find((r: any) => r.id === selectedRestaurantId);
  const { lang, setLang, t } = usePanelLang();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [infoName, setInfoName] = useState("");
  const [infoLogoUrl, setInfoLogoUrl] = useState("");
  const [infoDietType, setInfoDietType] = useState("OMNIVORE");
  const [infoAddress, setInfoAddress] = useState("");
  const [infoLat, setInfoLat] = useState<number | null>(null);
  const [infoLng, setInfoLng] = useState<number | null>(null);
  const [infoPhone, setInfoPhone] = useState("");
  const [infoWhatsapp, setInfoWhatsapp] = useState("");
  const [infoSlug, setInfoSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [panelTheme, setPanelTheme] = useState("light");
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("#F4A623");
  const [customDirty, setCustomDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setPanelTheme(localStorage.getItem("qc_panel_theme") || "light"); }, []);

  const rid = selectedRestaurantId;

  const fetchData = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setInfoName(d.name || "");
      setInfoLogoUrl(d.logoUrl || "");
      setInfoDietType(d.dietType || "OMNIVORE");
      setInfoAddress(d.address || "");
      setInfoLat(d.lat ?? null);
      setInfoLng(d.lng ?? null);
      setInfoPhone(d.phone || "");
      setInfoWhatsapp(d.whatsapp || "");
      setInfoSlug(d.slug || "");
      setSlugInput(d.slug || "");
      setAccentColor(d.cartaAccentColor || null);
      setLoaded(true);
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trackSetting = (action: string, details: Record<string, any>) => {
    if (!rid) return;
    fetch("/api/panel/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: rid, action, details }),
    }).catch(() => {});
  };

  const save = async (fields: Record<string, any>) => {
    if (!rid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        trackSetting("settings_change", fields);
        toast.success(t("saved"));
      } else {
        const err = await res.json();
        toast.error(err.error || t("save_error"));
      }
    } catch { toast.error(t("save_error")); }
    setSaving(false);
  };

  if (loading) return <SkeletonLoading type="form" />;
  if (!loaded || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>{t("select_restaurant")}</p></div>;

  const slug = infoSlug || (selectedRestaurant as any)?.slug;
  const landingUrl = slug ? `https://quierocomer.com/${slug}` : null;

  const saveSlug = async () => {
    const newSlug = slugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!newSlug || newSlug === infoSlug) return;
    setSlugSaving(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug }),
      });
      if (res.ok) {
        setInfoSlug(newSlug);
        setSlugInput(newSlug);
        toast.success("Link actualizado");
      } else {
        const err = await res.json();
        toast.error(err.error || "Ese link ya está en uso");
        setSlugInput(infoSlug);
      }
    } catch { toast.error("Error al guardar"); setSlugInput(infoSlug); }
    setSlugSaving(false);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
        <Settings size={20} color="var(--adm-text3)" /> Configuración General
      </h1>

      {/* ── Página del local ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "16px 20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <p style={{ fontFamily: F, fontSize: "0.72rem", fontWeight: 800, color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Página del local</p>
        {landingUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <a href={landingUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontFamily: "monospace", fontSize: "0.82rem", color: GOLD, background: `${GOLD}12`, padding: "8px 12px", borderRadius: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
              {landingUrl}
            </a>
            <button onClick={() => { navigator.clipboard.writeText(landingUrl); toast.success("Copiado"); }} title="Copiar link"
              style={{ width: 34, height: 34, borderRadius: 8, background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Copy size={15} color="var(--adm-text3)" />
            </button>
            <a href={landingUrl} target="_blank" rel="noopener noreferrer"
              style={{ width: 34, height: 34, borderRadius: 8, background: "var(--adm-input)", border: "1px solid var(--adm-card-border)", display: "grid", placeItems: "center", textDecoration: "none", flexShrink: 0 }}>
              <ExternalLink size={15} color="var(--adm-text3)" />
            </a>
          </div>
        )}
        <label style={labelStyle}>Personalizar link</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 8, overflow: "hidden" }}>
            <span style={{ padding: "10px 10px 10px 14px", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--adm-text3)", whiteSpace: "nowrap" }}>quierocomer.com/</span>
            <input
              value={slugInput}
              onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              onBlur={saveSlug}
              onKeyDown={e => e.key === "Enter" && saveSlug()}
              placeholder="mi-local"
              style={{ flex: 1, padding: "10px 12px 10px 0", background: "none", border: "none", fontFamily: "monospace", fontSize: "0.85rem", color: "var(--adm-text)", outline: "none" }}
            />
          </div>
          <button onClick={saveSlug} disabled={slugSaving || slugInput.trim() === infoSlug}
            style={{ padding: "10px 16px", background: GOLD, color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: slugSaving || slugInput.trim() === infoSlug ? "default" : "pointer", opacity: slugInput.trim() === infoSlug ? 0.4 : 1 }}>
            {slugSaving ? "..." : "Guardar"}
          </button>
        </div>
        <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>
          Si cambias el link, actualiza los QR impresos — el link anterior dejará de funcionar.
        </p>
      </div>

      {/* ── Información básica ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <Camera size={18} color={GOLD} /> Información básica
        </h3>
        {/* Logo */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {infoLogoUrl ? (
              <img src={infoLogoUrl} alt="Logo" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${GOLD}` }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--adm-input)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed var(--adm-card-border)" }}>
                <Camera size={20} color="var(--adm-text3)" />
              </div>
            )}
            <SubirFoto folder="logos" label="Cambiar logo" circular height="64px" onUpload={(url: string) => { setInfoLogoUrl(url); save({ logoUrl: url }); }} />
          </div>
        </div>
        {/* Nombre */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nombre del local</label>
          <input value={infoName} onChange={e => setInfoName(e.target.value)} style={inputStyle} placeholder="Nombre del restaurant" />
        </div>
        {/* Tipo de cocina */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Tipo de cocina</label>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { value: "OMNIVORE", label: "Omnívoro", icon: "🍽️" },
              { value: "VEGETARIAN", label: "Vegetariano", icon: "🥗" },
              { value: "VEGAN", label: "Vegano", icon: "🌿" },
            ] as const).map(opt => {
              const active = infoDietType === opt.value;
              return (
                <button key={opt.value} onClick={() => setInfoDietType(opt.value)} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                  background: active ? "rgba(244,166,35,0.12)" : "var(--adm-input)",
                  border: active ? "1px solid rgba(244,166,35,0.3)" : "1px solid transparent",
                  color: active ? GOLD : "var(--adm-text3)",
                  fontFamily: F, fontSize: "0.78rem", fontWeight: active ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}>
                  <span style={{ fontSize: "0.9rem" }}>{opt.icon}</span> {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Dirección */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Dirección</label>
          <AddressPicker
            address={infoAddress}
            lat={infoLat}
            lng={infoLng}
            onChange={(a, la, ln) => { setInfoAddress(a); setInfoLat(la); setInfoLng(ln); }}
          />
        </div>
        {/* Teléfono y WhatsApp */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input value={infoPhone} onChange={e => setInfoPhone(e.target.value)} style={inputStyle} placeholder="+56 9 1234 5678" />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input value={infoWhatsapp} onChange={e => setInfoWhatsapp(e.target.value)} style={inputStyle} placeholder="+56 9 1234 5678" />
          </div>
        </div>
        <button
          onClick={() => save({ name: infoName, dietType: infoDietType, address: infoAddress || null, lat: infoLat, lng: infoLng, phone: infoPhone || null, whatsapp: infoWhatsapp || null, logoUrl: infoLogoUrl || null })}
          disabled={saving}
          style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
        >
          {saving ? "Guardando..." : "Guardar información"}
        </button>
      </div>

      {/* ── Color del local ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
          <Palette size={16} color="var(--adm-text3)" /> Color del local
        </h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>
          Se aplica en la tarjeta de premios, pedidos online y otros elementos de tu marca.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {ACCENT_OPTIONS.map((opt) => {
            const isActive = (accentColor || null) === opt.value;
            return (
              <button key={opt.label} onClick={() => { setAccentColor(opt.value); setCustomDirty(false); save({ cartaAccentColor: opt.value }); }} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                background: isActive ? "var(--adm-hover)" : "none", border: "none", cursor: "pointer",
                padding: "8px 4px", borderRadius: 12, transition: "all 0.2s",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: opt.color, border: isActive ? "3px solid var(--adm-text)" : "3px solid transparent", boxShadow: isActive ? `0 0 0 2px ${opt.color}40` : "none", transition: "all 0.2s" }} />
                <span style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: isActive ? 700 : 500, color: isActive ? "var(--adm-text)" : "var(--adm-text3)" }}>{opt.label}</span>
              </button>
            );
          })}
          {/* Custom */}
          {(() => {
            const customActive = accentColor && !ACCENT_OPTIONS.some(o => o.value === accentColor);
            const displayColor = customDirty ? customColor : (customActive ? accentColor! : customColor);
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", borderRadius: 12, background: (customActive || customDirty) ? "var(--adm-hover)" : "none" }}>
                <label style={{ width: 40, height: 40, borderRadius: "50%", background: (customActive || customDirty) ? displayColor : "linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6)", border: (customActive || customDirty) ? "3px solid var(--adm-text)" : "3px solid transparent", boxShadow: (customActive || customDirty) ? `0 0 0 2px ${displayColor}40` : "none", cursor: "pointer", display: "block", overflow: "hidden", position: "relative" }}>
                  <input type="color" value={displayColor} onChange={(e) => { setCustomColor(e.target.value); setCustomDirty(true); }} style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                </label>
                <span style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: (customActive || customDirty) ? 700 : 500, color: (customActive || customDirty) ? "var(--adm-text)" : "var(--adm-text3)" }}>Custom</span>
              </div>
            );
          })()}
        </div>
        {customDirty && (
          <button onClick={() => { setAccentColor(customColor); setCustomDirty(false); save({ cartaAccentColor: customColor }); }}
            style={{ marginTop: 12, padding: "8px 20px", background: customColor, color: "#0a0a0a", border: "none", borderRadius: 10, fontSize: "0.78rem", fontWeight: 800, fontFamily: F, cursor: "pointer" }}>
            Aplicar color
          </button>
        )}
      </div>

      {/* Modo del panel */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}><Settings size={16} color="var(--adm-text3)" /> {t("panel_mode")}</h3>
        <div style={{ display: "flex", gap: 6, background: "var(--adm-input)", borderRadius: 12, padding: 4 }}>
          <button onClick={() => { trackSetting("settings_change", { panelTheme: "light" }); localStorage.setItem("qc_panel_theme", "light"); window.location.reload(); }} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: panelTheme !== "dark" ? "rgba(255,210,80,0.15)" : "transparent",
            color: panelTheme !== "dark" ? "#e6a817" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Sun size={16} strokeWidth={panelTheme !== "dark" ? 2.5 : 1.5} /> {t("light")}
          </button>
          <button onClick={() => { trackSetting("settings_change", { panelTheme: "dark" }); localStorage.setItem("qc_panel_theme", "dark"); window.location.reload(); }} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: panelTheme === "dark" ? "rgba(100,120,180,0.12)" : "transparent",
            color: panelTheme === "dark" ? "#8b9fda" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Moon size={16} strokeWidth={panelTheme === "dark" ? 2.5 : 1.5} /> {t("dark")}
          </button>
        </div>
      </div>

      {/* Idioma del panel */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>
          🌐 {t("language")}
        </h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>{t("language_desc")}</p>
        <div style={{ display: "flex", gap: 6, background: "var(--adm-input)", borderRadius: 12, padding: 4 }}>
          <button onClick={() => setLang("es")} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: lang === "es" ? "rgba(255,210,80,0.15)" : "transparent",
            color: lang === "es" ? "#e6a817" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            🇨🇱 Español
          </button>
          <button onClick={() => setLang("en")} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: lang === "en" ? "rgba(100,120,180,0.12)" : "transparent",
            color: lang === "en" ? "#8b9fda" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            🇺🇸 English
          </button>
        </div>
      </div>
    </div>
  );
}
