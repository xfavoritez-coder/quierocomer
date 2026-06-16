'use client'

import type { FeedDish } from '../types'
import FeedFooter from './FeedFooter'

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
  const saved = savedDishes ?? []
  const viewed = viewedDishes ?? []

  return (
    <div style={{ paddingBottom: 100 }}>

      <div style={{ padding: '10px 16px 0' }}>
        <h1 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 22, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: '0 0 16px' }}>
          Mi perfil
        </h1>

        {/* ─── Guardados ─── */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Guardados
            </h3>
            {saved.length > 3 && onViewAllSaved && (
              <button onClick={onViewAllSaved} style={{
                background: 'none', border: 'none', color: '#F4A623', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
              }}>
                Ver todos ({saved.length})
              </button>
            )}
          </div>

          {saved.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {saved.slice(0, 6).map((d, i) => (
                <div key={d.id} onClick={() => onDishTap?.(d)} style={{
                  position: 'relative', aspectRatio: '1', overflow: 'hidden',
                  borderRadius: 10, cursor: 'pointer',
                  background: isDark ? '#1a1a1a' : '#e8e8e8',
                }}>
                  {d.fotoUrl ? (
                    <img src={d.fotoUrl} alt={d.nombre}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading={i < 3 ? 'eager' : 'lazy'} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, padding: 4, textAlign: 'center',
                      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    }}>
                      {d.nombre}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
                    padding: '18px 6px 6px',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.nombre}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '28px 20px', borderRadius: 14, textAlign: 'center',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', margin: 0 }}>
                Guarda platos tocando el corazón
              </p>
            </div>
          )}
        </section>

        {/* ─── Vistos recientemente ─── */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Vistos recientemente
            </h3>
          </div>

          {viewed.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
              {viewed.slice(0, 20).map((d, i) => (
                <div key={d.id} onClick={() => onDishTap?.(d)} style={{
                  position: 'relative', aspectRatio: '1', overflow: 'hidden',
                  borderRadius: 10, cursor: 'pointer',
                  background: isDark ? '#1a1a1a' : '#e8e8e8',
                }}>
                  {d.fotoUrl ? (
                    <img src={d.fotoUrl} alt={d.nombre}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading={i < 3 ? 'eager' : 'lazy'} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, padding: 4, textAlign: 'center',
                      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    }}>
                      {d.nombre}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
                    padding: '18px 6px 6px',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.nombre}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '28px 20px', borderRadius: 14, textAlign: 'center',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', margin: 0 }}>
                Los platos que abras aparecerán aquí
              </p>
            </div>
          )}
        </section>

      </div>

      <FeedFooter isDark={isDark} />
    </div>
  )
}

