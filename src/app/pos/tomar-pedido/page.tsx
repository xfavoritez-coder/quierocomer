'use client'

// Tomar Pedido (retiro/delivery/venta rápida) dentro del POS: embebe el MISMO
// tomador de Centro de pedidos, tomando el local de usePosRestaurant. El modo
// MESA vive en su propia ruta `/pos/mesa/<label>` (no acá) para que el Router
// Cache de Next no mezcle el parámetro de mesa con esta ruta de retiro.
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosTomarPedidoPage() {
  const { restaurantId } = usePosRestaurant()
  return (
    <div className="pos-tomar-wrap">
      <style>{`.pos-tomar-wrap{padding:24px 32px;min-height:100dvh;background:#f8fafc}@media(max-width:767px){.pos-tomar-wrap{padding:16px}}`}</style>
      {/* En el POS NO se envía a Toteat: este POS reemplaza a Toteat. El pedido
          igual queda en el Centro de pedidos (mirror) y en los chips del POS. */}
      <TomarPedidos restaurantId={restaurantId} backHref="/pos" backLabel="Mesas" disableToteat />
    </div>
  )
}
