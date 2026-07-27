"use client";
import { useState, useEffect, useCallback } from "react";
import { Settings, Moon, Sun, Bell, Palette, Layout, Mail, List, BookOpen, Rocket, LayoutGrid, Camera } from "lucide-react";
import SubirFoto from "@/components/SubirFoto";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
  borderRadius: 8, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--adm-text)",
  outline: "none", boxSizing: "border-box",
};

interface SettingsData {
  id: string;
  cartaColorMode: string;
  cartaAccentColor: string | null;
  waiterPanelActive: boolean;
  allPhotosReferential: boolean;
  birthdayPerk: string | null;
  defaultView: string | null;
  showCategoryLobby: boolean;
}

const ACCENT_OPTIONS_ES = [
  { value: null, label: "Amber", labelEn: "Amber", color: "#F4A623" },
  { value: "#ef4444", label: "Rojo", labelEn: "Red", color: "#ef4444" },
  { value: "#22c55e", label: "Verde", labelEn: "Green", color: "#22c55e" },
  { value: "#3b82f6", label: "Azul", labelEn: "Blue", color: "#3b82f6" },
  { value: "#a855f7", label: "Morado", labelEn: "Purple", color: "#a855f7" },
  { value: "#ec4899", label: "Rosa", labelEn: "Pink", color: "#ec4899" },
];

const VIEW_OPTIONS_KEYS = [
  { value: "premium", labelKey: "view_gallery", icon: LayoutGrid },
  { value: "lista", labelKey: "view_list", icon: List },
  { value: "impact", labelKey: "view_impact", icon: Rocket },
];

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

export default function AjustesPage() {
  const { selectedRestaurantId, restaurants } = useAdminSession();
  const currentRestaurant = restaurants.find(r => r.id === selectedRestaurantId);
  const { activePlan } = usePanelSession();
  const { lang, setLang, t } = usePanelLang();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [birthdayPerk, setBirthdayPerk] = useState("");
  const [infoName, setInfoName] = useState("");
  const [infoLogoUrl, setInfoLogoUrl] = useState("");
  const [infoDietType, setInfoDietType] = useState("OMNIVORE");
  const [infoAddress, setInfoAddress] = useState("");
  const [infoPhone, setInfoPhone] = useState("");
  const [infoWhatsapp, setInfoWhatsapp] = useState("");
  const [panelTheme, setPanelTheme] = useState("light");
  const [customColor, setPersonalizadoColor] = useState("#F4A623");
  const [customDirty, setPersonalizadoDirty] = useState(false);

  const ACCENT_OPTIONS = ACCENT_OPTIONS_ES.map(o => ({ ...o, label: lang === "en" ? o.labelEn : o.label }));
  const VIEW_OPTIONS = VIEW_OPTIONS_KEYS.map(o => ({ ...o, label: t(o.labelKey) }));

  useEffect(() => { setPanelTheme(localStorage.getItem("qc_panel_theme") || "dark"); }, []);

  const rid = selectedRestaurantId;

  const fetchData = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locales/${rid}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      console.log("AJUSTES fetch:", JSON.stringify({ cartaColorMode: d.cartaColorMode, waiterPanelActive: d.waiterPanelActive, allPhotosReferential: d.allPhotosReferential, defaultView: d.defaultView }));
      setData(d);
      setBirthdayPerk(d.birthdayPerk || "");
      setInfoName(d.name || "");
      setInfoLogoUrl(d.logoUrl || "");
      setInfoDietType(d.dietType || "OMNIVORE");
      setInfoAddress(d.address || "");
      setInfoPhone(d.phone || "");
      setInfoWhatsapp(d.whatsapp || "");
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
        const updated = await res.json();
        setData((prev: any) => ({ ...prev, ...updated }));
        trackSetting("settings_change", fields);
        toast.success(t("saved"));
      } else {
        const err = await res.json();
        toast.error(err.error || t("save_error"));
      }
    } catch { toast.error(t("save_error")); }
    setSaving(false);
  };

  const hasDesign = activePlan === "SILVER" || activePlan === "GOLD" || activePlan === "PREMIUM";
  const showPlanModal = () => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "SILVER" } }));

  if (loading) return <SkeletonLoading type="form" />;
  if (!data || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>{t("select_restaurant")}</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><Settings size={20} color="var(--adm-text3)" /> {t("settings_title")}</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>{t("settings_subtitle")}</p>

      {/* ── Información básica ── */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <Camera size={18} color={GOLD} /> Información básica
        </h3>
        {/* Logo */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Logo</label>
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
          <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Nombre del local</label>
          <input value={infoName} onChange={e => setInfoName(e.target.value)} style={inputStyle} placeholder="Nombre del restaurant" />
        </div>
        {/* Tipo de cocina */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Tipo de cocina</label>
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
          <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Dirección</label>
          <input value={infoAddress} onChange={e => setInfoAddress(e.target.value)} style={inputStyle} placeholder="Ej: Av. Providencia 1234, Santiago" />
        </div>
        {/* Teléfono y WhatsApp */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>Teléfono</label>
            <input value={infoPhone} onChange={e => setInfoPhone(e.target.value)} style={inputStyle} placeholder="+56 9 1234 5678" />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5, fontWeight: 500 }}>WhatsApp</label>
            <input value={infoWhatsapp} onChange={e => setInfoWhatsapp(e.target.value)} style={inputStyle} placeholder="+56 9 1234 5678" />
          </div>
        </div>
        <button
          onClick={() => save({ name: infoName, dietType: infoDietType, address: infoAddress || null, phone: infoPhone || null, whatsapp: infoWhatsapp || null, logoUrl: infoLogoUrl || null })}
          disabled={saving}
          style={{ width: "100%", padding: 10, background: GOLD, color: "white", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
        >
          {saving ? "Guardando..." : "Guardar información"}
        </button>
      </div>

      {/* Link de la carta */}
      {currentRestaurant?.slug && (
        <div style={{
          background: "linear-gradient(135deg, rgba(244,166,35,.08), rgba(244,166,35,.03))",
          border: "1px solid rgba(244,166,35,.2)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "rgba(244,166,35,.12)", display: "grid", placeItems: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{t("your_menu")}</p>
            <a
              href={`https://quierocomer.com/qr/${currentRestaurant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: FB, fontSize: "0.85rem", color: GOLD, textDecoration: "none", wordBreak: "break-all", fontWeight: 600 }}
            >
              quierocomer.com/qr/{currentRestaurant.slug}
            </a>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://quierocomer.com/qr/${currentRestaurant.slug}`);
              toast.success(t("link_copied"));
            }}
            style={{
              padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              background: GOLD, color: "#fff", fontFamily: F, fontSize: "0.75rem", fontWeight: 700,
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            {t("copy")}
          </button>
        </div>
      )}

      {/* Vista por defecto — FIRST */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}><Layout size={16} color="var(--adm-text3)" /> {t("default_view")}</h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>{t("default_view_desc")}</p>
        {!hasDesign && <button onClick={showPlanModal} style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, margin: "0 0 10px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}>{t("available_from_gold")}</button>}
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          {VIEW_OPTIONS.map(opt => {
            const active = (data.defaultView || "lista") === opt.value;
            const locked = !hasDesign && opt.value !== "lista";
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => locked ? showPlanModal() : save({ defaultView: opt.value })}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: locked ? "not-allowed" : "pointer",
                  background: active && !locked ? GOLD : "var(--adm-input)",
                  color: active && !locked ? "white" : locked ? "var(--adm-text3)" : "var(--adm-text)",
                  fontFamily: F, fontSize: "0.82rem", fontWeight: active && !locked ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s", opacity: locked ? 0.5 : 1,
                }}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Índice de categorías */}
      {(() => {
        const catCount = (data as any)?.categories?.length ?? (data as any)?._count?.categories ?? 0;
        const canEnableLobby = catCount >= 3;
        return (
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>🗂️ {t("category_index")}</h3>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 0" }}>
              {!canEnableLobby
                ? t("category_index_need").replace("{count}", String(catCount))
                : data.showCategoryLobby
                ? t("category_index_active")
                : t("category_index_inactive")}
            </p>
          </div>
          <Toggle
            active={data.showCategoryLobby}
            onToggle={() => {
              if (!canEnableLobby && !data.showCategoryLobby) {
                toast.error(t("category_index_need").replace("{count}", String(catCount)));
                return;
              }
              save({ showCategoryLobby: !data.showCategoryLobby });
            }}
          />
        </div>
        {data.showCategoryLobby && currentRestaurant?.slug && (
          <a
            href={`/qr/${currentRestaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 12, padding: "7px 14px", borderRadius: 8,
              background: "rgba(244,166,35,0.08)", border: "1px solid rgba(244,166,35,0.2)",
              color: GOLD, fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
              textDecoration: "none", cursor: "pointer",
            }}
          >
            👁 {t("preview")}
          </a>
        )}
      </div>
        );
      })()}

      {/* Tema de la carta — Gold+ */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)", opacity: hasDesign ? 1 : 0.5 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}><Moon size={16} color="var(--adm-text3)" /> {t("menu_mode")}</h3>
        {!hasDesign && <button onClick={showPlanModal} style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, margin: "0 0 10px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}>{t("available_from_gold")}</button>}
        <div style={{ display: "flex", gap: 6, background: "var(--adm-input)", borderRadius: 12, padding: 4, pointerEvents: hasDesign ? "auto" : "none" }}>
          <button onClick={() => save({ cartaColorMode: "LIGHT" })} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: data.cartaColorMode !== "DARK" ? "rgba(255,210,80,0.15)" : "transparent",
            color: data.cartaColorMode !== "DARK" ? "#e6a817" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Sun size={16} strokeWidth={data.cartaColorMode !== "DARK" ? 2.5 : 1.5} /> {t("light")}
          </button>
          <button onClick={() => save({ cartaColorMode: "DARK" })} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: data.cartaColorMode === "DARK" ? "rgba(100,120,180,0.12)" : "transparent",
            color: data.cartaColorMode === "DARK" ? "#8b9fda" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Moon size={16} strokeWidth={data.cartaColorMode === "DARK" ? 2.5 : 1.5} /> {t("dark")}
          </button>
        </div>
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

      {/* Color de diseño — Gold+ */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)", opacity: hasDesign ? 1 : 0.5 }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}><Palette size={16} color="var(--adm-text3)" /> {t("design")}</h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>{t("design_desc")}</p>
        {!hasDesign && <button onClick={showPlanModal} style={{ fontFamily: FB, fontSize: "0.72rem", color: GOLD, margin: "0 0 10px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}>{t("available_from_gold")}</button>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, pointerEvents: hasDesign ? "auto" : "none" }}>
          {ACCENT_OPTIONS.map((opt) => {
            const isActive = (data.cartaAccentColor || null) === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => save({ cartaAccentColor: opt.value })}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  background: isActive ? "var(--adm-hover)" : "none", border: "none", cursor: "pointer",
                  padding: "8px 4px", borderRadius: 12, transition: "all 0.2s",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: opt.color,
                  border: isActive ? "3px solid var(--adm-text)" : "3px solid transparent",
                  boxShadow: isActive ? `0 0 0 2px ${opt.color}40` : "none",
                  transition: "all 0.2s",
                }} />
                <span style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: isActive ? 700 : 500, color: isActive ? "var(--adm-text)" : "var(--adm-text3)" }}>{opt.label}</span>
              </button>
            );
          })}
          {/* Personalizado color picker */}
          {(() => {
            const customActive = data.cartaAccentColor && !ACCENT_OPTIONS.some(o => o.value === data.cartaAccentColor);
            const displayColor = customDirty ? customColor : (customActive ? data.cartaAccentColor! : customColor);
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", borderRadius: 12, background: (customActive || customDirty) ? "var(--adm-hover)" : "none", transition: "all 0.2s" }}>
                <label style={{ width: 40, height: 40, borderRadius: "50%", background: customActive || customDirty ? displayColor : "linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6)", border: (customActive || customDirty) ? "3px solid var(--adm-text)" : "3px solid transparent", boxShadow: (customActive || customDirty) ? `0 0 0 2px ${displayColor}40` : "none", transition: "all 0.2s", cursor: "pointer", display: "block", overflow: "hidden", position: "relative" }}>
                  <input type="color" value={displayColor} onChange={(e) => { setPersonalizadoColor(e.target.value); setPersonalizadoDirty(true); }} style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                </label>
                <span style={{ fontFamily: FB, fontSize: "0.68rem", fontWeight: (customActive || customDirty) ? 700 : 500, color: (customActive || customDirty) ? "var(--adm-text)" : "var(--adm-text3)" }}>Custom</span>
              </div>
            );
          })()}
        </div>
        {customDirty && (
          <button
            onClick={() => { save({ cartaAccentColor: customColor }); setPersonalizadoDirty(false); }}
            style={{ marginTop: 12, padding: "8px 20px", background: customColor, color: "#0a0a0a", border: "none", borderRadius: 10, fontSize: "0.78rem", fontWeight: 800, fontFamily: F, cursor: "pointer" }}
          >
            {t("apply_color")}
          </button>
        )}
      </div>

      {(() => {
        const hasWaiter = activePlan === "PREMIUM";
        return (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)", opacity: hasWaiter ? 1 : 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}><Bell size={16} color="var(--adm-text3)" /> {t("waiter_bell")}</h3>
                {!hasWaiter
                  ? <button onClick={() => window.dispatchEvent(new CustomEvent("show-plan-modal", { detail: { initialTab: "PREMIUM" } }))} style={{ fontFamily: FB, fontSize: "0.72rem", color: "#9333ea", margin: 0, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}>{t("available_premium")}</button>
                  : <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>
                      {data.waiterPanelActive ? t("waiter_active") : t("waiter_inactive")}
                    </p>
                }
              </div>
              {hasWaiter && (
                <Toggle
                  active={data.waiterPanelActive}
                  onToggle={() => save({ waiterPanelActive: !data.waiterPanelActive })}
                />
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
