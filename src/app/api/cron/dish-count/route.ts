import { NextResponse } from 'next/server'
import { getCachedDishCount } from '@/app/a/lib/feed-queries'

// Refreshes the cached dish count every 12 hours. Schedule: "0 */12 * * *" in vercel.json.
export async function GET() {
  try {
    const count = await getCachedDishCount()
    return NextResponse.json({ ok: true, count })
  } catch (e) {
    console.error('[cron dish-count]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
