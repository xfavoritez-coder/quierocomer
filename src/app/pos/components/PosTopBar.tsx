'use client'

import { useEffect, useState } from 'react'
import PosHeader from './PosHeader'
import PosMenuDrawer from './PosMenuDrawer'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import { usePosNav } from '../lib/usePosNav'
import { useOpenCashSession } from '@/lib/pos'
import { supabase } from '@/lib/supabase'

type Section = 'mesas' | 'retiro' | 'delivery' | 'centro' | 'none'

// Header IDÉNTICO del POS para las pantallas embebidas (Centro de pedidos, KDS):
// logo + local + tabs con badges + menú hamburguesa. Las tabs navegan a /pos?tab=.
export default function PosTopBar({ active, mesasCount }: { active: Section; mesasCount?: number }) {
  const { restaurantId, restaurant } = usePosRestaurant()
  const navigate = usePosNav()
  const cashSession = useOpenCashSession(restaurantId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [counts, setCounts] = useState<{ retiro: number; delivery: number }>({ retiro: 0, delivery: 0 })

  useEffect(() => {
    if (!restaurantId) return
    const fetchCounts = async () => {
      try {
        const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
        const d = await r.json()
        if (r.ok && Array.isArray(d.orders)) {
          const delivery = d.orders.filter((o: any) => o.isDelivery || o.saleType === 'delivery').length
          const retiro = d.orders.filter((o: any) => !o.isDelivery && o.saleType !== 'delivery' && o.saleType !== 'dine-in' && o.saleType !== 'dinein').length
          setCounts({ retiro, delivery })
        }
      } catch { /* noop */ }
    }
    fetchCounts()
    if (!supabase) return
    const ch = supabase
      .channel(`pos-topbar-counts-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'PosOrder', filter: `restaurantId=eq.${restaurantId}` }, fetchCounts)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurantId])

  const badge = (id: 'mesas' | 'retiro' | 'delivery') => (id === 'mesas' ? (mesasCount ?? 0) : counts[id])

  return (
    <>
      <PosHeader
        mode="brand"
        storeName={restaurant?.name}
        branchName={restaurant?.branchName ?? null}
        onMenu={() => setMenuOpen(true)}
        onBrandClick={() => navigate('/pos')}
        centerSlot={
          <div className="pos-tabs-bar">
            <button
              className={`pos-tab pos-tab-centro${active === 'centro' ? ' on' : ''}`}
              onClick={() => navigate('/pos?tab=centro')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Centro de pedidos"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><path d="M9 12h6M9 16h4"/></svg>
              Centro de pedidos
            </button>
            {(['mesas', 'retiro', 'delivery'] as const).map(id => (
              <button key={id} className={`pos-tab${active === id ? ' on' : ''}`} onClick={() => navigate(`/pos?tab=${id}`)}>
                {id === 'mesas' ? 'Mesas' : id === 'retiro' ? 'Retiro' : 'Delivery'}
                {badge(id) ? <span className="pos-tab-badge">{badge(id)}</span> : null}
              </button>
            ))}
            <button
              className="pos-tab pos-tab-order"
              onClick={() => navigate('/pos/tomar-pedido')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--amber)', color: '#fff', fontWeight: 700 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Tomar Pedido
            </button>
          </div>
        }
      />
      {menuOpen && <PosMenuDrawer cashSession={!!cashSession} restaurant={restaurant} onClose={() => setMenuOpen(false)} onNavigate={navigate} />}
    </>
  )
}
