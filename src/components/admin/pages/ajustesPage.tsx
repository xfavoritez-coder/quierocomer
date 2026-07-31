"use client";
import { useState, useEffect, useCallback } from "react";
import { Settings, Moon, Sun, Bell, Layout, List, BookOpen, Rocket, LayoutGrid } from "lucide-react";
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
  const { lang, t } = usePanelLang();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [birthdayPerk, setBirthdayPerk] = useState("");
  const VIEW_OPTIONS = VIEW_OPTIONS_KEYS.map(o => ({ ...o, label: t(o.labelKey) }));

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
      <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}><Settings size={20} color="var(--adm-text3)" /> {t("settings_title")}</h1>


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
