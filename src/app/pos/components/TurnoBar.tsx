'use client'

// ── Turno: capa externa sobre las cajas ──────────────────────────────
// Flujo diario: abrir turno → (abrir caja → cerrar caja)* → cerrar turno.
// Cerrar turno fuerza y VERIFICA la subida de todos los eventos a la nube
// (flushAndVerify): si algo no subió, NO cierra (cero pérdida de datos).

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import {
  useOpenShift,
  useClosedCashSessions,
  openShift,
  closeShift,
  flushAndVerify,
} from '@/lib/pos'

const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')

function fmtTime(iso?: string): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function fmtDayIfNotToday(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return ''
  return ' · ' + d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function TurnoBar({
  restaurantId,
  hasOpenCaja,
}: {
  restaurantId?: string
  hasOpenCaja: boolean
}) {
  const shift = useOpenShift(restaurantId)
  const closedCajas = useClosedCashSessions(restaurantId, 90)
  const [busy, setBusy] = useState(false)

  // Cargando la proyección → no renderizar nada (evita parpadeo).
  if (shift === undefined || !restaurantId) return null

  const handleOpenTurno = async () => {
    setBusy(true)
    try {
      await openShift({ shift_id: uuidv4() })
    } catch {
      toast.error('No se pudo abrir el turno')
    } finally {
      setBusy(false)
    }
  }

  const handleCloseTurno = async () => {
    if (!shift) return
    if (hasOpenCaja) {
      toast.error('Cierra la caja antes de cerrar el turno')
      return
    }
    setBusy(true)
    const tid = toast.loading('Cerrando turno: sincronizando con la nube…')
    try {
      // Barrera de sincronización: sube TODO y confirma que no quede nada local.
      const res = await flushAndVerify(restaurantId)
      if (!res.ok) {
        toast.error(
          `No se pudo cerrar el turno: faltan ${res.pending} evento(s) por subir a la nube. Revisa tu conexión e inténtalo de nuevo.`,
          { id: tid, duration: 7000 },
        )
        return
      }
      // Resumen del turno: cajas cerradas desde que se abrió el turno.
      const cajasTurno = closedCajas.filter(c => (c.closed_at || '') >= (shift.opened_at || ''))
      const total = cajasTurno.reduce((s, c) => s + (c.total_sales || 0), 0)
      await closeShift({ shift_id: shift.id, caja_count: cajasTurno.length, total_sales: total })
      // Confirmar que el propio cierre de turno también subió.
      await flushAndVerify(restaurantId)
      toast.success(
        `Turno cerrado · ${cajasTurno.length} caja${cajasTurno.length === 1 ? '' : 's'} · ${clp(total)} · todo sincronizado ✓`,
        { id: tid, duration: 6000 },
      )
    } catch {
      toast.error('No se pudo cerrar el turno', { id: tid })
    } finally {
      setBusy(false)
    }
  }

  // ── Sin turno abierto: CTA para abrir turno ──────────────────────
  if (!shift) {
    return (
      <div style={{
        background: 'var(--amber-tint)', border: '1px solid var(--amber)',
        borderRadius: 'var(--r-card)', padding: '16px 18px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, background: 'var(--amber)', color: '#fff',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>Abre el turno para empezar</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>Primero el turno, luego la caja. Al cerrar el turno se sube todo a la nube.</div>
          </div>
        </div>
        <button
          onClick={handleOpenTurno}
          disabled={busy}
          style={{
            width: '100%', padding: '13px', borderRadius: 'var(--r-btn)', border: 0,
            background: 'var(--amber)', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Abriendo turno…' : 'Abrir turno'}
        </button>
      </div>
    )
  }

  // ── Turno abierto: banner + cerrar turno ─────────────────────────
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-card)', padding: '13px 16px', marginBottom: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--jade)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>Turno abierto</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Desde {fmtTime(shift.opened_at)}{fmtDayIfNotToday(shift.opened_at)}</div>
        </div>
      </div>
      <button
        onClick={handleCloseTurno}
        disabled={busy || hasOpenCaja}
        title={hasOpenCaja ? 'Cierra la caja antes de cerrar el turno' : 'Cerrar turno y subir todo a la nube'}
        style={{
          padding: '10px 16px', borderRadius: 'var(--r-btn)', border: '1.5px solid var(--line-strong)',
          background: 'var(--sunk)', color: hasOpenCaja ? 'var(--ink-4)' : 'var(--ink)',
          fontWeight: 800, fontSize: 13.5, flexShrink: 0,
          cursor: busy || hasOpenCaja ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Cerrando…' : 'Cerrar turno'}
      </button>
    </div>
  )
}
