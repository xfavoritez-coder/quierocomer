'use client'

// Centro de pedidos DENTRO del POS: embebe la MISMA vista del Centro de pedidos
// (sin el sidebar del panel, porque usa el layout del POS), tomando el local de
// usePosRestaurant. El "atrás" vuelve al POS y "Tomar pedidos" va al tomador del POS.
import CentroPedidosPage from '@/app/(panel)/panel/centro-pedidos/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosCentroPedidosPage() {
  const { restaurantId } = usePosRestaurant()
  return (
    <div className="pos-centro-wrap theme-light">
      {/* theme-light aporta las variables --adm-* que usa el Centro de pedidos. */}
      <style>{`.pos-centro-wrap{padding:16px 20px 40px;min-height:100dvh;background:var(--adm-bg,#fff);overflow-y:auto}@media(max-width:767px){.pos-centro-wrap{padding:12px}}`}</style>
      <CentroPedidosPage
        restaurantId={restaurantId}
        backHref="/pos"
        backLabel="POS"
        tomarHref="/pos/tomar-pedido"
      />
    </div>
  )
}
