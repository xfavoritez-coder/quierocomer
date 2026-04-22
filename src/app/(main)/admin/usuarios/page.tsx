"use client";

import { useState, useEffect } from "react";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

const F = "var(--font-display)";
const FB = "var(--font-body)";
const GOLD = "#F4A623";

interface User {
  id: string;
  name: string | null;
  email: string;
  birthDate: string | null;
  dietType: string | null;
  restrictions: string[];
  dislikes: string[];
  verifiedAt: string | null;
  createdAt: string;
  unsubscribedAt: string | null;
  lastEmailAt: string | null;
  _count: { sessions: number; dishFavorites: number; interactions: number; campaignRecipients: number };
}

interface UserDetail {
  user: User;
  engagementScore: number;
  restaurants: { id: string; name: string; slug: string }[];
  sessions: any[];
  favorites: any[];
  interactions: any[];
  campaigns: any[];
  events: any[];
}

const DIET_LABELS: Record<string, string> = { VEGAN: "🌿 Vegano", VEGETARIAN: "🌱 Vegetariano", OMNIVORE: "🍖 Carnívoro" };

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
}

function engagementLevel(score: number): { label: string; color: string } {
  if (score >= 30) return { label: "Super fan", color: "#F4A623" };
  if (score >= 15) return { label: "Activo", color: "#16a34a" };
  if (score >= 5) return { label: "Regular", color: "#7fbfdc" };
  return { label: "Nuevo", color: "var(--adm-text3)" };
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "verified" | "birthday" | "diet" | "unsubscribed">("all");

  const fetchUsers = () => {
    setLoading(true);
    fetch(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}`)
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); setPages(d.pages || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page, search]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
    const data = await res.json();
    if (!data.error) setSelectedUser(data);
    setDetailLoading(false);
  };

  const filtered = users.filter(u => {
    if (filter === "verified") return u.verifiedAt;
    if (filter === "birthday") return u.birthDate;
    if (filter === "diet") return u.dietType && u.dietType !== "OMNIVORE";
    if (filter === "unsubscribed") return u.unsubscribedAt;
    return true;
  });

  // Stats
  const verifiedCount = users.filter(u => u.verifiedAt).length;
  const birthdayCount = users.filter(u => u.birthDate).length;
  const dietCounts: Record<string, number> = {};
  users.forEach(u => { if (u.dietType) dietCounts[u.dietType] = (dietCounts[u.dietType] || 0) + 1; });

  if (selectedUser) {
    const u = selectedUser.user;
    const eng = engagementLevel(selectedUser.engagementScore);
    return (
      <div style={{ maxWidth: 700 }}>
        <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", color: GOLD, fontFamily: F, fontSize: "0.85rem", cursor: "pointer", marginBottom: 16 }}>&larr; Volver a usuarios</button>

        {/* Header */}
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: F, fontSize: "1.2rem", fontWeight: 700 }}>
              {(u.name || u.email)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: F, fontSize: "1.2rem", color: "var(--adm-text)", margin: 0 }}>{u.name || "Sin nombre"}</h2>
              <p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text2)", margin: "2px 0 0" }}>{u.email}</p>
            </div>
            <span style={{ padding: "4px 12px", borderRadius: 50, fontFamily: F, fontSize: "0.72rem", fontWeight: 600, background: `${eng.color}18`, color: eng.color }}>{eng.label}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 2px", textTransform: "uppercase" }}>Registro</p><p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0 }}>{new Date(u.createdAt).toLocaleDateString("es-CL")}</p></div>
            <div><p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 2px", textTransform: "uppercase" }}>Cumpleaños</p><p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0 }}>{u.birthDate ? new Date(u.birthDate).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : "—"}</p></div>
            <div><p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 2px", textTransform: "uppercase" }}>Dieta</p><p style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", margin: 0 }}>{DIET_LABELS[u.dietType || ""] || "—"}</p></div>
          </div>

          {u.restrictions?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: "0 0 4px", textTransform: "uppercase" }}>Restricciones</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{u.restrictions.map(r => <span key={r} style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 50, background: "rgba(232,85,48,0.08)", color: "#e85530", fontFamily: FB }}>{r}</span>)}</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {u.verifiedAt && <span style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "rgba(22,163,74,0.08)", color: "#16a34a", fontFamily: F, fontWeight: 600 }}>Verificado</span>}
            {u.unsubscribedAt && <span style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 50, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontFamily: F, fontWeight: 600 }}>Desuscrito</span>}
          </div>
        </div>

        {/* Activity stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }} className="adm-grid-2">
          {[
            { label: "Sesiones", value: selectedUser.sessions.length, color: GOLD },
            { label: "Favoritos", value: selectedUser.favorites.length, color: "#ef4444" },
            { label: "Interacciones", value: selectedUser.interactions.length, color: "#7fbfdc" },
            { label: "Campañas", value: selectedUser.campaigns.length, color: "#16a34a" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "12px 14px" }}>
              <p style={{ fontFamily: F, fontSize: "1.3rem", color: s.color, fontWeight: 700, margin: 0 }}>{s.value}</p>
              <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Restaurants visited */}
        {selectedUser.restaurants.length > 0 && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Locales visitados</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedUser.restaurants.map(r => <span key={r.id} style={{ fontSize: "0.78rem", padding: "4px 12px", borderRadius: 50, background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: F, fontWeight: 600 }}>{r.name}</span>)}
            </div>
          </div>
        )}

        {/* Favorites */}
        {selectedUser.favorites.length > 0 && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Platos favoritos</h3>
            {selectedUser.favorites.map((f: any) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                {f.dish?.photos?.[0] && <img src={f.dish.photos[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{f.dish?.name || "?"}</span>
                <span style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)" }}>{f.restaurant?.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent sessions */}
        {selectedUser.sessions.length > 0 && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Últimas sesiones</h3>
            {selectedUser.sessions.map((s: any) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{s.restaurant?.name}</span>
                <span style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)" }}>{new Date(s.startedAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} {new Date(s.startedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}

        {/* Campaigns */}
        {selectedUser.campaigns.length > 0 && (
          <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 14, padding: "16px 20px" }}>
            <h3 style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Campañas recibidas</h3>
            {selectedUser.campaigns.map((c: any) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--adm-card-border)" }}>
                <span style={{ fontFamily: FB, fontSize: "0.82rem", color: "var(--adm-text)", flex: 1 }}>{c.campaign?.name || "?"}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {c.openedAt && <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, background: "rgba(22,163,74,0.08)", color: "#16a34a", fontFamily: F }}>Abierto</span>}
                  {c.clickedAt && <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, background: "rgba(244,166,35,0.08)", color: GOLD, fontFamily: F }}>Click</span>}
                  {!c.openedAt && <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.04)", color: "var(--adm-text3)", fontFamily: F }}>Enviado</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: F, fontSize: "1.4rem", color: GOLD, margin: "0 0 4px" }}>Usuarios</h1>
      <p style={{ fontFamily: F, fontSize: "0.78rem", color: "var(--adm-text2)", margin: "0 0 20px" }}>Usuarios registrados en la carta QR · {total} total</p>

      {/* Global stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }} className="adm-grid-2">
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px" }}>
          <p style={{ fontFamily: F, fontSize: "1.5rem", color: GOLD, fontWeight: 700, margin: 0 }}>{total}</p>
          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>Total</p>
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px" }}>
          <p style={{ fontFamily: F, fontSize: "1.5rem", color: "#16a34a", fontWeight: 700, margin: 0 }}>{total > 0 ? Math.round(verifiedCount / filtered.length * 100) : 0}%</p>
          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>Verificados</p>
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px" }}>
          <p style={{ fontFamily: F, fontSize: "1.5rem", color: "#7fbfdc", fontWeight: 700, margin: 0 }}>{birthdayCount}</p>
          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>Con cumpleaños</p>
        </div>
        <div style={{ background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, padding: "14px" }}>
          <p style={{ fontFamily: F, fontSize: "1.5rem", color: "var(--adm-text)", fontWeight: 700, margin: 0 }}>{Object.entries(dietCounts).filter(([k]) => k !== "OMNIVORE").reduce((s, [, v]) => s + v, 0)}</p>
          <p style={{ fontFamily: F, fontSize: "0.68rem", color: "var(--adm-text3)", margin: 0 }}>Dieta especial</p>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 200, padding: "10px 14px", background: "var(--adm-hover)", border: "1px solid var(--adm-card-border)", borderRadius: 10, color: "var(--adm-text)", fontFamily: F, fontSize: "0.85rem", outline: "none" }}
        />
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {([
          { key: "all" as const, label: "Todos" },
          { key: "verified" as const, label: "Verificados" },
          { key: "birthday" as const, label: "Con cumpleaños" },
          { key: "diet" as const, label: "Dieta especial" },
          { key: "unsubscribed" as const, label: "Desuscritos" },
        ]).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontFamily: F, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", background: filter === f.key ? `${GOLD}18` : "var(--adm-hover)", color: filter === f.key ? GOLD : "var(--adm-text3)" }}>{f.label}</button>
        ))}
      </div>

      {/* Users list */}
      {loading ? <SkeletonLoading type="list" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(u => {
            const eng = engagementLevel(u._count.sessions * 2 + u._count.dishFavorites * 3 + u._count.interactions);
            return (
              <button key={u.id} onClick={() => openDetail(u.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--adm-card)", border: "1px solid var(--adm-card-border)", borderRadius: 12, cursor: "pointer", width: "100%", textAlign: "left" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${eng.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: eng.color, fontFamily: F, fontSize: "0.82rem", fontWeight: 700, flexShrink: 0 }}>
                  {(u.name || u.email)[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || u.email.split("@")[0]}</p>
                    {u.verifiedAt && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />}
                    {u.dietType && u.dietType !== "OMNIVORE" && <span style={{ fontSize: "0.65rem", flexShrink: 0 }}>{DIET_LABELS[u.dietType]?.split(" ")[0]}</span>}
                  </div>
                  <p style={{ fontFamily: F, fontSize: "0.7rem", color: "var(--adm-text3)", margin: 0 }}>{u.email}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: F, fontSize: "0.72rem", color: "var(--adm-text2)", margin: 0 }}>{u._count.sessions} ses</p>
                  <p style={{ fontFamily: F, fontSize: "0.65rem", color: "var(--adm-text3)", margin: 0 }}>{timeAgo(u.createdAt)}</p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p style={{ fontFamily: F, fontSize: "0.85rem", color: "var(--adm-text3)", textAlign: "center", padding: 40 }}>Sin usuarios</p>}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: page <= 1 ? "transparent" : "var(--adm-hover)", color: page <= 1 ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", cursor: page <= 1 ? "default" : "pointer" }}>Anterior</button>
          <span style={{ fontFamily: F, fontSize: "0.8rem", color: "var(--adm-text2)", padding: "8px 12px" }}>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--adm-card-border)", background: page >= pages ? "transparent" : "var(--adm-hover)", color: page >= pages ? "var(--adm-text3)" : "var(--adm-text)", fontFamily: F, fontSize: "0.8rem", cursor: page >= pages ? "default" : "pointer" }}>Siguiente</button>
        </div>
      )}

      {detailLoading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 32 }}><SkeletonLoading type="form" /></div>
        </div>
      )}
    </div>
  );
}
