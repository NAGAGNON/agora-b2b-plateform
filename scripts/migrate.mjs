/**
 * LinkProB2B — application des migrations SQL (supabase/migrations) au déploiement.
 *
 *   node scripts/migrate.mjs            # applique les migrations manquantes
 *   node scripts/migrate.mjs --status   # liste l'état sans rien modifier
 *
 * Connexion : DATABASE_URL, ou POSTGRES_URL_NON_POOLING (fournie par l'intégration
 * Vercel ↔ Supabase), ou SUPABASE_DB_URL. Sans URL, le script ne fait rien (build
 * local, CI de qualité) sauf si MIGRATIONS_REQUIRED=1.
 *
 * Prévisualisations Vercel : ignorées sauf MIGRATIONS_ON_PREVIEW=1 (base de staging dédiée).
 *
 * Garanties :
 *  - chaque migration s'exécute dans une transaction : en cas d'erreur, rien n'est
 *    appliqué et le build échoue — Vercel conserve alors le déploiement précédent ;
 *  - verrou consultatif : deux déploiements simultanés ne migrent pas en parallèle ;
 *  - journal compatible avec la CLI Supabase (supabase_migrations.schema_migrations).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const statusOnly = process.argv.includes("--status");
const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.SUPABASE_DB_URL;

// Production Vercel sans base : on fait échouer le build (Vercel garde alors la version
// précédente) plutôt que de mettre en ligne un site sans données.
if (process.env.VERCEL_ENV === "production" && !statusOnly) {
  const missing = [
    !raw && "POSTGRES_URL_NON_POOLING (ou DATABASE_URL)",
    !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && "SUPABASE_URL",
    !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) && "SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY)",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`[migrations] Base Supabase non connectée à ce projet Vercel. Variables absentes : ${missing.join(", ")}.`);
    console.error("[migrations] Vercel → Storage → Create Database → Supabase (ou Connect sur un projet existant), environnements Production + Preview, sans préfixe ; puis Redeploy.");
    process.exit(1);
  }
}

if (!raw) {
  if (process.env.MIGRATIONS_REQUIRED === "1") {
    console.error("[migrations] Aucune URL de base de données (DATABASE_URL / POSTGRES_URL_NON_POOLING).");
    process.exit(1);
  }
  console.log("[migrations] Aucune URL de base de données : étape ignorée.");
  process.exit(0);
}

// Déploiements de prévisualisation Vercel : par défaut ils partagent souvent la base de
// production — on ne la migre pas depuis une branche. Utiliser un projet Supabase dédié
// au staging et définir MIGRATIONS_ON_PREVIEW=1 dans l'environnement « Preview ».
if (process.env.VERCEL_ENV === "preview" && process.env.MIGRATIONS_ON_PREVIEW !== "1" && !statusOnly) {
  console.log("[migrations] Prévisualisation Vercel : migrations non appliquées (MIGRATIONS_ON_PREVIEW≠1).");
  process.exit(0);
}

// Connexion chiffrée. Le certificat de Supabase est signé par une autorité propre à
// Supabase (absente du magasin de Node) : fournir DATABASE_CA_CERT (contenu PEM,
// Project Settings → Database → SSL) pour une vérification complète.
const url = new URL(raw);
const local = ["localhost", "127.0.0.1"].includes(url.hostname);
url.searchParams.delete("sslmode");
url.searchParams.delete("supa");
const ssl = local ? false : process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true } : { rejectUnauthorized: false };

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: "linkprob2b-migrate" });
await client.connect();
try {
  await client.query("select pg_advisory_lock(727274001)");
  await client.query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
  const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
  const done = new Set(rows.map((r) => r.version));
  const pending = files.filter((f) => !done.has(f.split("_")[0]));
  console.log(`[migrations] ${files.length} migration(s), ${files.length - pending.length} déjà appliquée(s), ${pending.length} à appliquer.`);
  if (statusOnly) {
    for (const f of files) console.log(`  ${done.has(f.split("_")[0]) ? "✓" : "·"} ${f}`);
  } else {
    for (const f of pending) {
      const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
      const sql = readFileSync(join(dir, f), "utf8");
      const started = Date.now();
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)", [version, rest.join("_"), [sql]]);
        await client.query("commit");
        console.log(`[migrations] ✓ ${f} (${Date.now() - started} ms)`);
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        console.error(`[migrations] ✗ ${f} : ${e instanceof Error ? e.message : e}`);
        console.error("[migrations] Aucune modification de cette migration n'a été conservée. Déploiement interrompu.");
        process.exitCode = 1;
        break;
      }
    }
  }
  // Marqueur d'environnement en base : la production refuse ensuite tout chargement de démonstration.
  if (!statusOnly && process.exitCode !== 1 && (process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production")) {
    await client.query(
      `insert into public.platform_settings (key, value, description) values ('private.environment', '{"name": "production"}', 'Environnement de cette base (posé au déploiement)')
       on conflict (key) do update set value = excluded.value`,
    );
    console.log("[migrations] Base marquée « production ».");
  }
} finally {
  await client.query("select pg_advisory_unlock(727274001)").catch(() => undefined);
  await client.end();
}
