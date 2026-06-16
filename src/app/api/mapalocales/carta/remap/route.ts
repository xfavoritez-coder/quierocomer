import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    overrides?: { dishId: string; leafOverride: string | null }[]
    dishDiets?: { dishId: string; diet: string }[]
  }

  const { overrides = [], dishDiets = [] } = body

  let updated = 0

  for (const { dishId, leafOverride } of overrides) {
    await prisma.dish.update({
      where: { id: dishId },
      data: { leafOverride: leafOverride || null },
    })
    updated++
  }

  for (const { dishId, diet } of dishDiets) {
    await prisma.dish.update({
      where: { id: dishId },
      data: { dishDiet: diet as any },
    })
    updated++
  }

  return NextResponse.json({ ok: true, updated })
}
