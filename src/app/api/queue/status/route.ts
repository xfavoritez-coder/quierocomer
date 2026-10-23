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

  // Posición en la fila = personas activas (en espera/próximas/llamadas) con un
  // número menor o igual al del cliente, INCLUYÉNDOLO a él. Baja a 1 (es el
  // próximo) a medida que atienden a los de adelante.
  const active = entry.status === "WAITING" || entry.status === "NEAR" || entry.status === "CALLED";
  const position = active
    ? await prisma.queueEntry.count({
        where: {
          restaurantId: entry.restaurantId,
          number: { lte: entry.number },
          status: { in: ["WAITING", "NEAR", "CALLED"] },
        },
      })
    : 0;

  return NextResponse.json({ status: entry.status, position });
}
