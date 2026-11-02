'use client'

import { useEffect, useRef } from 'react'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import { supabase } from '@/lib/supabase'
import { isOrderSoundEnabled, playOrderAlert } from '../lib/orderSound'

// Suena una alarma cuando entra un pedido nuevo (PosOrder INSERT) si el sonido
// está habilitado. Se monta en el layout del POS → activo en todas las pantallas.
export default function PosOrderSound() {
  const { restaurantId } = usePosRestaurant()
  const enabledRef = useRef(isOrderSoundEnabled())

  useEffect(() => {
    const sync = () => { enabledRef.current = isOrderSoundEnabled() }
    sync()
    window.addEventListener('pos-order-sound-change', sync)
    return () => window.removeEventListener('pos-order-sound-change', sync)
  }, [])

  useEffect(() => {
    if (!restaurantId || !supabase) return
    const ch = supabase
      .channel(`pos-order-sound-${restaurantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'PosOrder', filter: `restaurantId=eq.${restaurantId}` }, (payload: { new?: { provider?: string } }) => {
        // Solo pedidos del ecommerce/tienda (no los que entran por Toteat).
        if (enabledRef.current && payload?.new?.provider === 'ecommerce') playOrderAlert()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurantId])

  return null
}
