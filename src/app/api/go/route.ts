import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const SECRET = process.env.GO_SECRET || "quierocomer2024"

function auth(req: NextRequest): boolean {
  const cookie = req.cookies.get("go_auth")?.value
  return cookie === SECRET
}

// POST /api/go — login
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }))
  if (password !== SECRET) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set("go_auth", SECRET, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
  })
  return res
}

// GET /api/go — list tasks
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const tasks = await prisma.goTask.findMany({
    where: { archivedAt: null },
    orderBy: [{ priority: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json({ tasks })
}

// PUT /api/go — create or update task
export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json()
  const { id, title, description, column, assignee, priority, position } = body

  if (id) {
    // Update
    const task = await prisma.goTask.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(column !== undefined && { column }),
        ...(assignee !== undefined && { assignee }),
        ...(priority !== undefined && { priority }),
        ...(position !== undefined && { position }),
      },
    })
    return NextResponse.json({ task })
  }

  // Create
  if (!title) return NextResponse.json({ error: "title requerido" }, { status: 400 })
  const maxPos = await prisma.goTask.aggregate({
    where: { column: column || "backlog", archivedAt: null },
    _max: { position: true },
  })
  const task = await prisma.goTask.create({
    data: {
      title,
      description: description || null,
      column: column || "backlog",
      assignee: assignee || null,
      priority: priority || 0,
      position: (maxPos._max.position ?? -1) + 1,
    },
  })
  return NextResponse.json({ task })
}

// DELETE /api/go — archive task
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })
  await prisma.goTask.update({ where: { id }, data: { archivedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
