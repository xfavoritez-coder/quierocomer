"use client";
import { useState, useEffect } from "react";
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

const PLAN_FEATURES: Record<string, { text: string; tip: string }[]> = {
  GOLD: [
    { text: "2 vistas de carta", tip: "Vista lista y galería" },
    { text: "Destacar platos estrella", tip: "Aparecen primero en el hero" },
    { text: "Ofertas y promociones", tip: "Descuentos visibles en la carta" },
    { text: "Estadísticas básicas", tip: "Visitas, platos más vistos" },
    { text: "Anuncios en la carta", tip: "Banner de novedades" },
    { text: "Multilenguaje", tip: "ES · EN · PT automático" },
  ],
  PREMIUM: [
    { text: "Todo del plan Gold", tip: "Incluye todas las funciones Gold" },
    { text: "4 vistas de carta", tip: "Lista, galería, feed y espacial" },
    { text: "Estadísticas avanzadas", tip: "Recorridos, filtros, clima" },
    { text: "Llamar al garzón", tip: "Notificación push al garzón" },
    { text: "Productos sugeridos", tip: "Cross-sell automático" },
    { text: "Automatizaciones", tip: "Emails de cumpleaños y bienvenida" },
    { text: "Campañas y email marketing", tip: "Envíos masivos a clientes" },
    { text: "Clientes ilimitados + CSV", tip: "Lista completa y exportable" },
  ],
};

function PlanFeatureRow({ text, tip, color }: { text: string; tip: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span style={{ color, fontSize: "0.82rem", flexShrink: 0 }}>✓</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "#444", flex: 1 }}>{text}</span>
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: open ? "#1a1a1a" : "#e8e3d8", color: open ? "#fff" : "#888", fontSize: "8px", fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia,serif", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>i</span>
      </div>
      {open && <p style={{ margin: "4px 0 2px 20px", fontSize: "0.78rem", color: "#888", lineHeight: 1.45 }}>{tip}</p>}
    </div>
  );
}

function PlanModal({ plan, onClose }: { plan: string; onClose: () => void }) {
  const [tab, setTab] = useState<"GOLD" | "PREMIUM">(plan === "FREE" ? "GOLD" : plan as any);
  const FD = "var(--font-display)";
  const FB2 = "var(--font-body)";
  const features = PLAN_FEATURES[tab] || [];
  const isCurrentPlan = plan === tab;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, maxWidth: 400, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, background: "#fff", borderRadius: "24px 24px 0 0", zIndex: 1 }}>
          {(["GOLD", "PREMIUM"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "16px 0", border: "none", cursor: "pointer",
              fontFamily: FD, fontSize: "0.88rem", fontWeight: 700, background: "transparent",
              color: tab === t ? (t === "PREMIUM" ? "#7c3aed" : "#92400e") : "#ccc",
              borderBottom: tab === t ? `3px solid ${t === "PREMIUM" ? "#7c3aed" : "#F4A623"}` : "3px solid transparent",
            }}>
              {t === "GOLD" ? "⭐ Gold" : "💎 Premium"}
              {plan === t && <span style={{ marginLeft: 6, fontSize: "0.6rem", fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: t === "PREMIUM" ? "#F3E8FF" : "#FFF8E7", color: t === "PREMIUM" ? "#7c3aed" : "#92400e" }}>Tu plan</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Current plan indicator */}
          {isCurrentPlan && (
            <div style={{ textAlign: "center", marginBottom: 14, padding: "10px 16px", background: tab === "PREMIUM" ? "#F3E8FF" : "#FFF8E7", borderRadius: 10 }}>
              <p style={{ fontFamily: FD, fontSize: "0.82rem", fontWeight: 600, color: tab === "PREMIUM" ? "#7c3aed" : "#92400e", margin: 0 }}>
                ✓ Este es tu plan actual
              </p>
            </div>
          )}

          {/* Description + Price */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontFamily: FB2, fontSize: "0.85rem", color: "#555", lineHeight: 1.5, margin: "0 0 12px" }}>
              {tab === "PREMIUM" ? "Todo lo que necesitas para vender más sin mover un dedo" : "Destaca tu carta y entiende mejor a tus clientes"}
            </p>
            <span style={{ fontFamily: FD, fontSize: "2rem", fontWeight: 700, color: "#1a1a1a" }}>
              {tab === "PREMIUM" ? "$55.000" : "$35.000"}
            </span>
            <span style={{ fontFamily: FB2, fontSize: "0.85rem", color: "#999", marginLeft: 4 }}>/mes</span>
            <p style={{ fontFamily: FB2, fontSize: "0.72rem", color: "#bbb", margin: "-2px 0 0" }}>Neto · Sin contratos</p>
          </div>

          {/* Features */}
          <div style={{
            background: tab === "PREMIUM" ? "#FAFAFE" : "#FFFCF5",
            borderRadius: 12, padding: "14px 16px", marginBottom: 18,
            border: `1px solid ${tab === "PREMIUM" ? "#e9d5ff" : "#fde68a"}`,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {features.map(f => (
                <PlanFeatureRow key={f.text} text={f.text} tip={f.tip} color={tab === "PREMIUM" ? "#7c3aed" : "#F4A623"} />
              ))}
            </div>
          </div>

          {/* CTA */}
          {!isCurrentPlan ? (
            <a
              href={`https://wa.me/56999946208?text=${encodeURIComponent(`Hola! Me gustaría saber más sobre el plan ${tab === "PREMIUM" ? "Premium" : "Gold"} de QuieroComer para mi restaurante 🍽️`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "block", padding: "14px 20px", borderRadius: 999, textAlign: "center",
                background: tab === "PREMIUM" ? "#7c3aed" : "#F4A623",
                color: "#fff", fontFamily: FD, fontSize: "0.92rem", fontWeight: 700,
                textDecoration: "none", marginBottom: 8,
                boxShadow: tab === "PREMIUM" ? "0 4px 16px rgba(124,58,237,0.3)" : "0 4px 16px rgba(244,166,35,0.3)",
              }}
            >
              Quiero el plan {tab === "PREMIUM" ? "Premium" : "Gold"} →
            </a>
          ) : (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <p style={{ fontFamily: FB2, fontSize: "0.78rem", color: "#999", margin: 0 }}>Estás disfrutando de este plan</p>
            </div>
          )}
          <button onClick={onClose} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#999", fontFamily: FD, fontSize: "0.82rem", cursor: "pointer", padding: "8px 0" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name, loading, error, logout, restaurants, selectedRestaurantId, setSelectedRestaurant, role, mustChangePassword, clearMustChangePassword, activePlan } = usePanelSession();
  const [planModalOpen, setPlanModalOpen] = useState(false);

  useEffect(() => {
    const handler = () => setPlanModalOpen(true);
    window.addEventListener("show-plan-modal", handler);
    return () => window.removeEventListener("show-plan-modal", handler);
  }, []);

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

      {/* Plan modal — triggered from "Mi Plan" menu */}
      {planModalOpen && (
        <PlanModal plan={activePlan} onClose={() => setPlanModalOpen(false)} />
      )}
    </SessionContext.Provider>
  );
}
