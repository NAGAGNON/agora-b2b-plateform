import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOAMP_ENDPOINT } from "@/lib/collect/connectors";

type Db = ReturnType<typeof createAdminClient>;

export type Award = { idweb: string; titulaires: string[]; date: string | null; url: string; cancelled: boolean; sirens?: string[]; won?: boolean };

/** Nom d'entreprise comparable : minuscules, sans accents, sans forme juridique ni ponctuation. */
export function normalizeCompanyName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(sas|sasu|sarl|eurl|sa|sci|snc|ei|eirl|scop|societe|ste|ets|etablissements|groupe)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** L'entreprise est-elle désignée titulaire ? SIREN cité dans l'avis (sûr), sinon nom identique. */
export function isWinner(award: Pick<Award, "titulaires" | "sirens">, company: { siren: string | null; name: string }): { won: boolean; sure: boolean } {
  const siren = (company.siren ?? "").replace(/\D/g, "");
  if (siren.length === 9 && (award.sirens ?? []).includes(siren)) return { won: true, sure: true };
  const mine = normalizeCompanyName(company.name);
  if (mine.length >= 3 && award.titulaires.some((t) => normalizeCompanyName(t) === mine)) return { won: true, sure: false };
  return { won: false, sure: false };
}

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]).map((s) => s.trim()).filter(Boolean);

/** Avis BOAMP de résultat (ou d'annulation) reliés aux avis de départ donnés, par avis de départ. */
export async function fetchBoampAwards(idwebs: string[], fetcher: typeof fetch = fetch): Promise<Map<string, Award>> {
  const out = new Map<string, Award>();
  const ids = idwebs.filter((x) => /^[\w-]{3,30}$/.test(x));
  if (!ids.length) return out;
  const url = new URL(BOAMP_ENDPOINT);
  url.searchParams.set("where", `annonce_lie in (${ids.map((x) => `"${x}"`).join(",")}) and nature in ("ATTRIBUTION","ANNULATION")`);
  url.searchParams.set("select", "idweb,annonce_lie,titulaire,nature,dateparution,url_avis,donnees");
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("limit", "100");
  const res = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`BOAMP HTTP ${res.status}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  for (const r of data.results ?? []) {
    const idweb = String(r.idweb ?? "");
    const url_avis = String(r.url_avis ?? `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(idweb)}`);
    // SIRET des organisations citées dans l'avis (acheteur et titulaires) : les 9 premiers chiffres = SIREN
    const raw = typeof r.donnees === "string" ? r.donnees : JSON.stringify(r.donnees ?? "");
    const sirens = [...new Set([...raw.matchAll(/"CompanyID"\s*:\s*"(\d{14}|\d{9})"/g)].map((m) => m[1].slice(0, 9)))];
    for (const linked of asList(r.annonce_lie)) {
      if (!ids.includes(linked) || out.has(linked)) continue;
      out.set(linked, {
        idweb,
        titulaires: asList(r.titulaire).slice(0, 5),
        date: r.dateparution ? String(r.dateparution).slice(0, 10) : null,
        url: url_avis.startsWith("https://") ? url_avis : `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(idweb)}`,
        cancelled: String(r.nature) === "ANNULATION",
        sirens,
      });
    }
  }
  return out;
}

/**
 * Après le dépôt : recherche, une fois par jour, l'avis de résultat publié au BOAMP pour chaque
 * candidature envoyée. Trouvé : enregistré sur la candidature (fiche, journal) et notification sur le
 * site et e-mail aux membres de l'entreprise. Si l'avis cite le SIREN de l'entreprise, elle est prévenue
 * qu'elle a gagné et la candidature passe à « Gagné ».
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

  const { data: companies } = await db.from("companies").select("id, name, siren").in("id", [...new Set(items.map((i) => i.company_id))]);
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));

  let found = 0;
  const now = new Date().toISOString();
  for (const i of items) {
    const idweb = idwebByOpp.get(i.opportunity_id);
    const award = idweb ? awards.get(idweb) : undefined;
    if (!award) {
      await db.from("pipeline_items").update({ award_checked_at: now }).eq("id", i.id);
      continue;
    }
    const company = companyById.get(i.company_id);
    const verdict = company && !award.cancelled ? isWinner(award, company) : { won: false, sure: false };
    const stored: Award = { ...award, won: verdict.won };
    const { data: saved } = await db.from("pipeline_items").update({ award: stored, award_checked_at: now }).eq("id", i.id).is("award", null).select("id");
    if (!saved?.length) continue;
    found++;
    const o = (Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity) as { title: string };
    const who = award.titulaires.join(", ");
    const day = award.date ? award.date.split("-").reverse().join("/") : null;
    // SIREN de l'entreprise cité comme titulaire : marché gagné, la candidature passe à « Gagné »
    if (verdict.won && verdict.sure) {
      await db.from("pipeline_items").update({ stage: "WON" }).eq("id", i.id);
    }
    const title = award.cancelled
      ? `Consultation annulée : ${o.title}`
      : verdict.won
        ? verdict.sure
          ? `Bonne nouvelle : vous avez remporté « ${o.title} »`
          : `Bonne nouvelle : votre entreprise semble avoir remporté « ${o.title} »`
        : `Résultat publié : ${o.title}`;
    const body = award.cancelled
      ? `L'acheteur a publié un avis d'annulation pour « ${o.title} »${day ? ` le ${day}` : ""}. Le lien vers l'avis officiel est sur votre fiche de candidature.`
      : verdict.won && verdict.sure
        ? `L'avis de résultat publié au BOAMP${day ? ` le ${day}` : ""} désigne votre entreprise${who ? ` (${who})` : ""} comme titulaire du marché « ${o.title} ». Félicitations ! Pensez à l'ajouter à vos références : il comptera pour les prochains.`
        : verdict.won
          ? `L'avis de résultat publié au BOAMP${day ? ` le ${day}` : ""} désigne « ${who} » comme titulaire du marché « ${o.title} ». C'est votre entreprise ? Félicitations ! Confirmez-le en un clic sur votre fiche de candidature.`
        : `L'avis de résultat de « ${o.title} » est publié au BOAMP${day ? ` le ${day}` : ""}${who ? ` : marché attribué à ${who}` : ""}. Si ce n'est pas votre entreprise, vous pouvez demander à l'acheteur les motifs du choix : le modèle de lettre est prêt sur votre fiche de candidature.`;
    await db.from("application_journal").insert({
      company_id: i.company_id,
      opportunity_id: i.opportunity_id,
      user_id: null,
      kind: verdict.won && verdict.sure ? "WON" : "NOTE",
      body: `Avis officiel publié${day ? ` le ${day}` : ""} : ${award.cancelled ? "consultation annulée" : verdict.won ? `marché remporté${who ? ` (${who})` : ""}` : who ? `attribué à ${who}` : "résultat publié"}.`,
    });
    // Notification sur le site et e-mail (validé par le fondateur le 20/11)
    await db.rpc("notify_company", {
      p_company_id: i.company_id,
      p_type: "application_result",
      p_title: title.slice(0, 200),
      p_body: body.slice(0, 1000),
      p_link: `/dashboard/candidatures/${i.opportunity_id}`,
      p_send_email: true,
    });
  }
  return { checked: items.length, found };
}
