"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

function InviteContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "form" | "expired" | "done">("loading");
  const [member, setMember] = useState<{ name: string; email: string; restaurantName: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("expired"); return; }
    fetch(`/api/panel/invite?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus("expired"); return; }
        setMember(data);
        setStatus("form");
      })
      .catch(() => setStatus("expired"));
  }, [token]);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) { toast.error("Completa ambos campos"); return; }
    if (password.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    if (!/\d/.test(password)) { toast.error("Debe contener al menos 1 número"); return; }
    if (password !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/panel/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error"); setSaving(false); return; }
      setStatus("done");
      setTimeout(() => { window.location.href = "/panel/login"; }, 2000);
    } catch { toast.error("Error de conexión"); setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", height: 46, boxSizing: "border-box",
    background: "var(--adm-input)", border: "1px solid var(--adm-input-border)", borderRadius: 8,
    color: "var(--adm-text)", fontFamily: F, fontSize: "0.95rem", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--adm-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 360, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧞</div>
          <h1 style={{ fontFamily: F, fontSize: 22, fontWeight: 500, color: "var(--adm-text)", margin: "0 0 4px" }}>
            Quiero<span style={{ color: GOLD }}>Comer</span>
          </h1>
        </div>

        {status === "loading" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text3)" }}>Verificando invitación...</p>
          </div>
        )}

        {status === "expired" && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>😔</div>
            <h2 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", margin: "0 0 8px" }}>Invitación no válida</h2>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Este enlace ya fue usado o ha expirado. Pide al dueño del restaurante que te envíe una nueva invitación.
            </p>
            <a href="/panel/login" style={{ fontFamily: F, fontSize: "0.82rem", color: GOLD, textDecoration: "none" }}>Ir al login →</a>
          </div>
        )}

        {status === "form" && member && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", margin: "0 0 6px" }}>Bienvenido al equipo</h2>
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>
                Te invitaron a <strong style={{ color: GOLD }}>{member.restaurantName}</strong>
              </p>
            </div>

            <div style={{ background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text)", margin: 0, fontWeight: 600 }}>{member.name}</p>
              <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{member.email}</p>
            </div>

            <p style={{ fontFamily: FB, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 14px" }}>Crea una contraseña para acceder al panel:</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="password" placeholder="Contraseña (mín. 8 caracteres)" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Confirmar contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
              <button onClick={handleSubmit} disabled={saving} style={{
                width: "100%", padding: 14, marginTop: 6,
                background: "rgba(244,166,35,0.15)", color: GOLD, border: "1px solid rgba(244,166,35,0.25)",
                fontFamily: F, fontSize: "0.92rem", fontWeight: 700,
                borderRadius: 10, cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "Creando acceso..." : "Crear mi acceso"}
              </button>
            </div>
          </div>
        )}

        {status === "done" && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontFamily: F, fontSize: "1rem", color: "var(--adm-text)", margin: "0 0 8px" }}>Acceso creado</h2>
            <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text3)", margin: 0 }}>Redirigiendo al login...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return <Suspense><InviteContent /></Suspense>;
}
