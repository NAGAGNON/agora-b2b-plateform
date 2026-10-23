import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/supabase/cookie";
import { siteUrl } from "@/lib/seo";

const PROXY_TIMEOUT_MS = 3000;
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
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  // Visiteur sans session (la grande majorité, robots compris) : rien à rafraîchir, aucun appel —
  // économise le temps de calcul facturé par Vercel à chaque page vue.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith(SESSION_COOKIE));
  if (!hasSession && !isProtected) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  // Supabase lent ou indisponible : chaque appel est coupé au bout de 3 s, pour que la page
  // s'affiche (ou renvoie vers la connexion) au lieu de dépasser le délai du proxy (erreur 504).
  const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(PROXY_TIMEOUT_MS) });
  const supabase = createServerClient(url, key, {
    global: { fetch: timedFetch },
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

  // Jeton vérifié localement (clé publique du projet mise en cache) : pas d'aller-retour vers le
  // serveur d'authentification à chaque clic. Le jeton expiré est rafraîchi ici (cookies mis à jour).
  const claims = await Promise.race([
    supabase.auth.getClaims().catch(() => null),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), PROXY_TIMEOUT_MS + 500)),
  ]);
  // Pas de réponse à temps : la page décide (contrôles côté serveur), sans bloquer le visiteur
  if (claims === "timeout") return response;
  const user = claims?.data?.claims?.sub ?? null;

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/connexion";
    redirect.search = `?suite=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  }

  return response;
}

/*
 * Le proxy ne s'exécute que lorsqu'il sert à quelque chose (chaque exécution est facturée en temps
 * de calcul par Vercel) : espaces privés, visiteurs connectés (rafraîchissement de la session) et
 * sous-domaine Outreach. Les visiteurs anonymes et les robots d'indexation, la très grande majorité
 * des requêtes, ne le déclenchent plus.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/outreach/:path*",
    {
      source: "/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
      has: [{ type: "cookie", key: "sb-linkprob2b-auth-token" }],
    },
    {
      source: "/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
      has: [{ type: "cookie", key: "sb-linkprob2b-auth-token.0" }],
    },
    {
      source: "/((?!_next/static|_next/image).*)",
      has: [{ type: "host", value: "outreach\\..*" }],
    },
  ],
};
