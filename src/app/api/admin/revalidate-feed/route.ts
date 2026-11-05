import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const slug = url.searchParams.get('slug')
  // Accept either SEED_SECRET key or admin session cookie
  const hasKey = key === process.env.SEED_SECRET
  const hasAdmin = !checkAdminAuth(request)
  if (!hasKey && !hasAdmin && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  revalidateTag('feed-dishes', { expire: 0 })
  const qrSlug = url.searchParams.get('qrslug')
  if (qrSlug) {
    revalidateTag(`qr-restaurant-${qrSlug}`, { expire: 0 } as any)
    revalidateTag(`ecom-storefront-slug-${qrSlug}`, { expire: 0 } as any)
  } else if (url.searchParams.get('qr') === 'all') {
    revalidateTag('qr-restaurant', { expire: 0 } as any)
    revalidateTag('ecom-storefront', { expire: 0 } as any)
  }
  if (slug) {
    revalidatePath(`/${slug}`)
  }
  return NextResponse.json({ ok: true, revalidated: qrSlug ? ['feed-dishes', `qr-restaurant-${qrSlug}`] : 'feed-dishes', at: new Date().toISOString() })
}
