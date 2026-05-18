"use client";
import { useState, useEffect, useCallback } from "react";
import { Settings, Moon, Sun, Bell, Palette, Layout, Mail, List, BookOpen, Rocket } from "lucide-react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { toast } from "sonner";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

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
  weeklyEmailEnabled: boolean;
  weeklyInsightsEnabled: boolean;
}

const ACCENT_OPTIONS = [
  { value: null, label: "Amber", color: "#F4A623" },
  { value: "#C50E2C", label: "Rojo", color: "#C50E2C" },
];

const VIEW_OPTIONS = [
  { value: "lista", label: "Lista", icon: List },
  { value: "premium", label: "Galería", icon: BookOpen },
  { value: "impact", label: "Impact", icon: Rocket },
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
  const { selectedRestaurantId } = useAdminSession();
  const { activePlan } = usePanelSession();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [birthdayPerk, setBirthdayPerk] = useState("");
  const [panelTheme, setPanelTheme] = useState("dark");

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
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        console.log("AJUSTES save response:", JSON.stringify({ cartaColorMode: updated.cartaColorMode, waiterPanelActive: updated.waiterPanelActive, allPhotosReferential: updated.allPhotosReferential }));
        setData(updated);
        toast.success("Guardado");
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al guardar");
      }
    } catch { toast.error("Error de conexion"); }
    setSaving(false);
  };

  if (loading) return <SkeletonLoading type="form" />;
  if (!data || !rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurant</p></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><Settings size={20} color="var(--adm-text3)" /> Ajustes</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Configura las opciones de tu carta y local</p>

      {/* Vista por defecto — FIRST */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}><Layout size={16} color="var(--adm-text3)" /> Vista por defecto</h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>La vista que veran tus clientes al abrir la carta</p>
        <div style={{ display: "flex", gap: 8 }}>
          {VIEW_OPTIONS.map(opt => {
            const active = (data.defaultView || "lista") === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => save({ defaultView: opt.value })}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: active ? GOLD : "var(--adm-input)",
                  color: active ? "white" : "var(--adm-text)",
                  fontFamily: F, fontSize: "0.82rem", fontWeight: active ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                }}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tema de la carta */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}><Moon size={16} color="var(--adm-text3)" /> Modo por defecto de la carta</h3>
        <div style={{ display: "flex", gap: 6, background: "var(--adm-input)", borderRadius: 12, padding: 4 }}>
          <button onClick={() => save({ cartaColorMode: "LIGHT" })} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: data.cartaColorMode !== "DARK" ? "rgba(255,210,80,0.15)" : "transparent",
            color: data.cartaColorMode !== "DARK" ? "#e6a817" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Sun size={16} strokeWidth={data.cartaColorMode !== "DARK" ? 2.5 : 1.5} /> Claro
          </button>
          <button onClick={() => save({ cartaColorMode: "DARK" })} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: data.cartaColorMode === "DARK" ? "rgba(100,120,180,0.12)" : "transparent",
            color: data.cartaColorMode === "DARK" ? "#8b9fda" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Moon size={16} strokeWidth={data.cartaColorMode === "DARK" ? 2.5 : 1.5} /> Oscuro
          </button>
        </div>
      </div>

      {/* Modo del panel */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}><Settings size={16} color="var(--adm-text3)" /> Modo del panel</h3>
        <div style={{ display: "flex", gap: 6, background: "var(--adm-input)", borderRadius: 12, padding: 4 }}>
          <button onClick={() => { localStorage.setItem("qc_panel_theme", "light"); window.location.reload(); }} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: panelTheme !== "dark" ? "rgba(255,210,80,0.15)" : "transparent",
            color: panelTheme !== "dark" ? "#e6a817" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Sun size={16} strokeWidth={panelTheme !== "dark" ? 2.5 : 1.5} /> Claro
          </button>
          <button onClick={() => { localStorage.setItem("qc_panel_theme", "dark"); window.location.reload(); }} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: panelTheme === "dark" ? "rgba(100,120,180,0.12)" : "transparent",
            color: panelTheme === "dark" ? "#8b9fda" : "var(--adm-text3)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s",
          }}>
            <Moon size={16} strokeWidth={panelTheme === "dark" ? 2.5 : 1.5} /> Oscuro
          </button>
        </div>
      </div>

      {/* Color de diseño */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}><Palette size={16} color="var(--adm-text3)" /> Diseño</h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>Color de tu carta: precios, botones y detalles</p>
        <div style={{ display: "flex", gap: 12 }}>
          {ACCENT_OPTIONS.map((opt) => {
            const isActive = (data.cartaAccentColor || null) === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => save({ cartaAccentColor: opt.value })}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: opt.color,
                  border: isActive ? "3px solid var(--adm-text)" : "3px solid transparent",
                  boxShadow: isActive ? `0 0 0 2px ${opt.color}40` : "none",
                  transition: "all 0.2s",
                }} />
                <span style={{ fontFamily: FB, fontSize: "0.7rem", fontWeight: isActive ? 700 : 500, color: isActive ? "var(--adm-text)" : "var(--adm-text3)" }}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Campanita garzón */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}><Bell size={16} color="var(--adm-text3)" /> Campanita garzón</h3>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>
              {data.waiterPanelActive ? "Activada. Los clientes pueden llamar al garzón" : "Desactivada. Los clientes no pueden llamar al garzón"}
            </p>
          </div>
          <Toggle
            active={data.waiterPanelActive}
            onToggle={() => save({ waiterPanelActive: !data.waiterPanelActive })}
          />
        </div>
      </div>

      {/* Consejos semanales del Genio */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 7 }}>🧞 Consejos semanales del Genio</h3>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>
              {data.weeklyInsightsEnabled ? "Cada semana recibes consejos personalizados en tu panel de inicio" : "Los consejos semanales no se muestran en el panel de inicio"}
            </p>
          </div>
          <Toggle
            active={data.weeklyInsightsEnabled}
            onToggle={() => save({ weeklyInsightsEnabled: !data.weeklyInsightsEnabled })}
          />
        </div>
      </div>

    </div>
  );
}
