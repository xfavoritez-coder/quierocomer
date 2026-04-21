import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ADMIN_ROUTES = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
];

const PUBLIC_API_ROUTES = [
  "/api/admin/login",
  "/api/admin/forgot-password",
  "/api/admin/reset-password",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to /qr landing
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/qr", request.url));
  }

  // --- /panel/* → redirect to /admin/* (friendly entry point) ---
  if (pathname.startsWith("/panel")) {
    const newPath = pathname.replace(/^\/panel/, "/admin") || "/admin";
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  // --- Admin page routes ---
  if (pathname.startsWith("/admin")) {
    // Allow public admin routes
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
    // Allow public API routes
    if (PUBLIC_API_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return NextResponse.next();
    }

    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/panel/:path*", "/admin/:path*", "/api/admin/:path*"],
};
