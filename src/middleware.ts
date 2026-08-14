import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https" ||
    process.env.NODE_ENV === "production";

  // Try retrieving token with HTTPS / secureCookie first if in production / HTTPS
  let token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: isHttps,
  });

  // If not found, try fallback without secureCookie
  if (!token) {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: false,
    });
  }

  // Also check direct cookie existence as fallback
  if (!token) {
    const hasSessionCookie =
      request.cookies.has("authjs.session-token") ||
      request.cookies.has("__Secure-authjs.session-token") ||
      request.cookies.has("next-auth.session-token") ||
      request.cookies.has("__Secure-next-auth.session-token");

    if (hasSessionCookie) {
      token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET,
        raw: true,
      }).catch(() => null);
    }
  }

  if (pathname === "/admin69") {
    if (token) {
      return NextResponse.redirect(new URL("/admin/users", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/admin69"],
};
