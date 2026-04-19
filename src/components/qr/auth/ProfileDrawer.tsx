"use client";

import { useState, useEffect } from "react";
import { ChevronRight, LogOut, ChevronLeft } from "lucide-react";
import LoginDrawer from "./LoginDrawer";

interface QRUser {
  id: string;
  name: string | null;
  email: string;
  birthDate: string | null;
  dietType: string | null;
  restrictions: string[];
  dislikes: string[];
}

interface VisitedRestaurant {
  restaurant: { id: string; name: string; slug: string; logoUrl: string | null };
  lastVisit: string;
  visitCount: number;
}

interface Props {
  qrUser: QRUser | null;
  restaurantId: string;
  onClose: () => void;
  onLogout: () => void;
}

const DIET_LABELS: Record<string, string> = { omnivore: "Come de todo", vegetarian: "Vegetariano", vegan: "Vegano", pescetarian: "Pescetariano" };
const DIET_EMOJI: Record<string, string> = { omnivore: "🍽", vegetarian: "🥬", vegan: "🌿", pescetarian: "🐟" };

const ALL_DIETS = [
  { value: "omnivore", label: "Come de todo", emoji: "🍽" },
  { value: "vegetarian", label: "Vegetariano", emoji: "🥬" },
  { value: "vegan", label: "Vegano", emoji: "🌿" },
  { value: "pescetarian", label: "Pescetariano", emoji: "🐟" },
];

const ALL_RESTRICTIONS = ["lactosa", "gluten", "nueces", "almendras", "maní", "mariscos", "cerdo", "alcohol"];
const ALL_DISLIKES = ["palta", "cebolla", "tomate", "cilantro", "ajo", "picante", "pepino", "aceitunas", "champiñón", "soya", "jengibre", "queso"];

type Page = "main" | "edit-diet" | "edit-restrictions" | "edit-dislikes" | "edit-profile" | "edit-birthday";

export default function ProfileDrawer({ qrUser, restaurantId, onClose, onLogout }: Props) {
  const [visible, setVisible] = useState(false);
  const [visited, setVisited] = useState<VisitedRestaurant[]>([]);
  const [topIngredients, setTopIngredients] = useState<string[]>([]);
  const [page, setPage] = useState<Page>("main");
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editDiet, setEditDiet] = useState<string | null>(null);
  const [editRestrictions, setEditRestrictions] = useState<string[]>([]);
  const [editDislikes, setEditDislikes] = useState<string[]>([]);
  const [experiences, setExperiences] = useState<{ experienceName: string; iconEmoji: string; accentColor: string; resultName: string; resultTraits: string[]; date: string }[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    if (qrUser) {
      fetch("/api/qr/user/me")
        .then((r) => r.json())
        .then((d) => {
          if (d.visitedRestaurants) setVisited(d.visitedRestaurants);
          if (d.topIngredients) setTopIngredients(d.topIngredients);
          if (d.experiences) setExperiences(d.experiences);
        })
        .catch(() => {});
    }
    return () => { document.body.style.overflow = ""; };
  }, [qrUser]);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  if (!qrUser) return <LoginDrawer onClose={onClose} />;

  const initial = (qrUser.name || qrUser.email).charAt(0).toUpperCase();

  const saveField = async (data: Record<string, unknown>) => {
    setSaving(true);
    await fetch("/api/qr/user/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    // Force reload user data
    window.location.reload();
  };

  // Sub-pages
  const renderEditDiet = () => (
    <div style={{ padding: "20px 0" }}>
      <button onClick={() => setPage("main")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#999", fontSize: "0.85rem", fontFamily: "inherit", marginBottom: 20, cursor: "pointer" }}>
        <ChevronLeft size={16} /> Volver
      </button>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0e0e0e", marginBottom: 16 }}>Tu dieta</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ALL_DIETS.map((d) => {
          const sel = editDiet === d.value;
          return (
            <button key={d.value} onClick={() => setEditDiet(d.value)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: sel ? "1.5px solid #F4A623" : "1px solid #f0f0f0", background: sel ? "#FFF8EE" : "#fafafa", fontFamily: "inherit", cursor: "pointer" }}>
              <span style={{ fontSize: "1.2rem" }}>{d.emoji}</span>
              <span style={{ fontSize: "0.95rem", fontWeight: sel ? 600 : 400, color: "#0e0e0e" }}>{d.label}</span>
            </button>
          );
        })}
      </div>
      <button onClick={() => saveField({ dietType: editDiet })} disabled={saving} style={{ width: "100%", marginTop: 20, background: "#F4A623", color: "white", border: "none", borderRadius: 50, padding: "14px", fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );

  const renderEditRestrictions = () => (
    <div style={{ padding: "20px 0" }}>
      <button onClick={() => setPage("main")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#999", fontSize: "0.85rem", fontFamily: "inherit", marginBottom: 20, cursor: "pointer" }}>
        <ChevronLeft size={16} /> Volver
      </button>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0e0e0e", marginBottom: 6 }}>Restricciones alimentarias</h3>
      <p style={{ fontSize: "0.82rem", color: "#999", marginBottom: 16 }}>Selecciona las que apliquen</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ALL_RESTRICTIONS.map((r) => {
          const sel = editRestrictions.includes(r);
          return (
            <button key={r} onClick={() => setEditRestrictions((prev) => sel ? prev.filter((x) => x !== r) : [...prev, r])} style={{ padding: "8px 16px", borderRadius: 50, border: sel ? "1.5px solid #F4A623" : "1px solid #eee", background: sel ? "#FFF8EE" : "#fafafa", color: sel ? "#b45309" : "#666", fontSize: "0.88rem", fontWeight: sel ? 600 : 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize" }}>
              {sel && "✓ "}{r}
            </button>
          );
        })}
      </div>
      <button onClick={() => saveField({ restrictions: editRestrictions })} disabled={saving} style={{ width: "100%", marginTop: 20, background: "#F4A623", color: "white", border: "none", borderRadius: 50, padding: "14px", fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );

  const renderEditDislikes = () => (
    <div style={{ padding: "20px 0" }}>
      <button onClick={() => setPage("main")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#999", fontSize: "0.85rem", fontFamily: "inherit", marginBottom: 20, cursor: "pointer" }}>
        <ChevronLeft size={16} /> Volver
      </button>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0e0e0e", marginBottom: 6 }}>No me gusta</h3>
      <p style={{ fontSize: "0.82rem", color: "#999", marginBottom: 16 }}>Ingredientes que prefieres evitar</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ALL_DISLIKES.map((d) => {
          const sel = editDislikes.includes(d);
          return (
            <button key={d} onClick={() => setEditDislikes((prev) => sel ? prev.filter((x) => x !== d) : [...prev, d])} style={{ padding: "8px 16px", borderRadius: 50, border: sel ? "1.5px solid #e85530" : "1px solid #eee", background: sel ? "#FEF2F2" : "#fafafa", color: sel ? "#dc2626" : "#666", fontSize: "0.88rem", fontWeight: sel ? 600 : 400, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize" }}>
              {sel && "✕ "}{d}
            </button>
          );
        })}
      </div>
      <button onClick={() => {
        // Sync to localStorage too
        localStorage.setItem("qr_dislikes", JSON.stringify(editDislikes));
        saveField({ dislikes: editDislikes });
      }} disabled={saving} style={{ width: "100%", marginTop: 20, background: "#F4A623", color: "white", border: "none", borderRadius: 50, padding: "14px", fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );

  const renderEditProfile = () => (
    <div style={{ padding: "20px 0" }}>
      <button onClick={() => setPage("main")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#999", fontSize: "0.85rem", fontFamily: "inherit", marginBottom: 20, cursor: "pointer" }}>
        <ChevronLeft size={16} /> Volver
      </button>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0e0e0e", marginBottom: 16 }}>Editar perfil</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#999", marginBottom: 4 }}>Nombre</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "12px 16px", background: "#fafafa", border: "1px solid #eee", borderRadius: 10, fontSize: "0.95rem", color: "#0e0e0e", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#999", marginBottom: 4 }}>Cumpleaños</label>
          <input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} max={new Date().toISOString().split("T")[0]} min="1940-01-01" style={{ width: "100%", padding: "12px 16px", background: "#fafafa", border: "1px solid #eee", borderRadius: 10, fontSize: "0.95rem", color: editBirthDate ? "#0e0e0e" : "#999", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "light" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#999", marginBottom: 4 }}>Email</label>
          <div style={{ padding: "12px 16px", background: "#f5f5f5", border: "1px solid #eee", borderRadius: 10, fontSize: "0.95rem", color: "#999" }}>{qrUser.email}</div>
        </div>
      </div>
      <button onClick={() => saveField({ name: editName, birthDate: editBirthDate || null })} disabled={saving || !editName} style={{ width: "100%", marginTop: 20, background: "#F4A623", color: "white", border: "none", borderRadius: 50, padding: "14px", fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: saving || !editName ? 0.6 : 1 }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );

  // Row helper
  const Row = ({ label, value, emoji, onClick }: { label: string; value: string; emoji?: string; onClick?: () => void }) => (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#fafafa", borderRadius: 12, border: "none", width: "100%", textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: "inherit" }}>
      {emoji && <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>{emoji}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.75rem", color: "#999", marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: "0.92rem", color: "#0e0e0e", fontWeight: 500 }}>{value}</div>
      </div>
      {onClick && <ChevronRight size={16} color="#ccc" />}
    </button>
  );

  const dietText = qrUser.dietType ? DIET_LABELS[qrUser.dietType] || qrUser.dietType : "No configurado";
  const dietEmoji = qrUser.dietType ? DIET_EMOJI[qrUser.dietType] || "🍽" : "🍽";
  const resText = qrUser.restrictions.filter((r) => r !== "ninguna").join(", ") || "Ninguna";
  const dislikesText = qrUser.dislikes?.length > 0 ? qrUser.dislikes.join(", ") : "Ninguno";
  const birthText = qrUser.birthDate ? new Date(qrUser.birthDate).toLocaleDateString("es-CL") : "No configurado";

  const mainPage = (
    <>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F4A623", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "24px", fontWeight: 700, color: "white" }}>{initial}</div>
        <button onClick={() => { setEditName(qrUser.name || ""); setEditBirthDate(qrUser.birthDate ? qrUser.birthDate.split("T")[0] : ""); setPage("edit-profile"); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0e0e0e", marginTop: 12 }}>{qrUser.name || "Usuario"}</h3>
          <p style={{ fontSize: "0.82rem", color: "#999" }}>{qrUser.email}</p>
        </button>
      </div>

      {/* Preferences section */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#bbb", letterSpacing: "0.08em", marginBottom: 10 }}>Mis preferencias</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Row label="Dieta" value={dietText} emoji={dietEmoji} onClick={() => { setEditDiet(qrUser.dietType); setPage("edit-diet"); }} />
          <Row label="Restricciones" value={resText} emoji="⚠️" onClick={() => { setEditRestrictions(qrUser.restrictions.filter((r) => r !== "ninguna")); setPage("edit-restrictions"); }} />
          <Row label="No me gusta" value={dislikesText} emoji="👎" onClick={() => { setEditDislikes(qrUser.dislikes || []); setPage("edit-dislikes"); }} />
          <Row label="Cumpleaños" value={birthText} emoji="🎂" onClick={() => { setEditName(qrUser.name || ""); setEditBirthDate(qrUser.birthDate ? qrUser.birthDate.split("T")[0] : ""); setPage("edit-profile"); }} />
        </div>
      </div>

      {/* Top ingredients */}
      {topIngredients.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#bbb", letterSpacing: "0.08em", marginBottom: 10 }}>Lo que más pides</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topIngredients.map((ing) => (
              <span key={ing} style={{ padding: "6px 14px", borderRadius: 50, background: "#FFF8EE", border: "1px solid rgba(244,166,35,0.15)", fontSize: "0.82rem", color: "#92400e", fontWeight: 500, textTransform: "capitalize" }}>{ing}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experiences */}
      {experiences.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#bbb", letterSpacing: "0.08em", marginBottom: 10 }}>Mis experiencias</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {experiences.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fafafa", borderRadius: 12 }}>
                <span style={{ fontSize: "1.4rem", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{e.iconEmoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.7rem", color: e.accentColor, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", lineHeight: 1.2 }}>
                    {e.experienceName}
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0e0e0e", lineHeight: 1.2 }}>
                    {e.resultName}
                  </div>
                  {e.resultTraits.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {e.resultTraits.slice(0, 3).map((t) => (
                        <span key={t} style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: 50, background: `${e.accentColor}12`, color: e.accentColor, border: `1px solid ${e.accentColor}20` }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visited restaurants */}
      {visited.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#bbb", letterSpacing: "0.08em", marginBottom: 10 }}>Locales visitados</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visited.map((v) => (
              <a key={v.restaurant.id} href={`/qr/${v.restaurant.slug}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fafafa", borderRadius: 12, textDecoration: "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#999", flexShrink: 0 }}>
                  {v.restaurant.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0e0e0e" }}>{v.restaurant.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#999" }}>
                    {v.visitCount} {v.visitCount === 1 ? "visita" : "visitas"}
                  </div>
                </div>
                <ChevronRight size={14} color="#ddd" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <button onClick={async () => { await fetch("/api/qr/user/logout", { method: "DELETE" }); onLogout(); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "none", border: "none", color: "#ccc", fontSize: "0.82rem", padding: "16px 0", fontFamily: "inherit", cursor: "pointer" }}>
        <LogOut size={14} /> Cerrar sesión
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-end font-[family-name:var(--font-dm)]" style={{ minHeight: "100dvh" }}>
      <div onClick={(e) => { if (e.target === e.currentTarget) close(); }} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", opacity: visible ? 1 : 0, transition: "opacity 0.2s" }} />
      <div style={{ position: "relative", zIndex: 1, background: "white", width: "100%", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", maxHeight: "90vh", overflowY: "auto", transform: visible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.25s ease-out", scrollbarWidth: "none" }}>
        <button onClick={close} className="absolute flex items-center justify-center" style={{ top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", border: "none", color: "#999", fontSize: "0.9rem", cursor: "pointer" }}>✕</button>

        {page === "main" && mainPage}
        {page === "edit-diet" && renderEditDiet()}
        {page === "edit-restrictions" && renderEditRestrictions()}
        {page === "edit-dislikes" && renderEditDislikes()}
        {page === "edit-profile" && renderEditProfile()}
      </div>
    </div>
  );
}
