import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { canAccessPage } from "@sezsec/rbac/rbac.helper";
import type { SessionUser } from "@sezsec/auth/auth.types";

const SESSION_COOKIE_NAME = "sezsec_session";

function isPublicPath(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/forgot-password" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/public/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/bridge/")
  ) {
    return true;
  }
  if (/\.(png|jpg|jpeg|svg|gif|webp|ico|ttf|woff|woff2|json)$/i.test(pathname)) {
    return true;
  }
  return false;
}

async function readUserFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret =
      process.env.AUTH_SECRET || "sezsec-jamatevents-jwt-hmac-secret-2026";
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    const user = payload.user as SessionUser | undefined;
    if (!user?.id || !user?.role) return null;
    return user;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const user = await readUserFromRequest(request);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!pathname.startsWith("/api/") && !canAccessPage(pathname, user.role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
