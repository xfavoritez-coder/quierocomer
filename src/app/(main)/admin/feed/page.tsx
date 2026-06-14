"use client"

import { useState, useEffect, useCallback } from "react"

const GOLD = "#F4A623"

type UserOverview = {
  id: string
  fingerprint: string
  displayName: string | null
  totalInteractions: number
  likes: number
  passes: number
  taps: number
  topCategory: string | null
  diet: string
  lastSeenAt: string | null
  createdAt: string
}

type UserDetail = {
  user: any
  interactions: any[]
  actionCounts: Record<string, number>
  hourlyDistribution: { hour: number; count: number }[]
  categoryBreakdown: { category: string; count: number }[]
  hasGustoVector: boolean
}

export default function FeedAdminPage() {
  const [data, setData] = useState<{ totalUsers: number; activeToday: number; totalInteractions: number; users: UserOverview[] } | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/feed")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadUser = useCallback((userId: string) => {
    setSelectedUser(userId)
    setDetail(null)
    fetch(`/api/admin/feed?userId=${userId}`)
      .then(r => r.json())
      .then(setDetail)
      .catch(() => {})
  }, [])

  if (loading) return <div style={{ padding: 32, color: "#888" }}>Cargando...</div>
  if (!data) return <div style={{ padding: 32, color: "#888" }}>Error al cargar datos</div>

  // Detail view
  if (selectedUser && detail) {
    const u = detail.user
    const catScores = (u.categoryScores as Record<string, number>) ?? {}
    const kwScores = (u.keywordScores as Record<string, number>) ?? {}
    const topCats = Object.entries(catScores).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 8)
    const topKws = Object.entries(kwScores).filter(([, s]) => (s as number) >= 3).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10)
    const maxHourly = Math.max(...detail.hourlyDistribution.map(h => h.count), 1)

    return (
      <div>
        <button onClick={() => { setSelectedUser(null); setDetail(null) }} style={{
          background: "none", border: "none", color: GOLD, cursor: "pointer",
          fontSize: 14, fontWeight: 600, marginBottom: 16, padding: 0,
        }}>
          ← Volver a todos
        </button>

        {/* User header */}
        <div style={{
          background: "#1A1A1A", borderRadius: 12, padding: 20, marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `${GOLD}20`, border: `2px solid ${GOLD}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: GOLD, fontWeight: 700,
          }}>
            {u.displayName ? u.displayName.charAt(0).toUpperCase() : "#"}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#fff" }}>
              {u.displayName || `#${u.fingerprint.slice(-6)}`}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
              {u.totalInteractions} interacciones · Desde {new Date(u.createdAt).toLocaleDateString("es-CL")}
              {u.lastSeenAt && ` · Último: ${timeAgo(u.lastSeenAt)}`}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <Tag label={u.isVegan ? "Vegano" : u.isVegetarian ? "Vegetariano" : u.isGlutenFree ? "Sin gluten" : "Come de todo"} />
              {detail.hasGustoVector && <Tag label="Vector activo" color="#4ade80" />}
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }} className="adm-grid-2">
          <StatCard label="Likes" value={detail.actionCounts.LIKE ?? 0} color="#4ade80" />
          <StatCard label="Passes" value={detail.actionCounts.PASS ?? 0} color="#ef4444" />
          <StatCard label="Taps" value={detail.actionCounts.TAP ?? 0} color="#60a5fa" />
          <StatCard label="Saves" value={detail.actionCounts.SAVE ?? 0} color={GOLD} />
        </div>

        {/* Two column: categories + keywords */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }} className="adm-grid-2">
          {/* Categories */}
          <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Categorías que le gustan</h3>
            {topCats.length > 0 ? topCats.map(([cat, score]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #222" }}>
                <span style={{ fontSize: 13, color: "#fff" }}>{cat}</span>
                <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>{score as number}</span>
              </div>
            )) : <p style={{ fontSize: 13, color: "#555" }}>Sin datos aún</p>}
          </div>

          {/* Keywords */}
          <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Ingredientes favoritos</h3>
            {topKws.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {topKws.map(([kw, score]) => (
                  <span key={kw} style={{
                    padding: "4px 10px", borderRadius: 12, fontSize: 12,
                    background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: "#fff",
                  }}>
                    {kw} <span style={{ color: GOLD }}>{score as number}</span>
                  </span>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: "#555" }}>Sin datos aún</p>}
          </div>
        </div>

        {/* Hourly distribution */}
        <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Actividad por hora</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
            {Array.from({ length: 24 }, (_, h) => {
              const d = detail.hourlyDistribution.find(x => x.hour === h)
              const count = d?.count ?? 0
              const pct = count / maxHourly
              return (
                <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{
                    width: "100%", height: `${Math.max(pct * 60, 2)}px`,
                    background: count > 0 ? GOLD : "#2A2A2A", borderRadius: 2,
                  }} />
                  <span style={{ fontSize: 8, color: "#555" }}>{h}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category breakdown (likes) */}
        {detail.categoryBreakdown.length > 0 && (
          <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Likes por categoría</h3>
            {detail.categoryBreakdown.map(c => {
              const maxCat = detail.categoryBreakdown[0]?.count ?? 1
              return (
                <div key={c.category} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: "#fff" }}>{c.category}</span>
                    <span style={{ fontSize: 12, color: "#888" }}>{c.count}</span>
                  </div>
                  <div style={{ height: 4, background: "#2A2A2A", borderRadius: 2 }}>
                    <div style={{ height: "100%", background: GOLD, borderRadius: 2, width: `${(c.count / maxCat) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Interaction timeline */}
        <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Últimas interacciones</h3>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {detail.interactions.map((inter, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: "1px solid #1f1f1f",
              }}>
                <span style={{ fontSize: 16, width: 28, textAlign: "center" }}>
                  {inter.action === "LIKE" ? "👍" : inter.action === "PASS" ? "👎" : inter.action === "TAP" ? "👁" : inter.action === "SAVE" ? "💾" : "·"}
                </span>
                {inter.dish?.photos?.[0] && (
                  <img src={inter.dish.photos[0]} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inter.dish?.name ?? "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>
                    {inter.category} · ${inter.price?.toLocaleString("es-CL") ?? "—"}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: "#555", flexShrink: 0 }}>
                  {timeAgo(inter.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Overview
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
        Feed B2C — Usuarios
      </h1>

      {/* Global stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }} className="adm-grid-2">
        <StatCard label="Usuarios totales" value={data.totalUsers} color={GOLD} />
        <StatCard label="Activos hoy" value={data.activeToday} color="#4ade80" />
        <StatCard label="Interacciones totales" value={data.totalInteractions} color="#60a5fa" />
      </div>

      {/* Users table */}
      <div style={{ background: "#1A1A1A", borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
          padding: "12px 16px", borderBottom: "1px solid #2A2A2A",
          fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          <span>Usuario</span>
          <span style={{ textAlign: "center" }}>Interacciones</span>
          <span style={{ textAlign: "center" }}>👍</span>
          <span style={{ textAlign: "center" }}>👎</span>
          <span>Le gusta</span>
          <span>Última visita</span>
        </div>

        {data.users.map(user => (
          <button key={user.id} onClick={() => loadUser(user.id)} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
            padding: "12px 16px", borderBottom: "1px solid #1f1f1f",
            background: "none", border: "none", width: "100%", cursor: "pointer",
            textAlign: "left", transition: "background 0.15s",
          }}
            onMouseOver={e => (e.currentTarget.style.background = "#222")}
            onMouseOut={e => (e.currentTarget.style.background = "none")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `${GOLD}15`, border: `1px solid ${GOLD}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: GOLD, fontWeight: 700, flexShrink: 0,
              }}>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : "#"}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>
                  {user.displayName || `#${user.fingerprint}`}
                </p>
                <p style={{ fontSize: 10, color: "#555", margin: "1px 0 0" }}>{user.diet}</p>
              </div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: GOLD, textAlign: "center", alignSelf: "center" }}>
              {user.totalInteractions}
            </span>
            <span style={{ fontSize: 13, color: "#4ade80", textAlign: "center", alignSelf: "center" }}>
              {user.likes}
            </span>
            <span style={{ fontSize: 13, color: "#ef4444", textAlign: "center", alignSelf: "center" }}>
              {user.passes}
            </span>
            <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>
              {user.topCategory ?? "—"}
            </span>
            <span style={{ fontSize: 11, color: "#555", alignSelf: "center" }}>
              {user.lastSeenAt ? timeAgo(user.lastSeenAt) : "—"}
            </span>
          </button>
        ))}

        {data.users.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#555" }}>
            No hay usuarios aún
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16, textAlign: "center" }}>
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: "0 0 4px" }}>{value.toLocaleString("es-CL")}</p>
      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{label}</p>
    </div>
  )
}

function Tag({ label, color = GOLD }: { label: string; color?: string }) {
  return (
    <span style={{
      padding: "3px 8px", borderRadius: 8, fontSize: 11, fontWeight: 500,
      background: `${color}15`, border: `1px solid ${color}30`, color,
    }}>
      {label}
    </span>
  )
}

function timeAgo(date: string): string {
  const now = Date.now()
  const d = new Date(date).getTime()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}
