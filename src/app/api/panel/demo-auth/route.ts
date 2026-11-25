import { NextRequest, NextResponse } from "next/server";
import { getPanelId, readAdminSession, setSessionCookie } from "@/lib/session";
import { verifyPanelEntryToken } from "@/lib/panelEntryLink";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours for demo sessions
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * GET /api/panel/demo-auth?slug=xxx[&k=<firma>][&ot=<ownerViewToken>][&next=...]
 *
 * Entrada al panel desde la carta/correos.
 *  - Local SIN dueño → sesión demo limitada a ese local.
 *  - Local CON dueño → sesión del dueño SOLO si se demuestra que el enlace es
 *    legítimo: firma `k` válida (buildPanelEntryUrl), `ot` de un solo uso que
 *    coincide, o quien entra es superadmin. Conocer el slug ya no basta.
 *  - Local CON dueño sin prueba: si sigue siendo demo → sesión demo limitada a
 *    ese local (nunca la del dueño); si no → al login.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.redirect(new URL("/panel/login", req.url));

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug },
    select: { id: true, ownerId: true, isDemo: true },
  });

  if (!restaurant) {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  const nextPage = req.nextUrl.searchParams.get("next");
  const redirectTo = nextPage ? `/panel/${nextPage}` : "/panel";

  let ownerId = "demo";
  let ownerRole = "OWNER";

  if (restaurant.ownerId) {
    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: restaurant.ownerId },
      select: { id: true, role: true, status: true },
    });

    // ¿Ya tiene sesión válida como este dueño? Entra sin tocar nada.
    if (owner && getPanelId(req) === owner.id) {
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }

    let authorized = false;
    if (owner && owner.status !== "SUSPENDED") {
      if (verifyPanelEntryToken(slug, req.nextUrl.searchParams.get("k"))) authorized = true;
      else if (readAdminSession(req)?.role === "SUPERADMIN") authorized = true;
      else {
        const ot = req.nextUrl.searchParams.get("ot");
        if (ot) {
          // Token de un solo uso: se consume atómicamente al validarlo.
          const used = await prisma.restaurant.updateMany({
            where: { id: restaurant.id, ownerViewToken: ot, ownerViewTokenUsedAt: null },
            data: { ownerViewTokenUsedAt: new Date() },
          });
          authorized = used.count === 1;
        }
      }
    }

    if (owner && authorized) {
      ownerId = owner.id;
      ownerRole = owner.role;
    } else if (!restaurant.isDemo) {
      return NextResponse.redirect(new URL("/panel/login", req.url));
    }
    // else: local demo con dueño pero sin prueba → sesión demo limitada (ownerId = "demo").
  }

  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  // Track panel visit in Lead funnel + invalidar cache ISR del QR
  prisma.lead.updateMany({
    where: { generatedSlug: slug, panelVisitedAt: null },
    data: { panelVisitedAt: new Date() },
  }).then(() => { revalidatePath(`/qr/${slug}`); revalidatePath(`/${slug}`); }).catch(() => {});

  const response = NextResponse.redirect(new URL(redirectTo, req.url));
  // Sesión firmada. Para la demo sin dueño (id "demo") el slug va dentro de la firma.
  setSessionCookie(
    response,
    { kind: "panel", id: ownerId, role: ownerRole, demoSlug: ownerId === "demo" ? slug : undefined, demo: true },
    COOKIE_MAX_AGE,
  );
  response.cookies.set("panel_demo", restaurant.isDemo ? "1" : "0", { ...base, httpOnly: false });

  return response;
}
