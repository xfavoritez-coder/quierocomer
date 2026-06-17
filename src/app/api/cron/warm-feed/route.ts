import { NextResponse } from 'next/server'
import { getFeedDishes } from '@/app/a/lib/feed-queries'

// Warms the getFeedDishes() unstable_cache every 4 minutes so the first real
// visitor never hits a cold SQL query. Schedule: "*/4 * * * *" in vercel.json.
export async function GET() {
  try {
    await getFeedDishes()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[cron warm-feed]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
