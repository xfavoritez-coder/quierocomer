"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePanelSession } from "@/lib/admin/usePanelSession";
import { SessionContext } from "@/lib/admin/SessionContext";
import AdminLayoutOwner from "@/components/admin/layouts/AdminLayoutOwner";
import { toast } from "sonner";

const PUBLIC_PATHS = ["/panel/login", "/panel/forgot-password", "/panel/reset-password"];

function ForceChangePasswordModal({ onDone }: { onDone: () => void }) {
  const F = "var(--font-display)";
  const GOLD = "#F4A623";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", height: 40, boxSizing: "border-box",
    background: "#FFF9ED", border: "1px solid #E8C78A", borderRadius: 6,
    color: "#1a1a1a", fontFamily: F, fontSize: "0.88rem", outline: "none",
  };

  const handleSubmit = async () => {
    setError("");
    if (!currentPassword || !newPassword || !confirmPassword) { setError("Todos los campos son requeridos"); return; }
    if (newPassword.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (!/\d/.test(newPassword)) { setError("La nueva contraseña debe contener al menos 1 número"); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/panel/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al cambiar contraseña"); setSaving(false); return; }
      toast.success("Contraseña actualizada");
      onDone();
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 40 }}>🔐</span>
          <h2 style={{ fontFamily: F, fontSize: "1.1rem", color: "#1a1a1a", margin: "8px 0 4px" }}>Cambio de contraseña requerido</h2>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#8a7550", margin: 0 }}>Por seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
            <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#dc2626", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Tu contraseña temporal" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mín. 8 caracteres, 1 número" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#8a7550", marginBottom: 4, textTransform: "uppercase", letterSpacing: "1px" }}>Confirmar contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la nueva contraseña" style={inputStyle} />
          </div>
          <button onClick={handleSubmit} disabled={saving} style={{
            width: "100%", height: 44, marginTop: 4,
            background: saving ? "#E8A942" : GOLD,
            color: "white", fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
            border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer",
          }}>
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant, role, mustChangePassword, clearMustChangePassword, activePlan } = usePanelSession();

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
        {/* Desktop skeleton */}
        <div className="panel-skel-desktop">
          <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 220, background: "#FFF9ED", borderRight: "1px solid #E8D0A0", padding: "18px 16px" }}>
            <div className="skel-pulse" style={{ width: 120, height: 18, borderRadius: 4, marginBottom: 24 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...Array(6)].map((_, i) => <div key={i} className="skel-pulse" style={{ height: 36, borderRadius: 8 }} />)}
            </div>
          </aside>
          <main style={{ marginLeft: 220, padding: "24px 32px" }}>
            <div className="skel-pulse" style={{ width: 200, height: 24, borderRadius: 6, marginBottom: 12 }} />
            <div className="skel-pulse" style={{ width: 300, height: 14, borderRadius: 4, marginBottom: 24 }} />
            <div className="skel-pulse" style={{ height: 90, borderRadius: 16, marginBottom: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skel-pulse" style={{ height: 72, borderRadius: 12 }} />)}
            </div>
          </main>
        </div>
        {/* Mobile skeleton */}
        <div className="panel-skel-mobile">
          <header style={{ height: 56, background: "#FFF9ED", borderBottom: "1px solid #E8D0A0", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
            <div className="skel-pulse" style={{ width: 100, height: 18, borderRadius: 4 }} />
            <div style={{ flex: 1 }} />
            <div className="skel-pulse" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          </header>
          <div style={{ padding: "20px 16px" }}>
            <div className="skel-pulse" style={{ width: 160, height: 20, borderRadius: 6, marginBottom: 10 }} />
            <div className="skel-pulse" style={{ width: 240, height: 12, borderRadius: 4, marginBottom: 20 }} />
            <div className="skel-pulse" style={{ height: 80, borderRadius: 16, marginBottom: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skel-pulse" style={{ height: 64, borderRadius: 12 }} />)}
            </div>
          </div>
          <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "white", borderTop: "1px solid #E8D0A0", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 16px" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skel-pulse" style={{ width: 40, height: 40, borderRadius: 8 }} />)}
          </nav>
        </div>
        <style>{`
          @keyframes skelPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
          .skel-pulse { background: #F4A623; animation: skelPulse 1.4s ease-in-out infinite; }
          .panel-skel-mobile { display: none; }
          @media (max-width: 767px) {
            .panel-skel-desktop { display: none; }
            .panel-skel-mobile { display: block; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    if (typeof window !== "undefined") window.location.href = "/panel/login";
    return null;
  }

  const ctxValue = {
    role,
    name,
    restaurants,
    selectedRestaurantId,
    isSuper: false,
    loading: false,
    error: false,
    setSelectedRestaurant,
    logout,
  };

  return (
    <SessionContext.Provider value={ctxValue}>
      {mustChangePassword && <ForceChangePasswordModal onDone={clearMustChangePassword} />}
      <AdminLayoutOwner
        name={name}
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurantId}
        setSelectedRestaurant={setSelectedRestaurant}
        logout={logout}
        basePath="/panel"
        activePlan={activePlan}
      >
        {children}
      </AdminLayoutOwner>
    </SessionContext.Provider>
  );
}
