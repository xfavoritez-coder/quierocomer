'use client'

import type { FeedDish } from '../types'

export default function ProfileView({
  savedDishes,
  viewedDishes,
  onDishTap,
  onViewAllSaved,
  onViewAllViewed,
  isDark,
}: {
  savedDishes?: FeedDish[]
  viewedDishes?: FeedDish[]
  onDishTap?: (d: FeedDish) => void
  onViewAllSaved?: () => void
  onViewAllViewed?: () => void
  isDark?: boolean
}) {
  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* ─── Header ─── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 26, fontWeight: 800, color: isDark ? '#fff' : '#111', margin: '0 0 4px',
        }}>
          Mi perfil
        </h2>
        <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', margin: 0 }}>
          Tus platos guardados y vistos
        </p>
      </div>

      {/* ─── Guardados ─── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: 0 }}>
            Guardados
          </h3>
          {savedDishes && savedDishes.length > 3 && onViewAllSaved && (
            <button onClick={onViewAllSaved} style={{
              background: 'none', border: 'none', color: '#F4A623', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Ver todos ({savedDishes.length})
            </button>
          )}
        </div>
        {savedDishes && savedDishes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedDishes.slice(0, 3).map(d => (
              <DishRow key={d.id} dish={d} onTap={onDishTap} isDark={isDark} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', margin: 0 }}>
            Guarda platos tocando el corazón en el detalle
          </p>
        )}
      </div>

      {/* ─── Vistos recientemente ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: 0 }}>
            Vistos recientemente
          </h3>
        </div>
        {viewedDishes && viewedDishes.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {viewedDishes.slice(0, 9).map((d, i) => (
              <div key={d.id} onClick={() => onDishTap?.(d)} style={{
                position: 'relative', aspectRatio: '1', overflow: 'hidden',
                cursor: 'pointer', background: isDark ? '#1a1a1a' : '#e8e8e8',
              }}>
                {d.fotoUrl ? (
                  <img src={d.fotoUrl} alt={d.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading={i < 3 ? 'eager' : 'lazy'}
                    fetchPriority={i < 3 ? 'high' : 'low'} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    fontSize: 10, padding: 4, textAlign: 'center',
                  }}>
                    {d.nombre}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', margin: 0 }}>
            Los platos que abras aparecerán aquí
          </p>
        )}
      </div>
    </div>
  )
}

function DishRow({ dish, onTap, isDark }: { dish: FeedDish; onTap?: (d: FeedDish) => void; isDark?: boolean }) {
  return (
    <div onClick={() => onTap?.(dish)} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    }}>
      {dish.fotoUrl && (
        <img src={dish.fotoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#fff' : '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.nombre}</p>
        <p style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', margin: '2px 0 0' }}>{dish.restaurante}</p>
      </div>
      <span style={{ fontSize: 12, color: '#F4A623', fontWeight: 600, flexShrink: 0 }}>${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}</span>
    </div>
  )
}
