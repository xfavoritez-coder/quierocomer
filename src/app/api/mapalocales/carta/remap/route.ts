import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { overrides } = await req.json() as {
    overrides: { dishId: string; leafOverride: string | null }[]
  }

  if (!overrides?.length) return NextResponse.json({ ok: true, updated: 0 })

  let updated = 0
  for (const { dishId, leafOverride } of overrides) {
    await prisma.dish.update({
      where: { id: dishId },
      data: { leafOverride: leafOverride || null },
    })
    updated++
  }

  return NextResponse.json({ ok: true, updated })
}
