'use client'

// Sonido de aviso de pedidos (ecommerce) en el POS. Se puede elegir entre varios
// sonidos (incluido uno tipo teléfono "riiing"). Flag + tipo se guardan por equipo
// en localStorage. Se genera con Web Audio (sin archivos) y suena FUERTE. La primera
// activación debe venir de un gesto del usuario para desbloquear el audio.

const KEY_ON = 'pos_order_sound'
const KEY_TYPE = 'pos_order_sound_type'

export type SoundType = 'beeps' | 'telefono' | 'campana' | 'alarma'
export const SOUND_OPTIONS: { id: SoundType; label: string }[] = [
  { id: 'beeps', label: 'Beeps' },
  { id: 'telefono', label: 'Teléfono (riiing)' },
  { id: 'campana', label: 'Campana' },
  { id: 'alarma', label: 'Alarma' },
]

let _ctx: AudioContext | null = null

export function isOrderSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(KEY_ON) === '1' } catch { return false }
}
export function setOrderSoundEnabled(v: boolean): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY_ON, v ? '1' : '0') } catch { /* noop */ }
  try { window.dispatchEvent(new Event('pos-order-sound-change')) } catch { /* noop */ }
}
export function getOrderSoundType(): SoundType {
  if (typeof window === 'undefined') return 'beeps'
  try {
    const v = localStorage.getItem(KEY_TYPE)
    if (v === 'telefono' || v === 'campana' || v === 'alarma' || v === 'beeps') return v
  } catch { /* noop */ }
  return 'beeps'
}
export function setOrderSoundType(t: SoundType): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY_TYPE, t) } catch { /* noop */ }
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

// ── Sonidos ───────────────────────────────────────────────────────
function beep(c: AudioContext, master: GainNode, start: number, freq: number, dur: number, type: OscillatorType = 'square') {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(0.95, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g); g.connect(master)
  o.start(start); o.stop(start + dur + 0.02)
}

function playBeeps(c: AudioContext, master: GainNode, t0: number) {
  beep(c, master, t0 + 0.00, 988, 0.22)
  beep(c, master, t0 + 0.26, 1319, 0.22)
  beep(c, master, t0 + 0.60, 988, 0.22)
  beep(c, master, t0 + 0.86, 1319, 0.22)
}

function playAlarma(c: AudioContext, master: GainNode, t0: number) {
  // Urgente: beeps rápidos y agudos (tipo alarma).
  for (let i = 0; i < 6; i++) beep(c, master, t0 + i * 0.16, 1760, 0.10, 'square')
}

function playCampana(c: AudioContext, master: GainNode, t0: number) {
  // Campana: fundamental + armónicos con decaimiento, golpeada 2 veces.
  const strike = (start: number) => {
    const partials = [{ f: 660, g: 0.9, d: 1.1 }, { f: 1320, g: 0.5, d: 0.9 }, { f: 1980, g: 0.25, d: 0.6 }]
    for (const p of partials) {
      const o = c.createOscillator(); const g = c.createGain()
      o.type = 'sine'; o.frequency.value = p.f
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(p.g, start + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, start + p.d)
      o.connect(g); g.connect(master)
      o.start(start); o.stop(start + p.d + 0.02)
    }
  }
  strike(t0); strike(t0 + 0.6)
}

function playTelefono(c: AudioContext, master: GainNode, t0: number) {
  // Teléfono "riiing riiing riiing": 3 timbres con warble entre dos tonos.
  const rings = 3, ringDur = 0.9, gap = 0.35, step = 0.045
  for (let r = 0; r < rings; r++) {
    const start = t0 + r * (ringDur + gap)
    const o = c.createOscillator(); o.type = 'triangle'
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(0.95, start + 0.02)
    g.gain.setValueAtTime(0.95, start + ringDur - 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, start + ringDur)
    for (let tt = 0; tt < ringDur; tt += step * 2) {
      o.frequency.setValueAtTime(480, start + tt)
      o.frequency.setValueAtTime(620, start + Math.min(tt + step, ringDur))
    }
    o.connect(g); g.connect(master)
    o.start(start); o.stop(start + ringDur + 0.02)
  }
}

/** Sonido de advertencia Delifast: dos tonos graves cortos (distinto al de pedido nuevo). */
export function playDelifastWarning(): void {
  const c = ctx()
  if (!c) return
  const master = c.createGain()
  master.gain.value = 1.0
  master.connect(c.destination)
  const t0 = c.currentTime + 0.02
  // Dos tonos graves y cortos — claramente distinto al beep agudo de nuevo pedido.
  beep(c, master, t0, 440, 0.18, 'sawtooth')
  beep(c, master, t0 + 0.25, 330, 0.28, 'sawtooth')
}

/** Reproduce el sonido elegido (o uno dado), fuerte. */
export function playOrderAlert(type?: SoundType): void {
  const c = ctx()
  if (!c) return
  const master = c.createGain()
  master.gain.value = 1.0
  master.connect(c.destination)
  const t0 = c.currentTime + 0.02
  const t = type ?? getOrderSoundType()
  if (t === 'telefono') playTelefono(c, master, t0)
  else if (t === 'campana') playCampana(c, master, t0)
  else if (t === 'alarma') playAlarma(c, master, t0)
  else playBeeps(c, master, t0)
}
