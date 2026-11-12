/**
 * Registra el webhook de PARTNER de SharkPOS (recibe los estados SII de TODOS los
 * RUT dados de alta por la plataforma). Correr:
 *   npx tsx scripts/sharkpos-register-partner-webhook.ts
 * Usa SHARKPOS_PLATFORM_KEY (.env.local). La secret se muestra UNA sola vez:
 * se escribe en .env.local como SHARKPOS_PARTNER_WEBHOOK_SECRET y se imprime
 * para cargarla también en Vercel.
 */
import { config } from 'dotenv'; config({ path: '.env.local' })
import { readFileSync, writeFileSync, existsSync } from 'fs'

const KEY = process.env.SHARKPOS_PLATFORM_KEY
const BASE = (process.env.SHARKPOS_PLATFORM_ENV || process.env.SHARKPOS_ENV || 'sandbox') === 'production'
  ? 'https://api.sharkpos.cl' : 'https://sandbox.sharkpos.cl'
const WEBHOOK_URL = 'https://quierocomer.com/api/sharkpos/webhook'
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function main() {
  if (!KEY) { console.error('Falta SHARKPOS_PLATFORM_KEY'); process.exit(1) }
  console.log('Base:', BASE, '· URL webhook:', WEBHOOK_URL)

  // 1) Ya existe uno para nuestra URL?
  const listRes = await fetch(`${BASE}/api/v1/partner/webhooks/`, { headers: H })
  const list = await listRes.json().catch(() => ({}))
  const existing = (list.webhooks || []).find((w: any) => w.url === WEBHOOK_URL)
  if (existing) {
    console.log(`\n⚠️ Ya hay un webhook para esa URL (id ${existing.id}). La secret no se puede releer.`)
    console.log('   Si necesitas la secret, rota con POST /api/v1/partner/webhooks/' + existing.id + '/rotate-secret/')
    return
  }

  // 2) Eventos válidos → nos quedamos con dte.* + certificate.expiring + caf.folios_*
  let eventTypes: string[] = ['*']
  try {
    const etRes = await fetch(`${BASE}/api/v1/partner/webhooks/event-types/`, { headers: H })
    const et = await etRes.json().catch(() => ({}))
    const all: string[] = (et.event_types || et.events || []).map((e: any) => typeof e === 'string' ? e : e.name || e.type).filter(Boolean)
    if (all.length) {
      const want = all.filter(e => e.startsWith('dte.') || e === 'certificate.expiring' || e === 'certificate.expired' || e === 'caf.folios_low' || e === 'caf.folios_exhausted')
      if (want.length) eventTypes = want
    }
    console.log('Eventos a suscribir:', eventTypes.join(', '))
  } catch { console.log('No pude leer event-types; uso ["*"]') }

  // 3) Crear
  const createRes = await fetch(`${BASE}/api/v1/partner/webhooks/`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ url: WEBHOOK_URL, description: 'QuieroComer POS — estados SII (todos los RUT)', event_types: eventTypes }),
  })
  const d = await createRes.json().catch(() => ({}))
  if (createRes.status !== 201 || !d.webhook?.secret) {
    console.error(`\n❌ No se creó (HTTP ${createRes.status}):`, JSON.stringify(d).slice(0, 300))
    process.exit(1)
  }
  const { id, secret } = d.webhook

  // 4) Guardar la secret en .env.local
  const envPath = '.env.local'
  let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  if (/^SHARKPOS_PARTNER_WEBHOOK_SECRET=/m.test(env)) env = env.replace(/^SHARKPOS_PARTNER_WEBHOOK_SECRET=.*$/m, `SHARKPOS_PARTNER_WEBHOOK_SECRET=${secret}`)
  else env += `${env.endsWith('\n') || env === '' ? '' : '\n'}SHARKPOS_PARTNER_WEBHOOK_SECRET=${secret}\n`
  writeFileSync(envPath, env)

  console.log(`\n✅ Webhook de partner creado. id: ${id}`)
  console.log('   Guardado en .env.local como SHARKPOS_PARTNER_WEBHOOK_SECRET.')
  console.log('\n🔑 Cárgalo también en Vercel (Production) con este nombre y valor:')
  console.log(`   SHARKPOS_PARTNER_WEBHOOK_SECRET=${secret}`)
  console.log('\n   (se muestra una sola vez; si lo pierdes, rota la secret)')
}

main().catch(e => { console.error(String(e).slice(0, 300)); process.exit(1) })
