'use client'

// Centro de pedidos DENTRO del POS: mismo HEADER del POS (PosTopBar: logo + local
// + tabs con badges + menú), y debajo la vista del Centro de pedidos (sin sidebar,
// sin su título/back propio), tomando el local de usePosRestaurant.
import CentroPedidosPage from '@/app/(panel)/panel/centro-pedidos/page'
import PosTopBar from '../components/PosTopBar'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosCentroPedidosPage() {
  const { restaurantId } = usePosRestaurant()
  return (
    <div className="pos-shell">
      <PosTopBar active="centro" />
      <div className="pos-centro-wrap theme-light">
        {/* theme-light aporta las variables --adm-* que usa el Centro de pedidos. */}
        <style>{`.pos-centro-wrap{flex:1;min-height:0;padding:14px 20px 40px;background:var(--adm-bg,#fff);overflow-y:auto}@media(max-width:767px){.pos-centro-wrap{padding:10px 12px}}`}</style>
        <CentroPedidosPage
          restaurantId={restaurantId}
          tomarHref="/pos/tomar-pedido"
          kdsHref="/pos/kds"
          hideBack
          hideTitle
        />
      </div>
    </div>
  )
}
