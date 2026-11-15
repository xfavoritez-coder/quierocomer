import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const SECRET = process.env.GO_SECRET || "quierocomer2024"

export async function POST(req: NextRequest) {
  if (req.cookies.get("go_auth")?.value !== SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  // moves: [{ id, column, position }]
  const { moves } = await req.json() as { moves: { id: string; column: string; position: number }[] }
  if (!Array.isArray(moves)) return NextResponse.json({ error: "moves requerido" }, { status: 400 })

  await Promise.all(
    moves.map(m =>
      prisma.goTask.update({ where: { id: m.id }, data: { column: m.column, position: m.position } })
    )
  )
  return NextResponse.json({ ok: true })
}
