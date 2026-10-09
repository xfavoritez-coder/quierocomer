import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pairPage } from "@/lib/kds/liteHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La tablet envía el código de emparejamiento (form POST). Si es válido y no
// expiró, dejamos una cookie httpOnly con el token del KDS y redirigimos a /kds.
export async function POST(req: NextRequest) {
  let code = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const b = await req.json().catch(() => ({}));
      code = String(b?.code || "");
    } else {
      const f = await req.formData();
      code = String(f.get("code") || "");
    }
  } catch { /* noop */ }

  code = code.trim().toUpperCase();
  const htmlErr = (msg: string) =>
    new NextResponse(pairPage(msg), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

  if (!code || code.length < 4) return htmlErr("Escribe el código completo.");

  const rest = await prisma.restaurant.findFirst({
    where: { ecommerceStoreConfig: { path: ["kdsPairCode"], equals: code } },
    select: { id: true, ecommerceStoreConfig: true },
  });
  if (!rest) return htmlErr("Código inválido. Pide uno nuevo en el panel.");

  const cfg = (rest.ecommerceStoreConfig as Record<string, unknown>) || {};
  const exp = typeof cfg.kdsPairExp === "string" ? Date.parse(cfg.kdsPairExp) : 0;
  const token = typeof cfg.kdsToken === "string" ? (cfg.kdsToken as string) : "";
  if (!token || !exp || exp < Date.now()) return htmlErr("El código expiró. Genera uno nuevo en el panel.");

  const res = NextResponse.redirect(new URL("/kds", req.url), { status: 303 });
  res.cookies.set("kds_token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
