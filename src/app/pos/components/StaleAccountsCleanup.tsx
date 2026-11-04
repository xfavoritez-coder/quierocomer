'use client'

import { useState } from 'react'
import { useOpenAccounts, voidAccount } from '@/lib/pos'
import { toast } from 'sonner'

/**
 * Limpieza de cuentas abiertas "zombi": cuentas de retiro/mostrador que
 * quedaron abiertas de días anteriores SIN ítems ni pago (abandonadas).
 * `useOpenAccounts` no filtra por fecha, así que se acumulan y ensucian el
 * cierre. Esta acción las anula en bloque (evento `account_voided`), pero SOLO
 * las verdaderamente vacías ($0, sin ítems, sin pagos) y de días previos — una
 * cuenta con consumo o pago es una venta real y nunca se toca aquí.
 */
export default function StaleAccountsCleanup({ restaurantId }: { restaurantId: string }) {
  const openAccounts = useOpenAccounts()
  const [cleaning, setCleaning] = useState(false)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTodayMs = startOfToday.getTime()

  const stale = openAccounts.filter(
    a =>
      a.restaurant_id === restaurantId &&
      (a.items?.length ?? 0) === 0 &&
      (a.payments?.length ?? 0) === 0 &&
      (a.total ?? 0) === 0 &&
      a.opened_at != null &&
      new Date(a.opened_at).getTime() < startOfTodayMs,
  )

  if (stale.length === 0) return null

  const n = stale.length
  const plural = n > 1

  const handleCleanup = async () => {
    if (cleaning) return
    setCleaning(true)
    let ok = 0
    try {
      for (const a of stale) {
        try {
          await voidAccount({ account_id: a.id, reason: 'Limpieza de caja: cuenta vacía abandonada' })
          ok++
        } catch {
          /* seguimos con las demás */
        }
      }
      if (ok === n) {
        toast.success(`${n} cuenta${plural ? 's' : ''} vacía${plural ? 's' : ''} eliminada${plural ? 's' : ''}`)
      } else if (ok > 0) {
        toast.warning(`Se eliminaron ${ok} de ${n} cuentas`)
      } else {
        toast.error('No se pudieron limpiar las cuentas')
      }
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div
      className="pos-caja-open"
      style={{ flexDirection: 'column', alignItems: 'stretch', fontSize: 13, marginTop: 4 }}
    >
      <p className="co-t" style={{ marginBottom: 2 }}>
        {n} cuenta{plural ? 's' : ''} vacía{plural ? 's' : ''} de días anteriores
      </p>
      <p style={{ color: 'var(--ink-3)', fontSize: 12, margin: '0 0 10px' }}>
        Cuentas abiertas sin ítems ni pago que quedaron abandonadas. Puedes eliminarlas para que no aparezcan en el cierre.
      </p>
      <button
        onClick={handleCleanup}
        disabled={cleaning}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 14px',
          borderRadius: 'var(--r-btn)',
          border: '1px solid var(--line-strong)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontWeight: 600,
          fontSize: 13,
          cursor: cleaning ? 'default' : 'pointer',
          opacity: cleaning ? 0.6 : 1,
        }}
      >
        {cleaning ? 'Limpiando...' : `Limpiar ${n} cuenta${plural ? 's' : ''} vacía${plural ? 's' : ''}`}
      </button>
    </div>
  )
}
