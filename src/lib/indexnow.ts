import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

/**
 * IndexNow : signale à Bing, Yandex, Seznam, Naver… les pages nouvelles ou modifiées,
 * pour une indexation en quelques heures. La clé est publiée sur /indexnow.txt.
 * Dérivée d'un secret serveur si INDEXNOW_KEY n'est pas défini (stable entre déploiements).
 */
export function indexNowKey(): string | null {
  const explicit = process.env.INDEXNOW_KEY?.trim();
  if (explicit) return explicit;
  const seed = env.cronSecret ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return seed ? createHash("sha256").update(`indexnow:${seed}`).digest("hex").slice(0, 32) : null;
}

/** Envoie les URL publiques modifiées depuis le dernier envoi réussi (production uniquement). */
export async function submitChangedUrls() {
  const key = indexNowKey();
  if (!env.isProduction) return { skipped: "hors production" };
  if (!key) return { skipped: "aucune clé" };
  const base = siteUrl();
  const host = new URL(base).host;
  if (host.endsWith(".vercel.app") || host.startsWith("localhost")) return { skipped: `domaine ${host}` };

  const db = createAdminClient();
  const { data: state } = await db.from("platform_settings").select("value").eq("key", "private.indexnow").maybeSingle();
  const since = (state?.value as { last_at?: string } | null)?.last_at ?? new Date(Date.now() - 86400_000).toISOString();
  const startedAt = new Date().toISOString();
  // Lecture par pages (1000 lignes au plus par requête), dans l'ordre des modifications : au-delà de
  // 9000 annonces, la suite part au passage suivant (reprise à la dernière date envoyée).
  const MAX_OPPS = 9000;
  const opps: { id: string; updated_at: string }[] = [];
  for (let from = 0; from < MAX_OPPS; from += 1000) {
    const { data } = await db.from("opportunities").select("id, updated_at").eq("status", "PUBLISHED").eq("visibility", "PUBLIC").eq("is_demo", false).gt("updated_at", since).order("updated_at").range(from, from + 999);
    opps.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const truncated = opps.length >= MAX_OPPS;
  const articles = await db.from("articles").select("slug").eq("status", "PUBLISHED").gt("updated_at", since).limit(500);
  const urls = [...opps.map((o) => `${base}/opportunites/${o.id}`), ...(articles.data ?? []).map((a) => `${base}/analyses/${a.slug}`)];
  if (urls.length) urls.push(`${base}/opportunites`, `${base}/analyses`);
  if (!urls.length) return { submitted: 0 };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${base}/indexnow.txt`, urlList: urls.slice(0, 10000) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok && res.status !== 202) throw new Error(`IndexNow HTTP ${res.status}`);
  await db.from("platform_settings").upsert({ key: "private.indexnow", value: { last_at: truncated ? opps[opps.length - 1].updated_at : startedAt, last_count: urls.length }, description: "Dernier envoi IndexNow" });
  return { submitted: urls.length, status: res.status };
}
