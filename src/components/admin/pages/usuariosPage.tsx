"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Shield, Eye, Crown, Mail, Trash2, X, ChevronRight } from "lucide-react";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { toast } from "sonner";
import SkeletonLoading from "@/components/admin/SkeletonLoading";
import { usePanelLang } from "@/lib/i18n/panel";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  weeklyEmailEnabled: boolean;
  isOwner?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

function Toggle({ active, onToggle, size = "normal" }: { active: boolean; onToggle: () => void; size?: "small" | "normal" }) {
  const w = size === "small" ? 36 : 44;
  const h = size === "small" ? 20 : 24;
  const dot = size === "small" ? 14 : 18;
  const pad = size === "small" ? 3 : 3;
  return (
    <button onClick={onToggle} style={{
      width: w, height: h, borderRadius: h / 2, border: "none", cursor: "pointer", position: "relative",
      background: active ? GOLD : "var(--adm-toggle-off)", transition: "all 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: dot, height: dot, borderRadius: "50%", background: "white", position: "absolute", top: pad,
        left: active ? w - dot - pad : pad, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

type RoleCfg = { label: string; color: string; bg: string; icon: any; desc: string };
type StatusCfg = { label: string; color: string; bg: string };

function RoleBadge({ role, roleConfig }: { role: string; roleConfig: Record<string, RoleCfg> }) {
  const cfg = roleConfig[role] || roleConfig.VIEWER;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700,
      fontFamily: F, color: cfg.color, background: cfg.bg, letterSpacing: "0.3px",
    }}>
      <cfg.icon size={11} />
      {cfg.label}
    </span>
  );
}

function StatusDot({ status, statusConfig }: { status: string; statusConfig: Record<string, StatusCfg> }) {
  const cfg = statusConfig[status] || statusConfig.PENDING;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: "0.7rem", fontFamily: FB, color: cfg.color, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

export default function UsuariosPage() {
  const { t } = usePanelLang();
  const { selectedRestaurantId } = useAdminSession();

  const ROLE_CONFIG: Record<string, RoleCfg> = {
    OWNER: { label: t("users_owner"), color: GOLD, bg: `rgba(244,166,35,0.12)`, icon: Crown, desc: t("users_role_owner_desc") },
    ADMIN: { label: t("users_admin"), color: GOLD, bg: "rgba(244,166,35,0.12)", icon: Shield, desc: t("users_role_admin_desc") },
    VIEWER: { label: t("users_viewer"), color: "#60a5fa", bg: "rgba(96,165,250,0.12)", icon: Eye, desc: t("users_role_viewer_desc") },
  };

  const STATUS_CONFIG: Record<string, StatusCfg> = {
    ACTIVE: { label: t("users_status_active"), color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
    PENDING: { label: t("users_status_pending"), color: GOLD, bg: "rgba(244,166,35,0.1)" },
    SUSPENDED: { label: t("users_status_suspended"), color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  };
  const [owner, setOwner] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "VIEWER">("ADMIN");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "VIEWER">("ADMIN");
  const [editWeekly, setEditWeekly] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);

  const openEdit = (user: Member) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role === "ADMIN" ? "ADMIN" : "VIEWER");
    setEditWeekly(user.weeklyEmailEnabled);
    setEditNewPassword("");
    setEditVisible(false);
    requestAnimationFrame(() => setEditVisible(true));
  };
  const closeEdit = () => { setEditVisible(false); setTimeout(() => setEditingUser(null), 250); };

  const resendInvite = async () => {
    if (!editingUser) return;
    setResendingInvite(true);
    try {
      const res = await fetch(`/api/panel/team?action=resend-invite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: editingUser.id }),
      });
      if (res.ok) toast.success(t("users_invitation_resent").replace("{email}", editingUser.email));
      else toast.error(t("users_error_resend"));
    } catch { toast.error(t("users_error_connection")); }
    setResendingInvite(false);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    const isOwner = editingUser.isOwner || editingUser.role === "OWNER";
    if (isOwner) {
      // Owner: only toggle weekly email via restaurant
      if (editWeekly !== editingUser.weeklyEmailEnabled) {
        await toggleOwnerEmail();
      }
    } else {
      await updateMember(editingUser.id, {
        role: editRole,
        weeklyEmailEnabled: editWeekly,
      });
    }
    closeEdit();
  };

  const changeMemberPassword = async () => {
    if (!editingUser || !editNewPassword.trim()) return;
    if (editNewPassword.length < 8) { toast.error(t("users_password_min_error")); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/panel/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: editingUser.id, newPassword: editNewPassword }),
      });
      if (res.ok) { toast.success(t("users_password_updated")); setEditNewPassword(""); }
      else toast.error(t("users_error_password"));
    } catch { toast.error(t("users_error_connection")); }
    setSavingPassword(false);
  };

  const rid = selectedRestaurantId;

  const fetchTeam = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/panel/team?restaurantId=${rid}`);
      if (res.ok) {
        const data = await res.json();
        setOwner(data.owner);
        setMembers(data.members || []);
      }
    } catch {}
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleInvite = async () => {
    if (!formName.trim() || !formEmail.trim() || !rid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/panel/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: rid, name: formName.trim(), email: formEmail.trim().toLowerCase(), role: formRole }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t("users_error_invite")); setSubmitting(false); return; }
      setMembers(prev => [...prev, data]);
      setFormName(""); setFormEmail(""); setShowForm(false);
      toast.success(t("users_invitation_sent").replace("{email}", formEmail.trim()));
    } catch { toast.error(t("users_error_connection")); }
    setSubmitting(false);
  };

  const updateMember = async (memberId: string, fields: Record<string, any>) => {
    try {
      const res = await fetch("/api/panel/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, ...fields }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMembers(prev => prev.map(m => m.id === memberId ? updated : m));
        toast.success(t("users_updated"));
      }
    } catch { toast.error("Error"); }
  };

  const deleteMember = async (memberId: string) => {
    setDeletingId(memberId);
    try {
      const res = await fetch("/api/panel/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== memberId));
        toast.success(t("users_deleted"));
      }
    } catch { toast.error("Error"); }
    setDeletingId(null);
  };

  const toggleOwnerEmail = async () => {
    if (!rid || !owner) return;
    try {
      const res = await fetch(`/api/admin/locales/${rid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyEmailEnabled: !owner.weeklyEmailEnabled }),
      });
      if (res.ok) {
        setOwner({ ...owner, weeklyEmailEnabled: !owner.weeklyEmailEnabled });
        toast.success("Actualizado");
      }
    } catch {}
  };

  if (loading) return <SkeletonLoading type="form" />;
  if (!rid) return <div style={{ padding: 40, textAlign: "center" }}><p style={{ color: "var(--adm-text2)", fontFamily: F }}>Selecciona un restaurante</p></div>;

  const allUsers = [
    ...(owner ? [{ ...owner, role: "OWNER", status: "ACTIVE" }] : []),
    ...members,
  ];

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "1.2rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={20} color="var(--adm-text3)" /> {t("users_title")}
          </h1>
          <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: 0 }}>
            {allUsers.length} {allUsers.length === 1 ? t("users_count") : t("users_count_plural")}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px", borderRadius: 12, cursor: "pointer",
            background: showForm ? "var(--adm-hover)" : "rgba(244,166,35,0.15)",
            color: showForm ? "var(--adm-text3)" : GOLD,
            border: showForm ? "1px solid var(--adm-card-border)" : "1px solid rgba(244,166,35,0.25)",
            fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
            transition: "all 0.2s",
          }}
        >
          {showForm ? <><X size={14} /> {t("cancel")}</> : <><UserPlus size={14} /> {t("users_add")}</>}
        </button>
      </div>

      {/* Invite Form */}
      {showForm && (
        <div style={{
          background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16,
          padding: 20, marginBottom: 16, boxShadow: "var(--adm-card-shadow, none)",
          animation: "fadeSlideIn 0.25s ease-out",
        }}>
          <h3 style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 14px" }}>
            {t("users_add_user")}
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              placeholder={t("users_name")}
              value={formName}
              onChange={e => setFormName(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
                borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box",
              }}
            />
            <input
              type="email"
              placeholder={t("users_email")}
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
                borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              {(["ADMIN", "VIEWER"] as const).map(r => {
                const cfg = ROLE_CONFIG[r];
                const active = formRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setFormRole(r)}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                      background: active ? cfg.bg : "var(--adm-input)",
                      color: active ? cfg.color : "var(--adm-text3)",
                      fontFamily: F, fontSize: "0.8rem", fontWeight: active ? 700 : 500,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "all 0.2s", border: active ? `1px solid ${typeof cfg.color === 'string' && cfg.color.startsWith('#') ? cfg.color + '33' : 'transparent'}` : "1px solid transparent",
                    }}
                  >
                    <cfg.icon size={14} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: 0 }}>
              {formRole === "ADMIN" ? t("users_admin_role_desc") : t("users_viewer_role_desc")}
            </p>
            <button
              onClick={handleInvite}
              disabled={submitting || !formName.trim() || !formEmail.trim()}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, cursor: submitting ? "wait" : "pointer",
                background: "rgba(244,166,35,0.15)", color: GOLD, fontFamily: F, fontSize: "0.88rem", fontWeight: 700, border: "1px solid rgba(244,166,35,0.25)",
                opacity: submitting || !formName.trim() || !formEmail.trim() ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {submitting ? t("users_adding") : t("users_add_user")}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)" }}>
              <Mail size={14} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", lineHeight: 1.4 }}>{t("users_email_hint")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Team List */}
      <div style={{
        background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16,
        overflow: "hidden", boxShadow: "var(--adm-card-shadow, none)",
      }}>
        {allUsers.map((user, i) => {
          const isOwner = user.isOwner || user.role === "OWNER";
          return (
            <div
              key={user.id}
              onClick={() => openEdit(user)}
              style={{
                padding: "16px 20px",
                borderBottom: i < allUsers.length - 1 ? "1px solid var(--adm-card-border)" : "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--adm-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: isOwner ? "rgba(244,166,35,0.15)" : "var(--adm-hover)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: F, fontSize: "0.82rem", fontWeight: 700,
                  color: isOwner ? GOLD : "var(--adm-text3)",
                }}>
                  {user.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F, fontSize: "0.88rem", fontWeight: 700, color: "var(--adm-text)" }}>
                      {user.name}
                    </span>
                    <RoleBadge role={user.role} roleConfig={ROLE_CONFIG} />
                    {user.status !== "ACTIVE" && <StatusDot status={user.status} statusConfig={STATUS_CONFIG} />}
                  </div>
                  <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.email}
                  </p>
                </div>
                <ChevronRight size={16} color="var(--adm-text3)" style={{ flexShrink: 0 }} />
              </div>
            </div>
          );
        })}

        {allUsers.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: F, fontSize: "0.88rem", color: "var(--adm-text3)" }}>{t("users_no_users")}</p>
          </div>
        )}
      </div>


      {/* Edit Drawer */}
      {editingUser && (() => {
        const isOwner = editingUser.isOwner || editingUser.role === "OWNER";
        return (<>
          <div onClick={closeEdit} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, opacity: editVisible ? 1 : 0, transition: "opacity 0.25s ease" }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 90vw)", zIndex: 301,
            background: "var(--adm-card)", boxShadow: "-4px 0 20px rgba(0,0,0,0.2)",
            transform: editVisible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease-out",
            display: "flex", flexDirection: "column", overflow: "auto",
          }}>
            {/* Header */}
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--adm-card-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{t("users_edit_user")}</h3>
              <button onClick={closeEdit} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color="var(--adm-text3)" /></button>
            </div>

            {/* Avatar + name preview */}
            <div style={{ padding: "20px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--adm-card-border)" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: isOwner ? "rgba(244,166,35,0.15)" : "var(--adm-hover)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: F, fontSize: "1.1rem", fontWeight: 700,
                color: isOwner ? GOLD : "var(--adm-text3)",
              }}>
                {editName[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p style={{ fontFamily: F, fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{editName || t("users_no_name")}</p>
                <p style={{ fontFamily: FB, fontSize: "0.75rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{editEmail}</p>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: 20, display: "grid", gap: 16, flex: 1 }}>
              {isOwner ? (
              <a href="/panel/perfil" onClick={closeEdit} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 12,
                textDecoration: "none", transition: "background 0.15s",
              }}>
                <UserPlus size={16} color="var(--adm-text3)" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: F, fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)", margin: 0 }}>{t("users_edit_own_data")}</p>
                  <p style={{ fontFamily: FB, fontSize: "0.7rem", color: "var(--adm-text3)", margin: "2px 0 0" }}>{t("users_edit_own_hint")}</p>
                </div>
                <ChevronRight size={14} color="var(--adm-text3)" />
              </a>
              ) : (<>
              <div>
                <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{t("users_name")}</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{
                  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
                  borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box",
                }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{t("users_email")}</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" style={{
                  width: "100%", padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
                  borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box",
                }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{t("users_role")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["ADMIN", "VIEWER"] as const).map(r => {
                    const cfg = ROLE_CONFIG[r];
                    const active = editRole === r;
                    return (
                      <button key={r} onClick={() => setEditRole(r)} style={{
                        flex: 1, padding: "10px 8px", borderRadius: 10, border: active ? `1px solid ${typeof cfg.color === "string" && cfg.color.startsWith("#") ? cfg.color + "33" : "transparent"}` : "1px solid transparent",
                        cursor: "pointer", background: active ? cfg.bg : "var(--adm-input)",
                        color: active ? cfg.color : "var(--adm-text3)",
                        fontFamily: F, fontSize: "0.8rem", fontWeight: active ? 700 : 500,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        transition: "all 0.2s",
                      }}>
                        <cfg.icon size={14} /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontFamily: FB, fontSize: "0.72rem", color: "var(--adm-text3)", margin: "8px 0 0" }}>
                  {editRole === "ADMIN" ? t("users_admin_role_desc") : t("users_viewer_role_desc")}
                </p>
              </div>
              </>)}

              {/* Change password — only for non-owner */}
              {!isOwner && (
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--adm-card-border)" }}>
                <label style={{ display: "block", fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{t("users_new_password")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="password" placeholder={t("users_password_min")} value={editNewPassword} onChange={e => setEditNewPassword(e.target.value)} style={{
                    flex: 1, padding: "10px 14px", background: "var(--adm-input)", border: "1px solid var(--adm-input-border)",
                    borderRadius: 8, fontFamily: FB, fontSize: "0.85rem", color: "var(--adm-text)", outline: "none", boxSizing: "border-box",
                  }} />
                  <button onClick={changeMemberPassword} disabled={savingPassword || !editNewPassword.trim()} style={{
                    padding: "10px 14px", borderRadius: 8, border: "1px solid var(--adm-card-border)", cursor: savingPassword ? "wait" : "pointer",
                    background: "var(--adm-hover)", color: "var(--adm-text2)", fontFamily: F, fontSize: "0.78rem", fontWeight: 600,
                    opacity: savingPassword || !editNewPassword.trim() ? 0.5 : 1, whiteSpace: "nowrap",
                  }}>
                    {savingPassword ? "..." : t("users_change")}
                  </button>
                </div>
              </div>
              )}

            </div>

            {/* Footer actions */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--adm-card-border)", display: "flex", flexDirection: "column", gap: 10 }}>
              {!isOwner && editingUser.status === "PENDING" && (
              <button onClick={resendInvite} disabled={resendingInvite} style={{
                width: "100%", padding: 12, borderRadius: 10, cursor: resendingInvite ? "wait" : "pointer",
                background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
                border: "1px solid rgba(244,166,35,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: resendingInvite ? 0.5 : 1,
              }}>
                <Mail size={14} /> {resendingInvite ? t("users_resending") : t("users_send_activation")}
              </button>
              )}
              {!isOwner && (
              <button onClick={saveEdit} style={{
                width: "100%", padding: 12, borderRadius: 10, cursor: "pointer",
                background: "rgba(244,166,35,0.15)", color: GOLD, fontFamily: F, fontSize: "0.88rem", fontWeight: 700,
                border: "1px solid rgba(244,166,35,0.25)",
              }}>
                {t("users_save_changes")}
              </button>
              )}
              {!isOwner && (
                <button onClick={() => { if (confirm(t("users_confirm_delete").replace("{name}", editingUser.name))) { deleteMember(editingUser.id); closeEdit(); } }} style={{
                  width: "100%", padding: 12, borderRadius: 10, cursor: "pointer",
                  background: "rgba(239,68,68,0.08)", color: "#ef4444", fontFamily: F, fontSize: "0.82rem", fontWeight: 600,
                  border: "1px solid rgba(239,68,68,0.15)",
                }}>
                  {t("users_delete_user")}
                </button>
              )}
            </div>
          </div>
        </>);
      })()}

      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
