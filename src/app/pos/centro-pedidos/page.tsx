'use client'

// Centro de pedidos DENTRO del POS: mismo HEADER del POS (logo + local + tabs),
// y debajo la vista del Centro de pedidos (sin sidebar, sin su back propio),
// tomando el local de usePosRestaurant. Todo queda dentro de la app instalada.
import CentroPedidosPage from '@/app/(panel)/panel/centro-pedidos/page'
import PosHeader from '../components/PosHeader'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import { usePosNav } from '../lib/usePosNav'

const TABS: { id: 'mesas' | 'retiro' | 'delivery'; label: string }[] = [
  { id: 'mesas', label: 'Mesas' },
  { id: 'retiro', label: 'Retiro' },
  { id: 'delivery', label: 'Delivery' },
]

export default function PosCentroPedidosPage() {
  const { restaurantId, restaurant } = usePosRestaurant()
  const navigate = usePosNav()

  return (
    <div className="pos-shell">
      <PosHeader
        mode="brand"
        storeName={restaurant?.name}
        branchName={restaurant?.branchName ?? null}
        onBrandClick={() => navigate('/pos')}
        centerSlot={
          <div className="pos-tabs-bar">
            <button className="pos-tab pos-tab-centro on" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Centro de pedidos">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><path d="M9 12h6M9 16h4"/></svg>
              Centro de pedidos
            </button>
            {TABS.map(t => (
              <button key={t.id} className="pos-tab" onClick={() => navigate(`/pos?tab=${t.id}`)}>{t.label}</button>
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

      <div className="pos-centro-wrap theme-light">
        {/* theme-light aporta las variables --adm-* que usa el Centro de pedidos. */}
        <style>{`.pos-centro-wrap{flex:1;min-height:0;padding:16px 20px 40px;background:var(--adm-bg,#fff);overflow-y:auto}@media(max-width:767px){.pos-centro-wrap{padding:12px}}`}</style>
        <CentroPedidosPage
          restaurantId={restaurantId}
          tomarHref="/pos/tomar-pedido"
          kdsHref="/pos/kds"
          hideBack
        />
      </div>
    </div>
  )
}
