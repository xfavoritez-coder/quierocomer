import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ADMIN_ROUTES = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const PUBLIC_PANEL_ROUTES = [
  "/panel/login",
  "/panel/forgot-password",
  "/panel/reset-password",
  "/panel/invite",
  "/panel/verificar-email",
];
const PUBLIC_PANEL_API_ROUTES = [
  "/api/panel/login",
  "/api/panel/demo-auth",
  "/api/panel/invite",
  "/api/panel/auto-login",
  "/api/panel/magic-entry",
  "/api/panel/resend-verification",
  "/api/panel/change-email",
];
const PUBLIC_API_ROUTES = ["/api/admin/login", "/api/admin/forgot-password", "/api/admin/reset-password"];

const BLOCKED_UA_PATTERNS = [
  "meta-externalagent",
  "facebookbot",
  "AdsBot-Google",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const ua = request.headers.get("user-agent") || "";
  if (BLOCKED_UA_PATTERNS.some(p => ua.toLowerCase().includes(p.toLowerCase()))) {
    return new NextResponse(null, { status: 403 });
  }

  if (pathname === "/qr" || pathname === "/qr/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/loyalty" || pathname.startsWith("/loyalty/")) {
    const rest = pathname.slice("/loyalty".length);
    return NextResponse.redirect(new URL(`/panel/loyalty${rest}`, request.url));
  }

  // Panel page routes (owner panel)
  if (pathname.startsWith("/panel")) {
    // WhatsApp short links: /panel/123 (numeric) — entry point, no token required
    if (/^\/panel\/\d+$/.test(pathname)) return NextResponse.next();

    if (PUBLIC_PANEL_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return NextResponse.next();
    }
    const token = request.cookies.get("panel_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/panel/login", request.url));
    }
    return NextResponse.next();
  }

  // Panel API routes
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

  // Admin page routes (superadmin)
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

  // Admin API routes
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
  matcher: [
    "/((?!_next/static|_next/image|favicon|og\\.png|robots\\.txt|sitemap).*)",
  ],
};
