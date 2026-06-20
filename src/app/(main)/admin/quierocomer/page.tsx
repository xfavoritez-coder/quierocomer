"use client"

import { useState, useEffect } from "react"

const GOLD = "#F4A623"

type DishRow = {
  dishId: string
  dishName: string
  restaurantName: string
  count: number
  photoUrl: string | null
}

type Stats = {
  uniqueUsers: number
  totalViews: number
  totalLikes: number
  totalDislikes: number
  totalSaves: number
}

type AnalyticsData = {
  stats: Stats
  topViewed: DishRow[]
  topLiked: DishRow[]
  topChosen: DishRow[]
  topSaved: DishRow[]
  searches: { query: string; count: number }[]
  hourly: { hour: number; count: number }[]
}

export default function QuieroComerAdminPage() {
  const [date, setDate] = useState<string>(() => {
    // Today in Chile (UTC-4)
    const now = new Date()
    const chileNow = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    return chileNow.toISOString().slice(0, 10)
  })
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/admin/quierocomer?date=${date}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [date])

  return (
    <div style={{ color: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
          QuieroComer — Actividad
        </h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            background: "#1A1A1A", border: "1px solid #333", color: "#fff",
            borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer",
          }}
        />
      </div>

      {loading && (
        <div style={{ padding: 32, color: "#888", textAlign: "center" }}>Cargando...</div>
      )}
      {error && !loading && (
        <div style={{ padding: 32, color: "#ef4444", textAlign: "center" }}>Error al cargar datos</div>
      )}

      {data && !loading && (
        <>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }} className="adm-grid-2">
            <StatCard icon="👤" label="Usuarios únicos" value={data.stats.uniqueUsers} color={GOLD} />
            <StatCard icon="👁️" label="Platos vistos" value={data.stats.totalViews} color="#60a5fa" />
            <StatCard icon="❤️" label="Likes" value={data.stats.totalLikes} color="#4ade80" />
            <StatCard icon="👎" label="No me gusta" value={data.stats.totalDislikes} color="#ef4444" />
            <StatCard icon="💾" label="Guardados" value={data.stats.totalSaves} color="#a78bfa" />
          </div>

          {/* Searches + Hourly chart */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }} className="adm-grid-2">
            {/* Searches */}
            <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Búsquedas de hoy</h3>
              {data.searches.length === 0 ? (
                <p style={{ fontSize: 13, color: "#555", margin: 0 }}>Sin búsquedas registradas</p>
              ) : (
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {data.searches.map((s, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: "1px solid #222",
                    }}>
                      <span style={{ fontSize: 13, color: "#ddd" }}>{s.query}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#111",
                        background: GOLD, borderRadius: 20, padding: "2px 8px", minWidth: 24, textAlign: "center",
                      }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hourly chart */}
            <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#888" }}>Actividad por hora</h3>
              <HourlyChart hourly={data.hourly} />
            </div>
          </div>

          {/* Top Viewed */}
          <DishTable title="Platos más vistos hoy" rows={data.topViewed} color="#60a5fa" />

          {/* Top Chosen */}
          <DishTable title='Más elegidos ("select card" — Antojo)' rows={data.topChosen} color={GOLD} />

          {/* Top Liked */}
          <DishTable title="Más gustados (Like)" rows={data.topLiked} color="#4ade80" />

          {/* Top Saved */}
          <DishTable title="Más guardados" rows={data.topSaved} color="#a78bfa" />
        </>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1A1A1A", borderRadius: 12, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: "0 0 4px" }}>{value.toLocaleString("es-CL")}</p>
      <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{label}</p>
    </div>
  )
}

function HourlyChart({ hourly }: { hourly: { hour: number; count: number }[] }) {
  const max = Math.max(...hourly.map(h => h.count), 1)
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90 }}>
      {hourly.map(({ hour, count }) => {
        const pct = count / max
        return (
          <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              width: "100%",
              height: `${Math.max(pct * 70, count > 0 ? 3 : 0)}px`,
              background: count > 0 ? GOLD : "#2A2A2A",
              borderRadius: 2,
            }} />
            <span style={{ fontSize: 7, color: "#555" }}>{hour}</span>
          </div>
        )
      })}
    </div>
  )
}

function DishTable({ title, rows, color }: { title: string; rows: DishRow[]; color: string }) {
  if (rows.length === 0) return null
  return (
    <div style={{ background: "#1A1A1A", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #2A2A2A" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#fff" }}>{title}</h3>
      </div>
      {/* Header */}
      <div style={{
        display: "grid", gridTemplateColumns: "40px 1fr 1fr 80px",
        padding: "10px 16px", borderBottom: "1px solid #222",
        fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        <span></span>
        <span>Plato</span>
        <span>Restaurante</span>
        <span style={{ textAlign: "right" }}>Cantidad</span>
      </div>
      {rows.map((row, i) => (
        <div key={row.dishId} style={{
          display: "grid", gridTemplateColumns: "40px 1fr 1fr 80px",
          padding: "10px 16px", borderBottom: i < rows.length - 1 ? "1px solid #1f1f1f" : "none",
          alignItems: "center",
        }}>
          {/* Photo */}
          <div>
            {row.photoUrl ? (
              <img
                src={row.photoUrl}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 6, background: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                🍽
              </div>
            )}
          </div>
          {/* Dish name */}
          <span style={{ fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
            {row.dishName}
          </span>
          {/* Restaurant */}
          <span style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
            {row.restaurantName}
          </span>
          {/* Count */}
          <span style={{ fontSize: 16, fontWeight: 700, color, textAlign: "right" }}>
            {row.count.toLocaleString("es-CL")}
          </span>
        </div>
      ))}
    </div>
  )
}
