"use client";
import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const F = "var(--font-display)";
const GOLD = "#F4A623";

interface Restaurant { id: string; name: string; slug: string; }
interface Owner {
  id: string; email: string; name: string; whatsapp: string | null; role: string;
  status: string; lastLoginAt: string | null; createdAt?: string; restaurants: Restaurant[];
}

const STATUS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  ACTIVE:    { bg: "rgba(34,197,94,0.12)",  text: "#22c55e", dot: "#22c55e", label: "Activo" },
  PENDING:   { bg: "rgba(234,179,8,0.12)",  text: "#eab308", dot: "#eab308", label: "Pendiente" },
  SUSPENDED: { bg: "rgba(239,68,68,0.12)",  text: "#ef4444", dot: "#ef4444", label: "Suspendido" },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

function relativeTime(date: string | null) {
  if (!date) return "Nunca";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days}d`;
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function OwnersPage() {
  const { isSuper } = useAdminSession();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<"create" | "edit" | "password" | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formRestaurantIds, setFormRestaurantIds] = useState<string[]>([]);
  const [formSendWelcome, setFormSendWelcome] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOwners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/owners");
      if (!res.ok) return;
      const data = await res.json();
      setOwners(data.owners || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/me");
      if (!res.ok) return;
      const data = await res.json();
      setAllRestaurants(data.restaurants || []);
    } catch {}
  }, []);

  useEffect(() => { fetchOwners(); fetchRestaurants(); }, [fetchOwners, fetchRestaurants]);

  if (!isSuper) return (
    <div style={{ padding: 32, fontFamily: F, color: "#666" }}>Solo superadmin puede acceder.</div>
  );

  const openCreate = () => {
    setFormEmail(""); setFormName(""); setFormWhatsapp(""); setFormPassword("");
    setFormStatus("ACTIVE"); setFormRestaurantIds([]); setFormSendWelcome(false); setFormError("");
    setModal("create");
  };

  const openEdit = (o: Owner) => {
    setSelectedOwner(o);
    setFormEmail(o.email); setFormName(o.name); setFormWhatsapp(o.whatsapp || "");
    setFormStatus(o.status); setFormRestaurantIds(o.restaurants.map(r => r.id)); setFormError("");
    setModal("edit");
  };

  const openPassword = (o: Owner) => {
    setSelectedOwner(o); setFormPassword(""); setFormError("");
    setModal("password");
  };

  const handleCreate = async () => {
    setFormError("");
    if (!formEmail || !formName || !formPassword) { setFormError("Todos los campos son requeridos"); return; }
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/owners", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, password: formPassword, name: formName, whatsapp: formWhatsapp.trim() || null, restaurantIds: formRestaurantIds }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); setFormLoading(false); return; }
      if (formSendWelcome && data.owner?.id) {
        await fetch(`/api/admin/owners/${data.owner.id}/send-welcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: formPassword }) });
      }
      setModal(null); showToast("Owner creado"); fetchOwners();
    } catch { setFormError("Error de conexión"); }
    setFormLoading(false);
  };

  const handleEdit = async () => {
    if (!selectedOwner) return;
    setFormError(""); setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/owners/${selectedOwner.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, name: formName, whatsapp: formWhatsapp.trim() || null, status: formStatus, restaurantIds: formRestaurantIds }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); setFormLoading(false); return; }
      setModal(null); showToast("Owner actualizado"); fetchOwners();
    } catch { setFormError("Error de conexión"); }
    setFormLoading(false);
  };

  const handleSetPassword = async () => {
    if (!selectedOwner) return;
    if (!formPassword || formPassword.length < 8) { setFormError("Mínimo 8 caracteres"); return; }
    setFormError(""); setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/owners/${selectedOwner.id}/set-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: formPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); setFormLoading(false); return; }
      setModal(null); showToast("Contraseña actualizada");
    } catch { setFormError("Error de conexión"); }
    setFormLoading(false);
  };

  const handleSendResetLink = async (o: Owner) => {
    try {
      const res = await fetch(`/api/admin/owners/${o.id}/send-reset-link`, { method: "POST" });
      showToast(res.ok ? `Link enviado a ${o.email}` : "Error al enviar link", res.ok);
    } catch { showToast("Error de conexión", false); }
  };

  const handleSendWelcome = async (o: Owner) => {
    if (!confirm(`¿Enviar email de bienvenida a ${o.email}?`)) return;
    try {
      const res = await fetch(`/api/admin/owners/${o.id}/send-welcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) showToast(`Bienvenida enviada a ${o.email}`);
      else { const b = await res.json().catch(() => ({})); showToast(`Error: ${b.error || res.status}`, false); }
    } catch { showToast("Error de conexión", false); }
  };

  const handleDelete = async (o: Owner) => {
    if (!confirm(`¿Eliminar al dueño "${o.name}" (${o.email})? Sus restaurantes no se eliminarán.`)) return;
    try {
      const res = await fetch(`/api/admin/owners/${o.id}`, { method: "DELETE" });
      if (res.ok) { setOwners(prev => prev.filter(x => x.id !== o.id)); showToast(`${o.name} eliminado`); }
      else { const b = await res.json().catch(() => ({})); showToast(`Error: ${b.error || res.status}`, false); }
    } catch { showToast("Error de conexión", false); }
  };

  const handleStatusChange = async (o: Owner, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/owners/${o.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) { showToast(`Status → ${newStatus}`); fetchOwners(); }
    } catch {}
  };

  const toggleRestaurant = (id: string) => {
    setFormRestaurantIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const filtered = owners.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.email.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 8, color: "#eee", fontFamily: F, fontSize: "0.85rem", outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: "#fff", margin: 0, fontWeight: 700 }}>Owners</h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#555", margin: "4px 0 0" }}>{owners.length} usuarios registrados</p>
        </div>
        <button onClick={openCreate} style={{
          padding: "10px 22px", background: GOLD, color: "#0a0a0a", border: "none",
          borderRadius: 10, fontFamily: F, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: "1rem" }}>+</span> Nuevo owner
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: "0.9rem", pointerEvents: "none" }}>🔍</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          style={{ ...inputStyle, paddingLeft: 36 }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: "#1a1a1a", borderRadius: 14, height: 100, opacity: 0.5, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#444", fontFamily: F }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👤</div>
          <p style={{ fontSize: "0.9rem" }}>{search ? "Sin resultados" : "No hay owners registrados"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(o => {
            const s = STATUS[o.status] || STATUS.ACTIVE;
            return (
              <div key={o.id} style={{
                background: "#161616", border: "1px solid #222", borderRadius: 14,
                padding: "16px 18px", transition: "border-color 0.2s",
              }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: `${GOLD}18`,
                    border: `1.5px solid ${GOLD}30`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontFamily: F, fontWeight: 700,
                    fontSize: "0.85rem", color: GOLD, flexShrink: 0, letterSpacing: 0.5,
                  }}>
                    {initials(o.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: F, fontWeight: 700, fontSize: "0.92rem", color: "#eee" }}>{o.name}</span>
                      {/* Status badge */}
                      <span style={{
                        background: s.bg, color: s.text, borderRadius: 20,
                        padding: "2px 10px", fontSize: "0.68rem", fontFamily: F, fontWeight: 600,
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                        {s.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", marginTop: 4 }}>
                      <a href={`mailto:${o.email}`} style={{ fontFamily: F, fontSize: "0.78rem", color: "#666", textDecoration: "none" }}>{o.email}</a>
                      {o.whatsapp && (
                        <a href={`https://wa.me/${o.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: F, fontSize: "0.78rem", color: "#22c55e", textDecoration: "none" }}>
                          💬 {o.whatsapp}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Last login — desktop right */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: F, fontSize: "0.68rem", color: "#444", marginBottom: 2 }}>Último acceso</div>
                    <div style={{ fontFamily: F, fontSize: "0.78rem", color: "#666" }}>{relativeTime(o.lastLoginAt)}</div>
                  </div>
                </div>

                {/* Restaurants */}
                {o.restaurants.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {o.restaurants.map(r => (
                      <span key={r.id} style={{
                        background: "#222", border: "1px solid #2a2a2a", borderRadius: 6,
                        padding: "3px 10px", fontFamily: F, fontSize: "0.72rem", color: "#888",
                      }}>
                        🏠 {r.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid #1f1f1f", paddingTop: 12 }}>
                  {/* Status quick-change */}
                  <select
                    value={o.status}
                    onChange={e => handleStatusChange(o, e.target.value)}
                    style={{
                      background: "#111", color: s.text, border: `1px solid ${s.text}30`,
                      borderRadius: 7, padding: "5px 10px", fontFamily: F, fontSize: "0.72rem",
                      fontWeight: 600, cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="SUSPENDED">Suspendido</option>
                  </select>

                  <div style={{ flex: 1 }} />

                  {[
                    { label: "Editar", color: GOLD, fn: () => openEdit(o) },
                    { label: "Password", color: "#8b5cf6", fn: () => openPassword(o) },
                    { label: "Reset link", color: "#3b82f6", fn: () => handleSendResetLink(o) },
                    { label: "Bienvenida", color: "#10b981", fn: () => handleSendWelcome(o) },
                    { label: "Eliminar", color: "#ef4444", fn: () => handleDelete(o) },
                  ].map(({ label, color, fn }) => (
                    <button key={label} onClick={fn} style={{
                      padding: "5px 12px", background: `${color}14`, border: `1px solid ${color}30`,
                      borderRadius: 7, color, fontFamily: F, fontSize: "0.72rem", fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.15s",
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: toast.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${toast.ok ? "#22c55e" : "#ef4444"}30`,
          borderRadius: 12, padding: "12px 20px",
          color: toast.ok ? "#22c55e" : "#ef4444",
          fontFamily: F, fontSize: "0.82rem", zIndex: 1000,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{toast.ok ? "✓" : "✕"}</span> {toast.msg}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{
            background: "#161616", border: "1px solid #2a2a2a", borderRadius: 18,
            padding: "24px 24px 20px", width: "100%", maxWidth: 440,
            maxHeight: "90vh", overflowY: "auto", position: "relative",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}>
            <button onClick={() => setModal(null)} style={{
              position: "absolute", top: 14, right: 16, background: "#222", border: "none",
              borderRadius: "50%", width: 28, height: 28, color: "#888", fontSize: "0.85rem",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>

            <h2 style={{ fontFamily: F, fontSize: "1.05rem", color: "#fff", margin: "0 0 20px", fontWeight: 700 }}>
              {modal === "create" ? "Nuevo owner" : modal === "edit" ? `Editar: ${selectedOwner?.name}` : `Cambiar contraseña`}
            </h2>

            {formError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ef4444", margin: 0 }}>{formError}</p>
              </div>
            )}

            {modal === "password" ? (
              <>
                <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Nueva contraseña</label>
                <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} />
                <button onClick={handleSetPassword} disabled={formLoading} style={{ marginTop: 20, width: "100%", padding: 12, background: GOLD, color: "#0a0a0a", border: "none", borderRadius: 10, fontFamily: F, fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>
                  {formLoading ? "Guardando..." : "Guardar contraseña"}
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Nombre completo", value: formName, setter: setFormName, placeholder: "Juan Pérez", type: "text" },
                  { label: "Email", value: formEmail, setter: setFormEmail, placeholder: "owner@email.com", type: "email" },
                  { label: "WhatsApp (opcional)", value: formWhatsapp, setter: setFormWhatsapp, placeholder: "+56 9 1234 5678", type: "tel" },
                  ...(modal === "create" ? [{ label: "Contraseña", value: formPassword, setter: setFormPassword, placeholder: "Mínimo 8 caracteres", type: "password" }] : []),
                ].map(({ label, value, setter, placeholder, type }) => (
                  <div key={label}>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
                    <input type={type} value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                  </div>
                ))}

                {modal === "edit" && (
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Status</label>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="ACTIVE">Activo</option>
                      <option value="PENDING">Pendiente</option>
                      <option value="SUSPENDED">Suspendido</option>
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontFamily: F, fontSize: "0.7rem", color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Restaurantes asignados
                  </label>
                  <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, padding: "2px 0" }}>
                    {allRestaurants.length === 0 ? (
                      <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#444" }}>No hay restaurantes disponibles</p>
                    ) : allRestaurants.map(r => {
                      const checked = formRestaurantIds.includes(r.id);
                      return (
                        <label key={r.id} onClick={() => toggleRestaurant(r.id)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 10px", borderRadius: 8, background: checked ? `${GOLD}10` : "transparent", transition: "background 0.15s" }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            background: checked ? GOLD : "#222",
                            border: `1.5px solid ${checked ? GOLD : "#333"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}>
                            {checked && <span style={{ color: "#0a0a0a", fontSize: 11, fontWeight: 900 }}>✓</span>}
                          </div>
                          <span style={{ fontFamily: F, fontSize: "0.82rem", color: checked ? "#ddd" : "#888" }}>{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {modal === "create" && (
                  <label onClick={() => setFormSendWelcome(!formSendWelcome)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 10px", borderRadius: 8, background: formSendWelcome ? "rgba(16,185,129,0.08)" : "transparent", border: `1px solid ${formSendWelcome ? "#10b98130" : "#1f1f1f"}`, transition: "all 0.15s" }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      background: formSendWelcome ? "#10b981" : "#222",
                      border: `1.5px solid ${formSendWelcome ? "#10b981" : "#333"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {formSendWelcome && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontFamily: F, fontSize: "0.82rem", color: "#ccc" }}>Enviar email de bienvenida</div>
                      <div style={{ fontFamily: F, fontSize: "0.7rem", color: "#555" }}>Se enviará con las credenciales al crear</div>
                    </div>
                  </label>
                )}

                <button onClick={modal === "create" ? handleCreate : handleEdit} disabled={formLoading} style={{
                  marginTop: 4, width: "100%", padding: 13, background: GOLD, color: "#0a0a0a",
                  border: "none", borderRadius: 10, fontFamily: F, fontWeight: 700, cursor: "pointer",
                  fontSize: "0.9rem", opacity: formLoading ? 0.7 : 1,
                }}>
                  {formLoading ? "Guardando..." : modal === "create" ? "Crear owner" : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.3} }
        input:focus, select:focus { border-color: ${GOLD}60 !important; }
        @media (max-width: 600px) {
          .owners-actions { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
