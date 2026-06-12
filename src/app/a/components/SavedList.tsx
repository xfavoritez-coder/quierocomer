'use client'

import type { FeedDish } from '../types'

export default function SavedList({
  antojos,
  saved,
  onDishTap,
  onRemove,
}: {
  antojos: FeedDish[]
  saved: FeedDish[]
  onDishTap: (dish: FeedDish) => void
  onRemove: (dishId: string) => void
}) {
  const isEmpty = antojos.length === 0 && saved.length === 0

  if (isEmpty) {
    return (
      <div style={{ padding: '80px 20px 100px', textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>❤️</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 6px' }}>No tienes favoritos todavía</p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Marca platos con el corazón para guardarlos aquí</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 16px 100px' }}>
      {/* Antojos */}
      {antojos.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🤤</span> Se me antoja ahora
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>({antojos.length})</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {antojos.map(dish => <DishRow key={dish.id} dish={dish} onTap={onDishTap} />)}
          </div>
        </div>
      )}

      {/* Saved */}
      {saved.length > 0 && (
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💾</span> Para después
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>({saved.length})</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {saved.map(dish => <DishRow key={dish.id} dish={dish} onTap={onDishTap} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function DishRow({ dish, onTap }: { dish: FeedDish; onTap: (d: FeedDish) => void }) {
  return (
    <div
      onClick={() => onTap(dish)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 14,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
      }}
    >
      {dish.fotoUrl ? (
        <img src={dish.fotoUrl} alt={dish.nombre}
          style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#1a1a1a' }} />
      ) : (
        <div style={{
          width: 52, height: 52, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 18,
        }}>
          {dish.categoriaNorm.charAt(0)}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 14, fontWeight: 600, color: '#fff', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {dish.nombre}
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#F4A623', margin: '2px 0' }}>
          ${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}
        </p>
        <p style={{
          fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {dish.restaurante}
        </p>
      </div>
      <a
        href={`/carta/${dish.restauranteSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
          padding: '6px 12px', borderRadius: 20,
          background: 'rgba(255,255,255,0.06)', textDecoration: 'none',
        }}
      >
        Ver carta
      </a>
    </div>
  )
}
