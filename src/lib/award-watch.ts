import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOAMP_ENDPOINT } from "@/lib/collect/connectors";

type Db = ReturnType<typeof createAdminClient>;

export type Award = { idweb: string; titulaires: string[]; date: string | null; url: string; cancelled: boolean };

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]).map((s) => s.trim()).filter(Boolean);

/** Avis BOAMP de résultat (ou d'annulation) reliés aux avis de départ donnés, par avis de départ. */
export async function fetchBoampAwards(idwebs: string[], fetcher: typeof fetch = fetch): Promise<Map<string, Award>> {
  const out = new Map<string, Award>();
  const ids = idwebs.filter((x) => /^[\w-]{3,30}$/.test(x));
  if (!ids.length) return out;
  const url = new URL(BOAMP_ENDPOINT);
  url.searchParams.set("where", `annonce_lie in (${ids.map((x) => `"${x}"`).join(",")}) and nature in ("ATTRIBUTION","ANNULATION")`);
  url.searchParams.set("select", "idweb,annonce_lie,titulaire,nature,dateparution,url_avis");
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("limit", "100");
  const res = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`BOAMP HTTP ${res.status}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  for (const r of data.results ?? []) {
    const idweb = String(r.idweb ?? "");
    const url_avis = String(r.url_avis ?? `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(idweb)}`);
    for (const linked of asList(r.annonce_lie)) {
      if (!ids.includes(linked) || out.has(linked)) continue;
      out.set(linked, {
        idweb,
        titulaires: asList(r.titulaire).slice(0, 5),
        date: r.dateparution ? String(r.dateparution).slice(0, 10) : null,
        url: url_avis.startsWith("https://") ? url_avis : `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(idweb)}`,
        cancelled: String(r.nature) === "ANNULATION",
      });
    }
  }
  return out;
}

/**
 * Après le dépôt : recherche, une fois par jour, l'avis de résultat publié au BOAMP pour chaque
 * candidature envoyée. Trouvé : enregistré sur la candidature (fiche, journal) et notification sur le
 * site aux membres de l'entreprise (pas d'e-mail).
 */
export async function processAwardWatch(db: Db = createAdminClient(), { limit = 80, fetcher = fetch as typeof fetch } = {}) {
  const since = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const { data: items, error } = await db
    .from("pipeline_items")
    .select("id, company_id, opportunity_id, award_checked_at, opportunity:opportunities!inner(title)")
    .eq("stage", "RESPONSE_SENT")
    .is("award", null)
    .or(`award_checked_at.is.null,award_checked_at.lt.${since}`)
    .limit(limit);
  if (error) throw error;
  if (!items?.length) return { checked: 0, found: 0 };
  const { data: sources } = await db
    .from("opportunity_sources")
    .select("opportunity_id, external_id, external_source:external_sources!inner(code)")
    .in("opportunity_id", items.map((i) => i.opportunity_id))
    .eq("external_source.code", "boamp");
  const idwebByOpp = new Map<string, string>();
  for (const s of sources ?? []) if (s.external_id) idwebByOpp.set(s.opportunity_id, s.external_id);
  const awards = await fetchBoampAwards([...new Set(idwebByOpp.values())], fetcher);

  let found = 0;
  const now = new Date().toISOString();
  for (const i of items) {
    const idweb = idwebByOpp.get(i.opportunity_id);
    const award = idweb ? awards.get(idweb) : undefined;
    if (!award) {
      await db.from("pipeline_items").update({ award_checked_at: now }).eq("id", i.id);
      continue;
    }
    const { data: saved } = await db.from("pipeline_items").update({ award, award_checked_at: now }).eq("id", i.id).is("award", null).select("id");
    if (!saved?.length) continue;
    found++;
    const o = (Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity) as { title: string };
    const who = award.titulaires.join(", ");
    const body = award.cancelled
      ? `L'acheteur a publié un avis d'annulation pour « ${o.title} ».`
      : `Le résultat de « ${o.title} » est publié au BOAMP${who ? ` : marché attribué à ${who}` : ""}. Indiquez si c'est votre entreprise en un clic.`;
    await db.from("application_journal").insert({ company_id: i.company_id, opportunity_id: i.opportunity_id, user_id: null, kind: "NOTE", body: `Avis officiel publié${award.date ? ` le ${award.date.split("-").reverse().join("/")}` : ""} : ${award.cancelled ? "consultation annulée" : who ? `attribué à ${who}` : "résultat publié"}.` });
    await db.rpc("notify_company", {
      p_company_id: i.company_id,
      p_type: "application_result",
      p_title: (award.cancelled ? `Consultation annulée : ${o.title}` : `Résultat publié : ${o.title}`).slice(0, 200),
      p_body: body.slice(0, 1000),
      p_link: `/dashboard/candidatures/${i.opportunity_id}`,
      p_send_email: false,
    });
  }
  return { checked: items.length, found };
}
