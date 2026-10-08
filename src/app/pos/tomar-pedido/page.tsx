'use client'

// Tomar Pedido dentro del POS: embebe el MISMO tomador de Centro de pedidos,
// tomando el local de usePosRestaurant (no de la sesión del panel). El enlace
// "atrás" vuelve al POS (grilla de mesas).
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosTomarPedidoPage() {
  const { restaurantId } = usePosRestaurant()
  return <TomarPedidos restaurantId={restaurantId} backHref="/pos" backLabel="Mesas" />
}
