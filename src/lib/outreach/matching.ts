import { normalizeText } from "@/lib/collect/normalize";
import { NEED_RULES, SECTOR_PROFILES } from "@/lib/outreach/profiles";

/**
 * Moteur de correspondance opportunité ↔ entreprise.
 * Tout est calculé à partir des données réelles (opportunité publiée sur
 * LinkProB2B, fiche entreprise issue d'une source identifiée) ; chaque point
 * du score est justifié par une raison lisible.
 */

export type OpportunityInput = {
  id: string;
  title: string;
  summary: string | null;
  description: string;
  sector_slug: string | null;
  skills: string[];
  keywords: string[];
  department_code: string | null;
  region: string | null;
  response_deadline: string | null;
};

export type OpportunityAnalysis = {
  id: string;
  sector: string | null;
  /** Métiers concernés (règles fines puis profils du secteur). */
  profiles: string[];
  /** Codes NAF directement concernés (règles fines). */
  primaryNaf: string[];
  /** Codes NAF du secteur. */
  sectorNaf: string[];
  keywords: string[];
  department: string | null;
  region: string | null;
};

const STOP = new Set(
  "pour avec dans des les une sur aux par sans entre leur leurs ainsi sont etre cette ces marche marches lot lots accord cadre prestations prestation travaux fourniture fournitures service services mise place realisation relatif relative relatives concernant commune communes ville departement region annee mission missions besoin besoins objet consultation".split(" "),
);

/** Termes significatifs d'un texte (au plus `max`), sans mots vides. */
export function significantTerms(text: string, max = 8): string[] {
  const out: string[] = [];
  for (const w of normalizeText(text).split(" ")) {
    if (w.length < 5 || STOP.has(w) || /^\d+$/.test(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

export function analyzeOpportunity(o: OpportunityInput): OpportunityAnalysis {
  const text = normalizeText([o.title, o.summary, o.description.slice(0, 3000), o.skills.join(" "), o.keywords.join(" ")].join(" "));
  const profiles: string[] = [];
  const primaryNaf: string[] = [];
  // Le titre prime : les règles déclenchées par le titre passent en premier.
  const title = normalizeText(o.title);
  const rules = [...NEED_RULES.filter((r) => r.re.test(title)), ...NEED_RULES.filter((r) => !r.re.test(title) && r.re.test(text))].slice(0, 4);
  for (const r of rules) {
    if (!profiles.includes(r.profile)) profiles.push(r.profile);
    for (const n of r.naf) if (!primaryNaf.includes(n)) primaryNaf.push(n);
  }
  const sector = o.sector_slug && SECTOR_PROFILES[o.sector_slug] ? o.sector_slug : null;
  const sp = sector ? SECTOR_PROFILES[sector] : null;
  for (const p of sp?.profiles ?? []) if (!profiles.includes(p)) profiles.push(p);
  const keywords = [...new Set([...o.skills, ...o.keywords].map((k) => normalizeText(k)).filter((k) => k.length >= 3))].slice(0, 10);
  for (const t of significantTerms(o.title)) if (!keywords.includes(t) && keywords.length < 14) keywords.push(t);
  return {
    id: o.id,
    sector,
    profiles: profiles.slice(0, 6),
    primaryNaf,
    sectorNaf: sp?.naf ?? [],
    keywords,
    department: o.department_code,
    region: o.region,
  };
}

export type ProspectInput = {
  id: string;
  naf_code: string | null;
  naf_label: string | null;
  sectors: string[];
  activity: string | null;
  services: string[];
  keywords: string[];
  department_code: string | null;
  region: string | null;
  intervention_zone: string;
  contacts_count: number;
  last_clicked_at: string | null;
};

export type Match = { score: number; reasons: string[] };

export function relevanceLabel(score: number): string {
  if (score >= 85) return "Très pertinent";
  if (score >= 70) return "Pertinent";
  if (score >= 50) return "Moyennement pertinent";
  return "Peu pertinent";
}

/**
 * Score de pertinence 0–100 :
 *  - activité (45 max) — condition nécessaire : sans activité correspondante, score 0 ;
 *  - localisation (25 max) ;
 *  - compétences / mots-clés (18 max) ;
 *  - historique (−10 à +6) : intérêt déjà manifesté, ou sollicitations restées sans réponse ;
 *  - richesse du profil (+6).
 */
export function scoreMatch(a: OpportunityAnalysis, p: ProspectInput, sectorLabel: (slug: string) => string = (s) => s): Match {
  const reasons: string[] = [];
  let activity = 0;
  const naf = p.naf_code;
  if (naf && a.primaryNaf.includes(naf)) {
    activity = 45;
    reasons.push(`Activité correspondante (NAF ${naf}${p.naf_label ? ` — ${p.naf_label}` : ""})`);
  } else if (naf && a.sectorNaf.includes(naf)) {
    activity = 40;
    reasons.push(`Activité du secteur ${a.sector ? sectorLabel(a.sector) : ""} (NAF ${naf})`.replace(/\s+\(/, " ("));
  } else if (a.sector && p.sectors.includes(a.sector)) {
    activity = 40;
    reasons.push(`Secteur déclaré : ${sectorLabel(a.sector)}`);
  }
  if (activity === 0) return { score: 0, reasons: [] };

  let location = 0;
  if (a.department) {
    if (p.department_code === a.department) {
      location = 25;
      reasons.push(`Située dans le même département (${a.department})`);
    } else if (a.region && p.region === a.region) {
      location = 17;
      reasons.push(`Située dans la même région (${a.region})`);
    } else if (p.intervention_zone === "NATIONAL") {
      location = 12;
      reasons.push("Intervient sur toute la France");
    }
  } else if (a.region) {
    if (p.region === a.region) {
      location = 22;
      reasons.push(`Située dans la région (${a.region})`);
    } else if (p.intervention_zone === "NATIONAL") {
      location = 12;
      reasons.push("Intervient sur toute la France");
    }
  } else {
    location = 15;
    reasons.push("Opportunité sans localisation imposée");
  }

  const text = ` ${normalizeText([p.activity, p.naf_label, p.services.join(" "), p.keywords.join(" ")].join(" "))} `;
  const matched = a.keywords.filter((k) => text.includes(` ${k} `) || (k.length >= 6 && text.includes(k.slice(0, -1))));
  const skills = Math.min(18, matched.length * 6);
  if (matched.length) reasons.push(`Compétences correspondantes : ${matched.slice(0, 3).join(", ")}`);

  let history = 0;
  if (p.last_clicked_at) {
    history += 6;
    reasons.push("A déjà consulté des opportunités envoyées");
  } else if (p.contacts_count >= 2) {
    history -= 10;
  }
  const profile = (p.activity?.length ?? 0) >= 30 || p.services.length > 0 ? 6 : 0;

  return { score: Math.max(0, Math.min(100, activity + location + skills + history + profile)), reasons };
}

export type ProspectMatches = { prospectId: string; score: number; reasons: string[]; opportunities: { id: string; score: number; reasons: string[] }[] };

/**
 * Regroupe les correspondances par entreprise : UN seul e-mail par entreprise,
 * contenant ses opportunités les plus pertinentes (au plus `maxPerEmail`).
 */
export function groupByProspect(
  matches: { prospectId: string; opportunityId: string; score: number; reasons: string[]; deadline?: string | null }[],
  minScore: number,
  maxPerEmail: number,
): ProspectMatches[] {
  const by = new Map<string, typeof matches>();
  for (const m of matches) {
    if (m.score < minScore) continue;
    const list = by.get(m.prospectId) ?? [];
    if (!list.some((x) => x.opportunityId === m.opportunityId)) list.push(m);
    by.set(m.prospectId, list);
  }
  const out: ProspectMatches[] = [];
  for (const [prospectId, list] of by) {
    list.sort((x, y) => y.score - x.score || (x.deadline ?? "9999").localeCompare(y.deadline ?? "9999"));
    const top = list.slice(0, maxPerEmail);
    out.push({
      prospectId,
      score: top[0].score,
      reasons: top[0].reasons,
      opportunities: top.map((m) => ({ id: m.opportunityId, score: m.score, reasons: m.reasons })),
    });
  }
  return out.sort((x, y) => y.score - x.score || y.opportunities.length - x.opportunities.length);
}

/** Empreinte du contenu d'une opportunité : détecte les modifications. */
export function contentFingerprint(o: { title: string; description: string; response_deadline: string | null; department_code: string | null; sector_slug: string | null; status: string }): string {
  const s = [o.title, o.description.length, o.description.slice(0, 500), o.response_deadline ?? "", o.department_code ?? "", o.sector_slug ?? "", o.status].join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Nom affiché d'une campagne (automatique du jour, ou manuelle avec l'heure de lancement). */
export function campaignLabel(c: { campaign_date: string; kind?: string | null; created_at?: string | null }): string {
  const day = new Date(`${c.campaign_date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  if (c.kind !== "MANUAL") return `Campagne du ${day}`;
  const at = c.created_at ? new Date(c.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }) : null;
  return `Campagne manuelle du ${day}${at ? ` à ${at}` : ""}`;
}
