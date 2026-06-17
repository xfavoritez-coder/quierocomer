import { NextRequest, NextResponse } from 'next/server'
import { revalidateQrCache } from '@/lib/qr/revalidateQrCache'

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
    revalidateQrCache(slug)
    return NextResponse.json({ ok: true, slug })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
