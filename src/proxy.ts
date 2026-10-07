import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/supabase/cookie";
import { siteUrl } from "@/lib/seo";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/onboarding", "/outreach"];

/**
 * LinkProB2B Outreach est servi sur son propre sous-domaine (outreach.linkprob2b.com).
 * Sur ce domaine, seules l'application Outreach et les pages de connexion sont
 * accessibles ; tout le reste renvoie vers le site public.
 */
const OUTREACH_ALLOWED = ["/outreach", "/api/", "/connexion", "/auth/", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/dashboard/parametres", "/_next/", "/brand/"];

function outreachHostRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("outreach.")) return null;
  const path = request.nextUrl.pathname;
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/outreach";
    return NextResponse.redirect(url);
  }
  if (OUTREACH_ALLOWED.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path === p)) return null;
  return NextResponse.redirect(new URL(path + request.nextUrl.search, siteUrl()));
}

/**
 * Rafraîchit la session Supabase et protège les espaces privés.
 * Les contrôles d'autorisation fins sont faits côté serveur (pages, actions)
 * et en base (RLS) — ce proxy n'est qu'une première barrière.
 */
export async function proxy(request: NextRequest) {
  const hostRedirect = outreachHostRedirect(request);
  if (hostRedirect) return hostRedirect;
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions(siteUrl().startsWith("https://")),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/connexion";
    redirect.search = `?suite=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
