import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (key !== process.env.SEED_SECRET && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  revalidateTag('feed-dishes')
  return NextResponse.json({ ok: true, revalidated: 'feed-dishes', at: new Date().toISOString() })
}
