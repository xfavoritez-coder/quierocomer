import { NextRequest, NextResponse } from "next/server";
import { VENTAS_COOKIE } from "@/lib/ventas/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/ventas/login", req.url), 303);
  res.cookies.set(VENTAS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
