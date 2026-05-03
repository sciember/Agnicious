import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function useSecureSessionCookie(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  return request.nextUrl.protocol === "https:";
}

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[auth] NEXTAUTH_SECRET is missing in middleware (Edge)");
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const token = await getToken({
    req: request,
    secret,
    secureCookie: useSecureSessionCookie(request),
  });

  if (!token) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tasks/:path*",
    "/habits/:path*",
    "/calendar/:path*",
    "/analytics/:path*",
    "/social/:path*",
    "/ai-coach/:path*",
  ],
};
