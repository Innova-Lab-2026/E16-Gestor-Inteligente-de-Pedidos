import { NextRequest, NextResponse } from "next/server";
import { PROTECTED_PREFIXES, ROUTES } from "@/config/router";
import { SESSION_COOKIE } from "@/features/auth/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL(ROUTES.login, request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};