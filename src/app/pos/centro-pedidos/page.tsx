'use client'

// El Centro de pedidos ahora es una PESTAÑA dentro del POS (/pos?tab=centro), para
// que comparta el header sin recargar. Esta ruta antigua redirige a esa pestaña.
import { useEffect } from 'react'
import { usePosNav } from '../lib/usePosNav'

export default function PosCentroPedidosRedirect() {
  const navigate = usePosNav()
  useEffect(() => { navigate('/pos?tab=centro') }, [navigate])
  return null
}
