import { NextResponse, type NextRequest } from "next/server";

// Contrôle optimiste : sans cookie de session on renvoie vers /login. La vraie autorisation est faite par l'API (401).
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api")) return NextResponse.next();
  if (!req.cookies.get("rai_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"] };
