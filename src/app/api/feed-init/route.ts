import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const next = searchParams.get('next')
  const redirectPath = next && next.startsWith('/') ? next : '/'

  const fingerprint = crypto.randomUUID()
  const cookieStore = await cookies()

  cookieStore.set('qc_feed_user', fingerprint, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
  })

  await prisma.feedUser.create({ data: { fingerprint, onboardingDone: true } })

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  return NextResponse.redirect(new URL(redirectPath, base))
}
