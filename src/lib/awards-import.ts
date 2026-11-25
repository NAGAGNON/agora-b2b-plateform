import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOAMP_ENDPOINT } from "@/lib/collect/connectors";
import { logServerError } from "@/lib/errors";
import { mapAward, type AwardRow } from "@/lib/awards-core";

type Fetcher = (url: string) => Promise<Response>;
const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Avis d'attribution BOAMP publiés un jour donné (toutes les pages de résultats). */
async function fetchDay(day: string, fetcher: Fetcher): Promise<AwardRow[]> {
  const rows: AwardRow[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const url = new URL(BOAMP_ENDPOINT);
    url.searchParams.set("where", `nature="ATTRIBUTION" AND titulaire is not null AND dateparution=date'${day}'`);
    url.searchParams.set("select", "idweb,objet,nomacheteur,titulaire,dateparution,code_departement,descripteur_libelle,type_marche,url_avis");
    url.searchParams.set("order_by", "idweb");
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    const res = await fetcher(url.toString());
    if (!res.ok) throw new Error(`BOAMP ${res.status}`);
    const results = ((await res.json()) as { results?: Record<string, unknown>[] }).results ?? [];
    for (const r of results) {
      const row = mapAward(r);
      if (row) rows.push(row);
    }
    if (results.length < 100) break;
  }
  return rows;
}

async function store(db: ReturnType<typeof createAdminClient>, rows: AwardRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("awards").upsert(rows.slice(i, i + 500), { onConflict: "idweb", ignoreDuplicates: true });
    if (error) throw error;
  }
}

/**
 * Résultats des marchés (avis d'attribution BOAMP) : les 3 derniers jours à chaque passage, puis le
 * rattrapage des 12 derniers mois, jour par jour en remontant le temps, dans la limite du temps donné
 * (curseur dans platform_settings « awards.backfill »). Données publiques, aucune IA.
 */
export async function importAwards(db = createAdminClient(), { deadline = Date.now() + 120_000, fetcher = fetch as Fetcher, now = new Date() }: { deadline?: number; fetcher?: Fetcher; now?: Date } = {}) {
  let stored = 0;
  let days = 0;
  try {
    for (let i = 0; i < 3; i++) {
      const rows = await fetchDay(ymd(new Date(now.getTime() - i * DAY)), fetcher);
      await store(db, rows);
      stored += rows.length;
      days++;
    }
    const { data: setting } = await db.from("platform_settings").select("value").eq("key", "awards.backfill").maybeSingle();
    const v = (setting?.value ?? {}) as { next?: string; stop?: string };
    let next = v.next ? new Date(v.next) : new Date(now.getTime() - 3 * DAY);
    const stop = v.stop ? new Date(v.stop) : new Date(now.getTime() - 365 * DAY);
    while (next >= stop && Date.now() < deadline) {
      const rows = await fetchDay(ymd(next), fetcher);
      await store(db, rows);
      stored += rows.length;
      days++;
      next = new Date(next.getTime() - DAY);
      await db.from("platform_settings").upsert({ key: "awards.backfill", value: { next: ymd(next), stop: ymd(stop) } as never });
    }
    return { stored, days, backfill: next >= stop ? `jusqu'au ${ymd(next)}` : "terminé" };
  } catch (e) {
    logServerError("awards import", e);
    return { stored, days, error: true };
  }
}
