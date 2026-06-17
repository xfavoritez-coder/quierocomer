import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ADMIN_ROUTES = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const PUBLIC_PANEL_ROUTES = ["/panel/login", "/panel/forgot-password", "/panel/reset-password", "/panel/invite"];
const PUBLIC_PANEL_API_ROUTES = ["/api/panel/login", "/api/panel/demo-auth", "/api/panel/invite"];
const PUBLIC_API_ROUTES = ["/api/admin/login", "/api/admin/forgot-password", "/api/admin/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Feed home: set cookie for first-time users without a redirect ---
  if (pathname === "/") {
    const fingerprint = request.cookies.get("qc_feed_user")?.value;
    if (!fingerprint) {
      const newFingerprint = crypto.randomUUID();
      // Forward fingerprint to page.tsx via request header so it can create the user lazily
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-feed-fingerprint", newFingerprint);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.set("qc_feed_user", newFingerprint, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
      return response;
    }
  }

  // --- Panel page routes (owner panel) ---
  if (pathname.startsWith("/panel")) {
    if (PUBLIC_PANEL_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return NextResponse.next();
    }
    const token = request.cookies.get("panel_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/panel/login", request.url));
    }
    return NextResponse.next();
  }

  // --- Panel API routes ---
  if (pathname.startsWith("/api/panel")) {
    if (PUBLIC_PANEL_API_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return NextResponse.next();
    }
    const token = request.cookies.get("panel_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // --- Admin page routes (superadmin) ---
  if (pathname.startsWith("/admin")) {
    if (PUBLIC_ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return NextResponse.next();
    }
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // --- Admin API routes ---
  if (pathname.startsWith("/api/admin")) {
    if (PUBLIC_API_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return NextResponse.next();
    }
    const token = request.cookies.get("admin_token")?.value || request.cookies.get("panel_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/panel/:path*", "/admin/:path*", "/api/admin/:path*", "/api/panel/:path*"],
};
