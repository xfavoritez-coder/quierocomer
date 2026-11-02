'use client'

// Sonido de aviso de pedidos (ecommerce) en el POS. El flag se guarda por equipo
// en localStorage. El sonido se genera con Web Audio (sin archivos) y es FUERTE:
// un patrón de 4 beeps tipo alarma, repetible. La primera activación debe venir de
// un gesto del usuario (el toggle) para desbloquear el audio del navegador.

const KEY = 'pos_order_sound'
let _ctx: AudioContext | null = null

export function isOrderSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setOrderSoundEnabled(v: boolean): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* noop */ }
  try { window.dispatchEvent(new Event('pos-order-sound-change')) } catch { /* noop */ }
}

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!_ctx) _ctx = new AC()
    if (_ctx.state === 'suspended') { void _ctx.resume() }
    return _ctx
  } catch { return null }
}

/** Desbloquea el audio (llamar desde un gesto del usuario, ej. el toggle). */
export function primeOrderSound(): void { ctx() }

/** Reproduce una alarma fuerte (4 beeps). */
export function playOrderAlert(): void {
  const c = ctx()
  if (!c) return
  const t0 = c.currentTime
  const master = c.createGain()
  master.gain.value = 1.0
  master.connect(c.destination)
  const beep = (start: number, freq: number, dur = 0.22) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'square'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t0 + start)
    g.gain.exponentialRampToValueAtTime(0.95, t0 + start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
    o.connect(g); g.connect(master)
    o.start(t0 + start)
    o.stop(t0 + start + dur + 0.02)
  }
  // Patrón de atención: dos pares de beeps alternando tono.
  beep(0.00, 988)
  beep(0.26, 1319)
  beep(0.60, 988)
  beep(0.86, 1319)
}
