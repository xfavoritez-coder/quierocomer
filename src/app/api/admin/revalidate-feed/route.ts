import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  // Accept either SEED_SECRET key or admin session cookie
  const hasKey = key === process.env.SEED_SECRET
  const hasAdmin = !checkAdminAuth(request)
  if (!hasKey && !hasAdmin && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  revalidateTag('feed-dishes', { expire: 0 })
  return NextResponse.json({ ok: true, revalidated: 'feed-dishes', at: new Date().toISOString() })
}
