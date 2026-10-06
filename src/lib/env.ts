import "server-only";
import { siteUrl } from "@/lib/seo";

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
export type AppEnv = "development" | "staging" | "production";

export const env = {
  /** Configuration publique du temps réel (URL et clé publique, protégées par RLS). */
  get realtime() {
    return { url: env.supabaseUrl, key: env.supabasePublishableKey };
  },
  get supabaseUrl() {
    return required(pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), "SUPABASE_URL");
  },
  /** URL utilisée par le serveur (réseau interne si disponible, sinon l'URL publique). */
  get supabaseServerUrl() {
    return pick("SUPABASE_INTERNAL_URL") ?? env.supabaseUrl;
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
    return siteUrl();
  },
  /**
   * Environnement applicatif : development (poste local), staging (prévisualisation,
   * données de démonstration autorisées) ou production (données réelles uniquement).
   * APP_ENV prime ; à défaut, déduit de VERCEL_ENV.
   */
  get appEnv(): AppEnv {
    const v = pick("APP_ENV");
    if (v === "production" || v === "staging" || v === "development") return v;
    if (process.env.VERCEL_ENV === "production") return "production";
    if (process.env.VERCEL_ENV === "preview") return "staging";
    return "development";
  },
  get isProduction() {
    return env.appEnv === "production";
  },
  /** Adresse du premier super-administrateur (promu automatiquement à sa première connexion). */
  get initialAdminEmail() {
    return pick("INITIAL_ADMIN_EMAIL")?.toLowerCase();
  },
  get cronSecret() {
    // Sur Vercel, CRON_SECRET est fourni à la tâche planifiée ; sans lui, /api/cron est fermé.
    return pick("CRON_SECRET");
  },
  get resendApiKey() {
    return pick("RESEND_API_KEY");
  },
  /**
   * Boîte d'e-mails de test (Mailpit, fournie par Supabase local) : hors production
   * uniquement. Les e-mails y sont réellement envoyés et consultables, sans sortir.
   */
  get mailpitUrl() {
    const v = pick("MAILPIT_URL");
    return v && !env.isProduction ? v.replace(/\/$/, "") : undefined;
  },
  /** Transport d'e-mail actif : resend (réel), mailpit (boîte de test) ou aucun. */
  get emailTransport(): "resend" | "mailpit" | null {
    return env.resendApiKey ? "resend" : env.mailpitUrl ? "mailpit" : null;
  },
  get emailFrom() {
    return pick("EMAIL_FROM") ?? "LinkProB2B <notifications@linkprob2b.fr>";
  },
  get rateLimitSalt() {
    // À défaut de sel dédié, dérivé de la clé secrète (jamais exposée) pour rester imprévisible.
    return pick("RATE_LIMIT_SALT") ?? pick("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")?.slice(-24) ?? "linkprob2b-dev-salt";
  },
};
