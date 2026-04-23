"use client";
import { useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

export default function PanelPerfilPage() {
  const { loading: sessionLoading } = useAdminSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    fetch("/api/panel/profile")
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setName(data.name || "");
          setEmail(data.email || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionLoading]);

  const handleSaveName = async () => {
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }
    setSavingName(true);
    try {
      const res = await fetch("/api/panel/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); setSavingName(false); return; }
      toast.success("Nombre actualizado");
    } catch { toast.error("Error de conexión"); }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Todos los campos de contraseña son requeridos");
      return;
    }
    if (newPassword.length < 8) { toast.error("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (!/\d/.test(newPassword)) { toast.error("La nueva contraseña debe contener al menos 1 número"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/panel/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al cambiar contraseña"); setSavingPassword(false); return; }
      toast.success("Contraseña actualizada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch { toast.error("Error de conexión"); }
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
        <ArrowLeft size={16} /> Volver al inicio
      </Link>
      <h1 style={{ fontFamily: F, fontSize: "1.3rem", color: "var(--adm-text)", margin: "0 0 24px" }}>Mi perfil</h1>

      {/* Name section */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", margin: "0 0 16px" }}>Datos personales</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input value={email} disabled style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />
          <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "4px 0 0" }}>El email no se puede cambiar desde aquí.</p>
        </div>

        <button onClick={handleSaveName} disabled={savingName} style={{
          padding: "10px 24px", background: GOLD, color: "white",
          fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
          border: "none", borderRadius: 8, cursor: savingName ? "wait" : "pointer",
        }}>
          {savingName ? "Guardando..." : "Guardar nombre"}
        </button>
      </div>

      {/* Password section */}
      <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 20, boxShadow: "var(--adm-card-shadow, none)" }}>
        <h2 style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text)", margin: "0 0 16px" }}>Cambiar contraseña</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Tu contraseña actual" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mín. 8 caracteres, 1 número" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Confirmar nueva contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la nueva contraseña" style={inputStyle} />
          </div>

          <button onClick={handleChangePassword} disabled={savingPassword} style={{
            padding: "10px 24px", background: GOLD, color: "white",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
            border: "none", borderRadius: 8, cursor: savingPassword ? "wait" : "pointer",
            marginTop: 4,
          }}>
            {savingPassword ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </div>
    </div>
  );
}
