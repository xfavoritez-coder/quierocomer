import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId");
    const restaurantId = url.searchParams.get("restaurantId");
    // Sesión actual del cliente — la excluimos del conteo para que un cliente
    // que cierra la pestaña y vuelve a abrir dentro del SESSION_REUSE_WINDOW
    // (2 min) no sea contado como tener "1 sesión previa".
    const excludeSessionId = url.searchParams.get("excludeSessionId");
    if (!guestId) return NextResponse.json({ visitCount: 0, restaurantSessions: 0 });

    const guest = await prisma.guestProfile.findUnique({
      where: { id: guestId },
      select: { visitCount: true },
    });

    // Cada fila Session distinta = una visita real. El sessionTracker ya
    // dedupea refreshes en una ventana de 2 min en la misma fila.
    let restaurantSessions = 0;
    if (restaurantId) {
      restaurantSessions = await prisma.session.count({
        where: {
          guestId,
          restaurantId,
          ...(excludeSessionId ? { NOT: { id: excludeSessionId } } : {}),
        },
      });
    }

    return NextResponse.json({
      visitCount: guest?.visitCount || 0,
      restaurantSessions,
    });
  } catch {
    return NextResponse.json({ visitCount: 0, restaurantSessions: 0 });
  }
}
