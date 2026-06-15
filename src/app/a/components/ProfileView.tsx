'use client'

import type { FeedDish } from '../types'

export default function ProfileView({
  savedDishes,
  viewedDishes,
  onDishTap,
  onViewAllSaved,
  onViewAllViewed,
}: {
  savedDishes?: FeedDish[]
  viewedDishes?: FeedDish[]
  onDishTap?: (d: FeedDish) => void
  onViewAllSaved?: () => void
  onViewAllViewed?: () => void
}) {
  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* ─── Guardados ─── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
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
              <DishRow key={d.id} dish={d} onTap={onDishTap} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            Guarda platos tocando el corazón en el detalle
          </p>
        )}
      </div>

      {/* ─── Vistos recientemente ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
            Vistos recientemente
          </h3>
          {viewedDishes && viewedDishes.length > 9 && onViewAllViewed && (
            <button onClick={onViewAllViewed} style={{
              background: 'none', border: 'none', color: '#F4A623', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Ver todos ({viewedDishes.length})
            </button>
          )}
        </div>
        {viewedDishes && viewedDishes.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {viewedDishes.slice(0, 9).map(d => (
              <div key={d.id} onClick={() => onDishTap?.(d)} style={{
                position: 'relative', aspectRatio: '1', overflow: 'hidden',
                cursor: 'pointer', background: '#1a1a1a',
              }}>
                {d.fotoUrl ? (
                  <img src={d.fotoUrl} alt={d.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy" />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: 10, padding: 4, textAlign: 'center',
                  }}>
                    {d.nombre}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            Los platos que abras aparecerán aquí
          </p>
        )}
      </div>
    </div>
  )
}

function DishRow({ dish, onTap }: { dish: FeedDish; onTap?: (d: FeedDish) => void }) {
  return (
    <div onClick={() => onTap?.(dish)} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
      background: 'rgba(255,255,255,0.03)',
    }}>
      {dish.fotoUrl && (
        <img src={dish.fotoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.nombre}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>{dish.restaurante}</p>
      </div>
      <span style={{ fontSize: 12, color: '#F4A623', fontWeight: 600, flexShrink: 0 }}>${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}</span>
    </div>
  )
}
