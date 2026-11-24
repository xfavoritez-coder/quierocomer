'use client'

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

/** Fila de descuento/cupón en el detalle de un pedido del POS.
 *  Muestra el código del cupón usado (si lo hay) y el monto descontado. */
export default function CouponDiscountRow({ discountAmount, couponCode }: { discountAmount?: number | null; couponCode?: string | null }) {
  const amount = Math.round(Number(discountAmount) || 0)
  if (amount <= 0 && !couponCode) return null
  const isRecovery = !!couponCode && couponCode.toUpperCase().startsWith('VUELVE-')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 14, color: '#16a34a' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        <span>{couponCode ? 'Cupón' : 'Descuento'}</span>
        {couponCode && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800, padding: '1px 7px', borderRadius: 5, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>{couponCode}</span>
        )}
        {isRecovery && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>· recuperación de cliente</span>}
      </span>
      {amount > 0 && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, flexShrink: 0 }}>−{clp(amount)}</span>}
    </div>
  )
}
