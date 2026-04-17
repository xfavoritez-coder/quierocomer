"use client";

import { useState, useEffect } from "react";
import { Leaf, AlertCircle, Cake } from "lucide-react";
import LoginDrawer from "./LoginDrawer";

interface QRUser {
  id: string;
  name: string | null;
  email: string;
  birthDate: string | null;
  dietType: string | null;
  restrictions: string[];
}

interface VisitedRestaurant {
  restaurant: { id: string; name: string; slug: string; logoUrl: string | null };
  lastVisit: string;
}

interface Props {
  qrUser: QRUser | null;
  restaurantId: string;
  onClose: () => void;
  onLogout: () => void;
}

const DIET_LABELS: Record<string, string> = { omnivore: "Come de todo", vegetarian: "Vegetariano", vegan: "Vegano", pescetarian: "Pescetariano" };

export default function ProfileDrawer({ qrUser, restaurantId, onClose, onLogout }: Props) {
  const [visible, setVisible] = useState(false);
  const [visited, setVisited] = useState<VisitedRestaurant[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    if (qrUser) {
      fetch("/api/qr/user/visited-restaurants").then((r) => r.json()).then((d) => setVisited(d.restaurants || [])).catch(() => {});
    }
    return () => { document.body.style.overflow = ""; };
  }, [qrUser]);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  if (!qrUser) return <LoginDrawer onClose={onClose} />;

  const initial = (qrUser.name || qrUser.email).charAt(0).toUpperCase();
  const dietText = qrUser.dietType ? DIET_LABELS[qrUser.dietType] || qrUser.dietType : "No configurado";
  const resText = qrUser.restrictions.filter((r) => r !== "ninguna").join(", ") || "Ninguna";
  const birthText = qrUser.birthDate ? new Date(qrUser.birthDate).toLocaleDateString("es-CL") : "No configurado";

  const handleLogout = async () => {
    await fetch("/api/qr/user/logout", { method: "DELETE" });
    onLogout();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end font-[family-name:var(--font-dm)]">
      <div onClick={close} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", opacity: visible ? 1 : 0, transition: "opacity 0.2s" }} />
      <div style={{ position: "relative", zIndex: 1, background: "white", width: "100%", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", maxHeight: "88vh", overflowY: "auto", transform: visible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.25s ease-out", scrollbarWidth: "none" }}>
        <button onClick={close} className="absolute flex items-center justify-center" style={{ top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "#eee", border: "none", color: "#666", fontSize: "0.9rem" }}>✕</button>

        {/* Avatar + name */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "22px", fontWeight: 700, color: "#0e0e0e" }}>{initial}</div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0e0e0e", marginTop: 12 }}>{qrUser.name || "Usuario"}</h3>
          <p style={{ fontSize: "0.85rem", color: "#888" }}>{qrUser.email}</p>
        </div>

        {/* Preferences */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#999", letterSpacing: "0.06em", marginBottom: 12 }}>Mis preferencias</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 10 }}>
              <Leaf size={16} color="#F4A623" />
              <span style={{ fontSize: "0.92rem", color: "#333" }}>{dietText}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 10 }}>
              <AlertCircle size={16} color="#F4A623" />
              <span style={{ fontSize: "0.92rem", color: "#333" }}>{resText}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 10 }}>
              <Cake size={16} color="#F4A623" />
              <span style={{ fontSize: "0.92rem", color: "#333" }}>{birthText}</span>
            </div>
          </div>
        </div>

        {/* Visited restaurants */}
        {visited.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#999", letterSpacing: "0.06em", marginBottom: 12 }}>Restaurantes visitados</h4>
            {visited.map((v) => (
              <a key={v.restaurant.id} href={`/qr/${v.restaurant.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "#f9f9f9", borderRadius: 10, marginBottom: 8, textDecoration: "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#0e0e0e", flexShrink: 0 }}>
                  {v.restaurant.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0e0e0e" }}>{v.restaurant.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "#999" }}>Visitado {new Date(v.lastVisit).toLocaleDateString("es-CL")}</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} style={{ width: "100%", background: "none", border: "none", color: "#999", fontSize: "0.85rem", padding: "12px 0", fontFamily: "inherit" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
