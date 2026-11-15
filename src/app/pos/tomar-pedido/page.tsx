'use client'

// Tomar Pedido dentro del POS: embebe el MISMO tomador de Centro de pedidos,
// tomando el local de usePosRestaurant (no de la sesión del panel). El enlace
// "atrás" vuelve al POS (grilla de mesas). El wrapper replica el padding del
// owl-main del panel para que ambas vistas se vean idénticas.
// Modo mesa: con ?mesa=<label> (y ?order=<posOrderId> para agregar rondas) el
// tomador entra en "modo mesa" (dine-in, sin cliente/pago; el pago es al cobrar).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

export default function PosTomarPedidoPage() {
  const { restaurantId } = usePosRestaurant()
  const router = useRouter()
  // Leemos los parámetros del cliente (sin useSearchParams, para no exigir Suspense).
  const [{ mesa, order }] = useState<{ mesa: string | null; order: string | null }>(() => {
    if (typeof window === 'undefined') return { mesa: null, order: null }
    const p = new URLSearchParams(window.location.search)
    return { mesa: p.get('mesa'), order: p.get('order') }
  })
  return (
    <div className="pos-tomar-wrap">
      <style>{`.pos-tomar-wrap{padding:24px 32px;min-height:100dvh;background:#f8fafc}@media(max-width:767px){.pos-tomar-wrap{padding:16px}}`}</style>
      {/* En el POS NO se envía a Toteat: este POS reemplaza a Toteat. El pedido
          igual queda en el Centro de pedidos (mirror) y en los chips del POS. */}
      <TomarPedidos
        restaurantId={restaurantId}
        backHref="/pos"
        backLabel="Mesas"
        disableToteat
        tableLabel={mesa}
        existingOrderId={order}
        onDone={mesa ? () => router.push('/pos?tab=mesas') : undefined}
      />
    </div>
  )
}
