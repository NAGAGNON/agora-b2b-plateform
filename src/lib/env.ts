import "server-only";

function pick(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim() !== "") return v.trim();
  }
  return undefined;
}

function required(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${label}. Voir .env.example.`);
  }
  return value;
}

/**
 * Configuration serveur. Aucune clé Supabase n'est exposée au navigateur :
 * toutes les requêtes passent par le serveur Next.js (Server Components,
 * Server Actions, Route Handlers).
 */
export const env = {
  get supabaseUrl() {
    return required(pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), "SUPABASE_URL");
  },
  get supabasePublishableKey() {
    return required(
      pick("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      "SUPABASE_PUBLISHABLE_KEY",
    );
  },
  get supabaseSecretKey() {
    return required(pick("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SECRET_KEY");
  },
  get siteUrl() {
    return (pick("SITE_URL", "NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get cronSecret() {
    return pick("CRON_SECRET");
  },
  get resendApiKey() {
    return pick("RESEND_API_KEY");
  },
  get emailFrom() {
    return pick("EMAIL_FROM") ?? "LinkProB2B <notifications@example.com>";
  },
  get rateLimitSalt() {
    return pick("RATE_LIMIT_SALT") ?? "linkprob2b-dev-salt";
  },
};
