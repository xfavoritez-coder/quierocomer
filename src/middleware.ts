import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Redirect root to /qr landing
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/qr", request.url));
  }
}

export const config = {
  matcher: "/",
};
