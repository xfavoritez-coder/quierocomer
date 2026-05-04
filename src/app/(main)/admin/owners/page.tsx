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

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", label: "Activo" },
  PENDING: { bg: "rgba(234,179,8,0.15)", text: "#eab308", label: "Pendiente" },
  SUSPENDED: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", label: "Suspendido" },
};

export default function OwnersPage() {
  const { isSuper } = useAdminSession();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Modal state
  const [modal, setModal] = useState<"create" | "edit" | "password" | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formRestaurantIds, setFormRestaurantIds] = useState<string[]>([]);
  const [formSendWelcome, setFormSendWelcome] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

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

  if (!isSuper) return <p style={{ color: "#888", fontFamily: F }}>Solo superadmin puede acceder a esta página.</p>;

  const openCreate = () => {
    setFormEmail(""); setFormName(""); setFormWhatsapp(""); setFormPassword(""); setFormStatus("ACTIVE");
    setFormRestaurantIds([]); setFormSendWelcome(false); setFormError("");
    setModal("create");
  };

  const openEdit = (o: Owner) => {
    setSelectedOwner(o);
    setFormEmail(o.email); setFormName(o.name); setFormWhatsapp(o.whatsapp || ""); setFormStatus(o.status);
    setFormRestaurantIds(o.restaurants.map(r => r.id)); setFormError("");
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, password: formPassword, name: formName, whatsapp: formWhatsapp.trim() || null, restaurantIds: formRestaurantIds }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); setFormLoading(false); return; }

      // Send welcome email if checked
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (res.ok) showToast(`Link de reset enviado a ${o.email}`);
      else showToast("Error al enviar link");
    } catch { showToast("Error de conexión"); }
  };

  const handleSendWelcome = async (o: Owner) => {
    if (!confirm(`¿Enviar email de bienvenida a ${o.email}? Se generará una contraseña automática.`)) return;
    try {
      const res = await fetch(`/api/admin/owners/${o.id}/send-welcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) showToast(`Email de bienvenida enviado a ${o.email}`);
      else {
        const body = await res.json().catch(() => ({}));
        showToast(`Error al enviar email: ${body.error || res.status}`);
      }
    } catch { showToast("Error de conexión"); }
  };

  const handleDelete = async (o: Owner) => {
    if (!confirm(`¿Eliminar al dueño "${o.name}" (${o.email})? Sus restaurantes no se eliminarán, solo se desvinculan.`)) return;
    try {
      const res = await fetch(`/api/admin/owners/${o.id}`, { method: "DELETE" });
      if (res.ok) {
        setOwners(prev => prev.filter(x => x.id !== o.id));
        showToast(`Dueño ${o.name} eliminado`);
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(`Error: ${body.error || res.status}`);
      }
    } catch { showToast("Error de conexión"); }
  };

  const handleStatusChange = async (o: Owner, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/owners/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) { showToast(`Status → ${newStatus}`); fetchOwners(); }
    } catch {}
  };

  const toggleRestaurant = (id: string) => {
    setFormRestaurantIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "#222", border: "1px solid #333",
    borderRadius: 6, color: "#eee", fontFamily: F, fontSize: "0.82rem", outline: "none", boxSizing: "border-box",
  };

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: "5px 10px", background: `${color}22`, border: `1px solid ${color}44`,
    borderRadius: 6, color, fontFamily: F, fontSize: "0.7rem", cursor: "pointer", whiteSpace: "nowrap",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: F, fontSize: "1.2rem", color: GOLD, margin: 0 }}>👤 Owners</h1>
        <button onClick={openCreate} style={{ padding: "8px 20px", background: GOLD, color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
          + Crear owner
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "#666", fontFamily: F }}>Cargando...</p>
      ) : owners.length === 0 ? (
        <p style={{ color: "#666", fontFamily: F }}>No hay owners registrados</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2A2A2A" }}>
                {["Nombre", "Email", "WhatsApp", "Status", "Restaurants", "Último login", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#666", fontWeight: 500, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map(o => {
                const s = STATUS_COLORS[o.status] || STATUS_COLORS.ACTIVE;
                return (
                  <tr key={o.id} style={{ borderBottom: "1px solid #1A1A1A" }}>
                    <td style={{ padding: "10px 12px", color: "#ddd" }}>{o.name}</td>
                    <td style={{ padding: "10px 12px", color: "#aaa" }}>
                      <a href={`mailto:${o.email}`} style={{ color: "#aaa", textDecoration: "none" }}>{o.email}</a>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#aaa", fontSize: "0.78rem" }}>
                      {o.whatsapp ? (
                        <a href={`https://wa.me/${o.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#22c55e", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          💬 {o.whatsapp}
                        </a>
                      ) : (
                        <span style={{ color: "#555" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o, e.target.value)}
                        style={{ background: s.bg, color: s.text, border: "none", borderRadius: 4, padding: "3px 8px", fontFamily: F, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        <option value="ACTIVE">Activo</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="SUSPENDED">Suspendido</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#888" }}>
                      {o.restaurants.length > 0 ? o.restaurants.map(r => r.name).join(", ") : <span style={{ color: "#555" }}>Sin asignar</span>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#666", fontSize: "0.75rem" }}>
                      {o.lastLoginAt ? new Date(o.lastLoginAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "Nunca"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => openEdit(o)} style={btnStyle(GOLD)}>Editar</button>
                        <button onClick={() => openPassword(o)} style={btnStyle("#8b5cf6")}>Password</button>
                        <button onClick={() => handleSendResetLink(o)} style={btnStyle("#3b82f6")}>Reset link</button>
                        <button onClick={() => handleSendWelcome(o)} style={btnStyle("#10b981")}>Bienvenida</button>
                        <button onClick={() => handleDelete(o)} style={btnStyle("#ef4444")}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 10, padding: "10px 20px", color: "#22c55e", fontFamily: F, fontSize: "0.82rem", zIndex: 1000 }}>
          {toast}
        </div>
      )}

      {/* Modal backdrop */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setModal(null)} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>

            <h2 style={{ fontFamily: F, fontSize: "1rem", color: GOLD, margin: "0 0 16px" }}>
              {modal === "create" ? "Crear owner" : modal === "edit" ? `Editar: ${selectedOwner?.name}` : `Cambiar contraseña: ${selectedOwner?.name}`}
            </h2>

            {formError && (
              <div style={{ background: "#FEF2F222", border: "1px solid #ef444444", borderRadius: 6, padding: "6px 12px", marginBottom: 12 }}>
                <p style={{ fontFamily: F, fontSize: "0.78rem", color: "#ef4444", margin: 0 }}>{formError}</p>
              </div>
            )}

            {modal === "password" ? (
              <>
                <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 4 }}>Nueva contraseña</label>
                <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} />
                <button onClick={handleSetPassword} disabled={formLoading} style={{ marginTop: 16, width: "100%", padding: 10, background: GOLD, color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontWeight: 700, cursor: "pointer" }}>
                  {formLoading ? "Guardando..." : "Guardar"}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 4 }}>Nombre</label>
                    <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre completo" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 4 }}>Email</label>
                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="owner@email.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 4 }}>WhatsApp <span style={{ color: "#555", fontSize: "0.65rem" }}>(opcional)</span></label>
                    <input type="tel" value={formWhatsapp} onChange={e => setFormWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" style={inputStyle} />
                  </div>
                  {modal === "create" && (
                    <div>
                      <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 4 }}>Contraseña</label>
                      <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} />
                    </div>
                  )}
                  {modal === "edit" && (
                    <div>
                      <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 4 }}>Status</label>
                      <select value={formStatus} onChange={e => setFormStatus(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                        <option value="ACTIVE">Activo</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="SUSPENDED">Suspendido</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "#888", marginBottom: 6 }}>Restaurants</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
                      {allRestaurants.map(r => (
                        <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                          <div onClick={() => toggleRestaurant(r.id)} style={{
                            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                            background: formRestaurantIds.includes(r.id) ? GOLD : "#333",
                            border: `1.5px solid ${formRestaurantIds.includes(r.id) ? GOLD : "#555"}`,
                            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                          }}>
                            {formRestaurantIds.includes(r.id) && <span style={{ color: "#0a0a0a", fontSize: 10, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#ccc" }}>{r.name}</span>
                        </label>
                      ))}
                      {allRestaurants.length === 0 && <p style={{ fontFamily: F, fontSize: "0.75rem", color: "#555" }}>No hay restaurants</p>}
                    </div>
                  </div>
                  {modal === "create" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <div onClick={() => setFormSendWelcome(!formSendWelcome)} style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        background: formSendWelcome ? GOLD : "#333",
                        border: `1.5px solid ${formSendWelcome ? GOLD : "#555"}`,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      }}>
                        {formSendWelcome && <span style={{ color: "#0a0a0a", fontSize: 10, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontFamily: F, fontSize: "0.78rem", color: "#aaa" }}>Enviar email de bienvenida</span>
                    </label>
                  )}
                </div>
                <button onClick={modal === "create" ? handleCreate : handleEdit} disabled={formLoading} style={{ marginTop: 16, width: "100%", padding: 10, background: GOLD, color: "#0a0a0a", border: "none", borderRadius: 8, fontFamily: F, fontWeight: 700, cursor: "pointer" }}>
                  {formLoading ? "Guardando..." : modal === "create" ? "Crear owner" : "Guardar cambios"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
