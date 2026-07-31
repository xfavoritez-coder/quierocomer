"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

export default function PanelPerfilPage() {
  const { t } = usePanelLang();
  const { loading: sessionLoading } = useAdminSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [weeklyEmail, setWeeklyEmail] = useState(true);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [mpEmail, setMpEmail] = useState("");
  const [mpEmailOriginal, setMpEmailOriginal] = useState("");
  const [savingMpEmail, setSavingMpEmail] = useState(false);
  const { selectedRestaurantId } = useAdminSession();

  useEffect(() => {
    if (sessionLoading) return;
    fetch("/api/panel/profile")
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setName(data.name || "");
          setEmail(data.email || "");
          setWhatsapp(data.whatsapp || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Fetch restaurant preferences
    if (selectedRestaurantId) {
      fetch(`/api/billing/status?restaurantId=${selectedRestaurantId}`)
        .then(r => r.json())
        .then(data => {
          if (data.mpPayerEmail) { setMpEmail(data.mpPayerEmail); setMpEmailOriginal(data.mpPayerEmail); }
        })
        .catch(() => {});
      fetch(`/api/admin/locales/${selectedRestaurantId}`)
        .then(r => r.json())
        .then(data => { if (data.weeklyEmailEnabled !== undefined) setWeeklyEmail(data.weeklyEmailEnabled); })
        .catch(() => {});
    }
  }, [sessionLoading, selectedRestaurantId]);

  const toggleWeeklyEmail = async () => {
    if (!selectedRestaurantId) return;
    setSavingWeekly(true);
    const next = !weeklyEmail;
    try {
      const res = await fetch(`/api/admin/locales/${selectedRestaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyEmailEnabled: next }),
      });
      if (res.ok) { setWeeklyEmail(next); toast.success(next ? "Activado" : "Desactivado"); }
    } catch {}
    setSavingWeekly(false);
  };

  const handleSaveName = async () => {
    if (!name.trim()) { toast.error(t("perfil_name_required")); return; }
    setSavingName(true);
    try {
      const res = await fetch("/api/panel/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), whatsapp: whatsapp.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t("save_error")); setSavingName(false); return; }
      toast.success(t("perfil_saved"));
    } catch { toast.error(t("connection_error")); }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error(t("perfil_pw_enter"));
      return;
    }
    if (newPassword.length < 8) { toast.error(t("password_min")); return; }
    if (!/\d/.test(newPassword)) { toast.error(t("password_number")); return; }
    if (newPassword !== confirmPassword) { toast.error(t("passwords_mismatch")); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/panel/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t("pw_change_error")); setSavingPassword(false); return; }
      toast.success(t("perfil_pw_saved"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch { toast.error(t("connection_error")); }
    setSavingPassword(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", height: 40, boxSizing: "border-box",
    background: "var(--adm-card)", border: "1px solid var(--adm-card-border)",
    borderRadius: 8, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)",
    marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px",
  };

  if (loading || sessionLoading) {
    return (
      <div style={{ maxWidth: 480 }}>
        <div style={{ height: 20, width: 100, background: "var(--adm-card-border)", borderRadius: 4, marginBottom: 16 }} />
        <div style={{ height: 32, width: 200, background: "var(--adm-card-border)", borderRadius: 6, marginBottom: 24 }} />
        <div style={{ height: 200, background: "var(--adm-card-border)", borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Link href="/panel" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "var(--adm-text2)", fontFamily: FB, fontSize: "0.78rem", marginBottom: 12 }}>
        <ArrowLeft size={16} /> {t("perfil_back")}
      </Link>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 24px" }}>{t("perfil_title")}</h1>

      {/* Name section */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", margin: "0 0 16px" }}>{t("perfil_personal")}</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>{t("perfil_name")}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t("perfil_name_placeholder")} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>{t("perfil_email")}</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t("perfil_whatsapp")}</label>
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} />
        </div>

        <button onClick={handleSaveName} disabled={savingName} style={{
          padding: "10px 24px", background: GOLD, color: "white",
          fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
          border: "none", borderRadius: 8, cursor: savingName ? "wait" : "pointer",
        }}>
          {savingName ? t("perfil_saving") : t("perfil_save")}
        </button>
      </div>


      {/* Password section */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", margin: "0 0 16px" }}>{t("perfil_change_password")}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>{t("perfil_new_password")}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("pw_new_placeholder")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t("perfil_confirm_password")}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("pw_confirm_placeholder")} style={inputStyle} />
          </div>

          <button onClick={handleChangePassword} disabled={savingPassword} style={{
            padding: "10px 24px", background: GOLD, color: "white",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
            border: "none", borderRadius: 8, cursor: savingPassword ? "wait" : "pointer",
            marginTop: 4,
          }}>
            {savingPassword ? t("perfil_saving") : t("perfil_confirm_change")}
          </button>
        </div>
      </div>
    </div>
  );
}
