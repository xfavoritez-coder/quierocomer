import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/queue/status?id=<entryId>
 *  Estado en vivo de un registro de la fila, para la web del cliente.
 *  Devuelve status, número, y cuántas personas tiene por delante. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const entry = await prisma.queueEntry.findUnique({
    where: { id },
    select: { number: true, status: true, restaurantId: true },
  });
  if (!entry) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Personas por delante: en espera/próximas/llamadas con un número menor.
  const ahead = entry.status === "WAITING" || entry.status === "NEAR"
    ? await prisma.queueEntry.count({
        where: {
          restaurantId: entry.restaurantId,
          number: { lt: entry.number },
          status: { in: ["WAITING", "NEAR", "CALLED"] },
        },
      })
    : 0;

  return NextResponse.json({ status: entry.status, number: entry.number, ahead });
}
