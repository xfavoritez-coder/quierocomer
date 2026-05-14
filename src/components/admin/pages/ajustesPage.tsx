"use client";
import { useState, useEffect, useCallback } from "react";
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
  waiterPanelActive: boolean;
  allPhotosReferential: boolean;
  birthdayPerk: string | null;
  defaultView: string | null;
}

const VIEW_OPTIONS = [
  { value: "lista", label: "Lista" },
  { value: "premium", label: "Galería" },
];

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
        background: active ? GOLD : "var(--adm-input-border)",
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: "50%", background: "white", position: "absolute", top: 3,
        left: active ? 23 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", pointerEvents: "none",
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
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 4px" }}>Ajustes</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Configura las opciones de tu carta y local</p>

      {/* Modo oscuro */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Modo oscuro</h3>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>
              {data.cartaColorMode === "DARK" ? "Tu carta se muestra en modo oscuro" : "Tu carta se muestra en modo claro"}
            </p>
          </div>
          <Toggle
            active={data.cartaColorMode === "DARK"}
            onToggle={() => save({ cartaColorMode: data.cartaColorMode === "DARK" ? "LIGHT" : "DARK" })}
          />
        </div>
      </div>

      {/* Campanita garzón */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Campanita garzón</h3>
            <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: 0 }}>
              {data.waiterPanelActive ? "Los clientes pueden llamar al garzón" : "La campanita no se muestra en la carta"}
            </p>
          </div>
          <Toggle
            active={data.waiterPanelActive}
            onToggle={() => save({ waiterPanelActive: !data.waiterPanelActive })}
          />
        </div>
      </div>


      {/* Vista por defecto */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h3 style={{ fontFamily: F, fontSize: "0.9rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px" }}>Vista por defecto</h3>
        <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "0 0 14px" }}>La vista que veran tus clientes al abrir la carta</p>
        <div style={{ display: "flex", gap: 8 }}>
          {VIEW_OPTIONS.map(opt => {
            const active = (data.defaultView || "lista") === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => save({ defaultView: opt.value })}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: active ? GOLD : "var(--adm-input)",
                  color: active ? "white" : "var(--adm-text)",
                  fontFamily: F, fontSize: "0.82rem", fontWeight: active ? 700 : 500,
                  transition: "all 0.2s",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
