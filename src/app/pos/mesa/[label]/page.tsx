'use client'

// Tomar pedido de MESA — ruta propia (`/pos/mesa/<label>`), separada de la de
// retiro (`/pos/tomar-pedido`), para que el Router Cache de Next NO mezcle el
// parámetro de mesa entre ambas (antes "Nuevo retiro" tras visitar una mesa
// restauraba el ?mesa y abría en modo mesa). La mesa viene en el path; `?order`
// (para agregar rondas) en el query. Embebe el MISMO tomador en modo mesa.
import { Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { TomarPedidos } from '@/app/(panel)/panel/centro-pedidos/tomar-pedidos/page'
import { usePosRestaurant } from '../../lib/usePosRestaurant'

function PosMesaInner() {
  const { restaurantId } = usePosRestaurant()
  const router = useRouter()
  const params = useParams<{ label: string }>()
  const sp = useSearchParams()
  const label = decodeURIComponent(String(params?.label ?? ''))
  const order = sp.get('order')
  return (
    <div className="pos-tomar-wrap">
      <style>{`.pos-tomar-wrap{padding:24px 32px;min-height:100dvh;background:#f8fafc}@media(max-width:767px){.pos-tomar-wrap{padding:16px}}`}</style>
      <TomarPedidos
        restaurantId={restaurantId}
        backHref="/pos?tab=mesas"
        backLabel="Mesas"
        disableToteat
        tableLabel={label}
        existingOrderId={order}
        onDone={() => router.push('/pos?tab=mesas')}
      />
    </div>
  )
}

export default function PosMesaPage() {
  return (
    <Suspense fallback={<div className="pos-tomar-wrap" style={{ padding: 24 }} />}>
      <PosMesaInner />
    </Suspense>
  )
}
