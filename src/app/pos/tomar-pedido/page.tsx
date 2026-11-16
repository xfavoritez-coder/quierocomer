'use client'

// Tomar Pedido dentro del POS: embebe el MISMO tomador de Centro de pedidos,
// tomando el local de usePosRestaurant (no de la sesión del panel). El enlace
// "atrás" vuelve al POS (grilla de mesas). El wrapper replica el padding del
// owl-main del panel para que ambas vistas se vean idénticas.
// Modo mesa: con ?mesa=<label> (y ?order=<posOrderId> para agregar rondas) el
// tomador entra en "modo mesa" (dine-in, sin cliente/pago; el pago es al cobrar).
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { usePosRestaurant } from '../lib/usePosRestaurant'

function PosTomarPedidoInner() {
  const { restaurantId } = usePosRestaurant()
  const router = useRouter()
  // En CLIENTE leemos el URL REAL del navegador (useSearchParams puede quedar
  // stale con el Router Cache al navegar entre /pos/tomar-pedido con y sin ?mesa,
  // arrastrando un mesa=S1 viejo a un pedido de retiro). En SSR caemos a
  // useSearchParams, que sí trae el parámetro → sin flash ni desajuste de hidratación.
  const sp = useSearchParams()
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : sp
  const mesa = params.get('mesa')
  const order = params.get('order')
  return (
    <div className="pos-tomar-wrap">
      <style>{`.pos-tomar-wrap{padding:24px 32px;min-height:100dvh;background:#f8fafc}@media(max-width:767px){.pos-tomar-wrap{padding:16px}}`}</style>
      {/* En el POS NO se envía a Toteat: este POS reemplaza a Toteat. El pedido
          igual queda en el Centro de pedidos (mirror) y en los chips del POS. */}
      <TomarPedidos
        restaurantId={restaurantId}
        backHref="/pos?tab=mesas"
        backLabel="Mesas"
        disableToteat
        tableLabel={mesa}
        existingOrderId={order}
        onDone={mesa ? () => router.push('/pos?tab=mesas') : undefined}
      />
    </div>
  )
}

export default function PosTomarPedidoPage() {
  return (
    <Suspense fallback={<div className="pos-tomar-wrap" style={{ padding: 24 }} />}>
      <PosTomarPedidoInner />
    </Suspense>
  )
}
