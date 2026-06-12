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
  const DishRow = ({ dish }: { dish: FeedDish }) => (
    <button
      onClick={() => onDishTap(dish)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors text-left"
    >
      {dish.fotoUrl ? (
        <img
          src={dish.fotoUrl}
          alt={dish.nombre}
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-white/30 text-xs">
          {dish.categoriaNorm.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-white text-sm font-semibold truncate"
          style={{ fontFamily: 'var(--font-feed-display), serif' }}
        >
          {dish.nombre}
        </p>
        <p className="text-[#F4A623] text-xs font-medium">
          ${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}
        </p>
        <p className="text-white/40 text-xs truncate">{dish.restaurante}</p>
      </div>
      <a
        href={`/carta/${dish.restauranteSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-white/30 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 flex-shrink-0"
      >
        Ver carta
      </a>
    </button>
  )

  const isEmpty = antojos.length === 0 && saved.length === 0

  return (
    <div className="px-4 pb-24 pt-2">
      {isEmpty ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-white/20 text-4xl">💾</p>
          <p className="text-white/40 text-sm">No has guardado nada todavía</p>
          <p className="text-white/20 text-xs">
            Explora el feed y guarda los platos que te llamen la atención
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Antojos */}
          {antojos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                <span>🤤</span> Se me antoja ahora
                <span className="text-white/20">({antojos.length})</span>
              </h2>
              <div className="space-y-2">
                {antojos.map(dish => (
                  <DishRow key={dish.id} dish={dish} />
                ))}
              </div>
            </div>
          )}

          {/* Saved */}
          {saved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                <span>💾</span> Para después
                <span className="text-white/20">({saved.length})</span>
              </h2>
              <div className="space-y-2">
                {saved.map(dish => (
                  <DishRow key={dish.id} dish={dish} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
