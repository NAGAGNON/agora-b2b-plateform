import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { stripeConfigured, stripeMode } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/**
 * Point de supervision (moniteur de disponibilité, vérification après déploiement).
 * Ne révèle aucun secret : uniquement des indicateurs de configuration (oui / non).
 * 200 si la base répond, 503 sinon.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, unknown> = {};
  let healthy = true;
  try {
    const db = createAdminClient();
    const [settings, migrations] = await Promise.all([
      db.from("platform_settings").select("key, value").in("key", ["private.cron"]),
      db.from("sectors").select("slug", { count: "exact", head: true }),
    ]);
    if (settings.error || migrations.error) throw new Error("requête en échec");
    const cron = settings.data?.find((s) => s.key === "private.cron")?.value as { last_run_at?: string; failed_steps?: string[] } | undefined;
    checks.database = "ok";
    checks.cronLastRun = cron?.last_run_at ?? null;
    checks.cronFailedSteps = cron?.failed_steps ?? [];
  } catch {
    healthy = false;
    checks.database = "indisponible";
  }
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      environment: env.appEnv,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      configuration: {
        email: env.emailTransport ?? false,
        cronSecret: Boolean(env.cronSecret),
        initialAdmin: Boolean(env.initialAdminEmail),
        // Paiement : indicateurs uniquement (aucune clé ni identifiant de prix n'est exposé)
        stripe: {
          mode: stripeMode() ?? false,
          secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
          webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
          proPrice: Boolean(process.env.STRIPE_PRO_PRICE_ID),
          businessPrice: Boolean(process.env.STRIPE_BUSINESS_PRICE_ID),
          taxRate: Boolean(process.env.STRIPE_TAX_RATE_ID),
          checkoutReady: stripeConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET),
          liveAllowed: process.env.STRIPE_ALLOW_LIVE === "1",
        },
        supabase: Boolean(
          (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
            (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
        ),
      },
      checks,
      durationMs: Date.now() - started,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
