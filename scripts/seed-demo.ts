/**
 * LinkProB2B — chargement des DONNÉES DE DÉMONSTRATION (jeu défini dans src/lib/demo/seed.ts).
 *
 *   npm run seed:demo    # supprime l'ancien jeu démo puis le recrée
 *   npm run seed:clean   # supprime uniquement les données de démonstration
 *
 * Refusé lorsque APP_ENV=production : la production ne contient que des données réelles.
 * Les mots de passe sont générés aléatoirement et écrits dans
 * .demo-credentials.local.md (fichier ignoré par Git). Définir DEMO_PASSWORD
 * pour imposer un mot de passe commun (tests automatisés).
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { seedDemo, wipeDemo } from "../src/lib/demo/seed";

config({ path: ".env.local" });
config();

const clean = process.argv.includes("--clean");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SECRET_KEY sont requis (voir .env.example).");
  process.exit(1);
}
const appEnv = process.env.APP_ENV ?? (process.env.VERCEL_ENV === "production" ? "production" : undefined);
// Base distante : refus par défaut (évite un seed accidentel avec un .env.local pointant vers la production).
const remote = !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
if (remote && !clean && process.env.DEMO_REMOTE !== "staging") {
  console.error("Refusé : base distante. Pour une base de STAGING uniquement, relancer avec DEMO_REMOTE=staging.");
  process.exit(1);
}
if (appEnv === "production" && !clean) {
  console.error("Refusé : APP_ENV=production. Les données de démonstration ne sont jamais chargées en production.");
  process.exit(1);
}
const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  if (clean) {
    await wipeDemo(db);
    console.log("Données de démonstration supprimées (comptes, entreprises, opportunités, source fictive).");
    return;
  }
  console.log("Suppression de l'ancien jeu de démonstration puis création…");
  const { creds, companies, opportunities } = await seedDemo(db, { password: process.env.DEMO_PASSWORD });
  const lines = [
    "# Comptes de démonstration LinkProB2B",
    "",
    "> Données de démonstration — aucune entreprise ou opportunité réelle.",
    "> Fichier local, ignoré par Git. Ne pas partager publiquement.",
    "",
    "| Rôle | E-mail | Mot de passe |",
    "|---|---|---|",
    ...creds.map((c) => `| ${c.label} | ${c.email} | \`${c.password}\` |`),
    "",
  ];
  writeFileSync(".demo-credentials.local.md", lines.join("\n"));
  console.log(`\n${companies} entreprises, ${opportunities} opportunités et ${creds.length} comptes de démonstration créés.`);
  console.log("Identifiants écrits dans .demo-credentials.local.md\n");
  for (const c of creds) console.log(`  ${c.label.padEnd(48)} ${c.email.padEnd(36)} ${c.password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
