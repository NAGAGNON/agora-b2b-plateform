import { matchedSkill } from "@/lib/skill-catalog";

/**
 * Compatibilité entre une entreprise et un appel d'offres : une note sur 100 et ses raisons.
 * Calcul simple et explicable, sans IA ni estimation : seuls les points connus des deux côtés
 * comptent. Ce qu'on ne sait pas est affiché « à vérifier » et n'abaisse jamais la note.
 */

export type CompatCompany = {
  sectors: string[];
  skills: string[];
  certifications: string[];
  department: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
  zone: string | null;
};

export type CompatOffer = {
  title: string;
  summary: string | null;
  sector_slug: string | null;
  department_code: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
};

/** Ce que l'avis exige (fiche « En bref ») ; null si la fiche n'est pas encore rédigée. */
export type CompatRequirements = { certifications: string[]; capacity: string[] } | null;

export type CompatStatus = "ok" | "partial" | "missing" | "unknown";
export type CompatItem = { key: "trade" | "zone" | "certifications" | "capacity"; status: CompatStatus; label: string; detail?: string };

/** Question posée au membre : une certification absente de sa fiche, ou une autre condition de l'avis. */
export type CompatQuestion = { text: string; kind: "cert" | "capacity"; answer: boolean | null };
/** Réponses du membre, par texte de l'exigence (true = « Je l'ai », false = « Je ne l'ai pas »). */
export type CompatAnswers = Record<string, boolean>;

export type Compatibility = {
  /** null quand trop peu d'éléments sont connus pour donner une note honnête */
  score: number | null;
  level: "high" | "good" | "partial" | "low" | null;
  levelLabel: string;
  items: CompatItem[];
  advice: string[];
  /** Une certification exigée n'est pas sur la fiche : proposer un partenaire */
  suggestPartner: boolean;
  /** La fiche de l'entreprise manque d'informations utiles au calcul */
  profileIncomplete: boolean;
  /** Questions pour préciser la note (certifications absentes de la fiche, autres conditions) */
  questions: CompatQuestion[];
};

const WEIGHTS = { trade: 45, zone: 30, certifications: 25, capacity: 15 } as const;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const GENERIC = new Set(["ou", "equivalent", "et", "de", "des", "la", "le", "les", "du", "certification", "qualification", "label", "norme", "habilitation", "attestation", "en", "cours", "validite", "pour", "un", "une", "a"]);

/** Mots qui identifient une certification : « Qualibat 1311 ou équivalent » → qualibat, 1311 */
function keyTokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !GENERIC.has(t));
}

/** L'entreprise déclare-t-elle une certification qui correspond à l'exigence ? */
export function certificationMatch(required: string, owned: string[]): boolean {
  const req = keyTokens(required);
  if (req.length === 0) return false;
  const brand = req.find((t) => /[a-z]/.test(t)) ?? req[0];
  return owned.some((o) => {
    const own = new Set(keyTokens(o));
    if (!own.has(brand)) return false;
    // Numéro précis demandé (ex. 1311, 9001) : il doit être déclaré aussi, sinon on reste prudent
    const numbers = req.filter((t) => /^\d+$/.test(t));
    return numbers.length === 0 || numbers.some((n) => own.has(n)) || ![...own].some((t) => /^\d+$/.test(t));
  });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const NATIONAL = /france enti[eè]re|toute la france|national|partout en france/i;

export function computeCompatibility(o: CompatOffer, c: CompatCompany, req: CompatRequirements, tradeName?: string | null, answers: CompatAnswers = {}): Compatibility {
  const items: CompatItem[] = [];
  const questions: CompatQuestion[] = [];
  const advice: string[] = [];
  let earned = 0;
  let max = 0;

  // 1. Métier
  const skill = matchedSkill(c.skills, `${o.title} ${o.summary ?? ""}`);
  if (o.sector_slug && c.sectors.includes(o.sector_slug)) {
    earned += WEIGHTS.trade;
    max += WEIGHTS.trade;
    items.push({ key: "trade", status: "ok", label: "Votre métier correspond", detail: tradeName ?? undefined });
  } else if (skill) {
    earned += Math.round(WEIGHTS.trade * 0.75);
    max += WEIGHTS.trade;
    items.push({ key: "trade", status: "partial", label: "Un de vos savoir-faire est cité", detail: `« ${skill} »` });
  } else if (o.sector_slug && c.sectors.length > 0) {
    max += WEIGHTS.trade;
    items.push({ key: "trade", status: "missing", label: "Ce n'est pas le métier indiqué sur votre fiche", detail: tradeName ?? undefined });
    advice.push("Si vous faites ce travail, ajoutez ce métier à votre fiche ; sinon, proposez-vous en sous-traitance à une entreprise du métier.");
  } else {
    items.push({ key: "trade", status: "unknown", label: "Métier à vérifier", detail: c.sectors.length === 0 ? "Votre fiche n'indique pas votre métier" : "L'avis ne précise pas de métier" });
  }

  // 2. Zone
  const km = o.lat != null && o.lng != null && c.lat != null && c.lng != null ? Math.round(distanceKm({ lat: o.lat, lng: o.lng }, { lat: c.lat, lng: c.lng })) : null;
  if (o.department_code && c.department && o.department_code === c.department) {
    earned += WEIGHTS.zone;
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "ok", label: "Dans votre département", detail: km != null ? (km < 3 ? "tout près de chez vous" : `à environ ${km} km`) : undefined });
  } else if (km != null && c.radiusKm && km <= c.radiusKm) {
    earned += WEIGHTS.zone;
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "ok", label: "Dans votre zone d'intervention", detail: `à environ ${km} km (vous intervenez jusqu'à ${c.radiusKm} km)` });
  } else if (c.zone && NATIONAL.test(c.zone)) {
    earned += WEIGHTS.zone;
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "ok", label: "Vous intervenez dans toute la France" });
  } else if (o.region && c.region && o.region === c.region) {
    earned += Math.round(WEIGHTS.zone * 0.7);
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "partial", label: "Dans votre région", detail: km != null ? `à environ ${km} km` : o.region });
  } else if ((o.department_code || o.region) && (c.department || c.region)) {
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "missing", label: "Hors de votre zone habituelle", detail: km != null ? `à environ ${km} km` : (o.region ?? undefined) });
    advice.push("Le lieu est loin de chez vous : comptez les déplacements dans votre prix, ou répondez avec un partenaire proche du lieu.");
  } else {
    items.push({ key: "zone", status: "unknown", label: "Lieu à vérifier", detail: o.department_code || o.region ? "Votre fiche n'indique pas votre ville" : "L'avis ne précise pas le lieu" });
  }

  // 3. Certifications exigées
  if (req) {
    if (req.certifications.length === 0) {
      earned += WEIGHTS.certifications;
      max += WEIGHTS.certifications;
      items.push({ key: "certifications", status: "ok", label: "Aucune certification exigée dans l'avis" });
    } else {
      const notOnProfile = req.certifications.filter((x) => !certificationMatch(x, c.certifications));
      for (const x of notOnProfile) questions.push({ text: x, kind: "cert", answer: answers[x] ?? null });
      const missing = notOnProfile.filter((x) => answers[x] !== true);
      const share = (req.certifications.length - missing.length) / req.certifications.length;
      earned += Math.round(WEIGHTS.certifications * share);
      max += WEIGHTS.certifications;
      if (missing.length === 0)
        items.push({
          key: "certifications",
          status: "ok",
          label: notOnProfile.length ? "Vous avez les certifications demandées (selon vos réponses)" : "Vous avez les certifications demandées",
          detail: req.certifications.join(" · "),
        });
      else {
        items.push({
          key: "certifications",
          status: share > 0 ? "partial" : "missing",
          label: missing.length === 1 ? "Une certification demandée n'est pas sur votre fiche" : `${missing.length} certifications demandées ne sont pas sur votre fiche`,
          detail: missing.join(" · "),
        });
        advice.push("Si vous avez ces certifications, ajoutez-les à votre fiche. Sinon, répondez avec un partenaire qui les a (groupement ou sous-traitance).");
      }
    }
  } else {
    items.push({ key: "certifications", status: "unknown", label: "Certifications à vérifier", detail: "Ouvrez « En savoir plus » : la fiche de l'appel d'offres les liste" });
  }

  // 4. Autres conditions (chiffre d'affaires, assurances, références…) : comptées seulement quand le membre a répondu
  if (req && req.capacity.length > 0) {
    const lines = req.capacity.slice(0, 5);
    for (const x of lines) questions.push({ text: x, kind: "capacity", answer: answers[x] ?? null });
    const answered = lines.filter((x) => answers[x] !== undefined);
    const yes = answered.filter((x) => answers[x] === true).length;
    if (answered.length) {
      const part = WEIGHTS.capacity * (answered.length / lines.length);
      max += Math.round(part);
      earned += Math.round(part * (yes / answered.length));
    }
    const no = answered.length - yes;
    if (answered.length === 0) items.push({ key: "capacity", status: "unknown", label: "Autres conditions à vérifier", detail: lines.slice(0, 3).join(" · ") });
    else if (no === 0 && answered.length === lines.length) items.push({ key: "capacity", status: "ok", label: "Vous remplissez les autres conditions (selon vos réponses)" });
    else if (no > 0) {
      items.push({ key: "capacity", status: no === answered.length ? "missing" : "partial", label: `${no} condition${no > 1 ? "s" : ""} non remplie${no > 1 ? "s" : ""} selon vos réponses`, detail: answered.filter((x) => answers[x] === false).join(" · ") });
      advice.push("Une condition manque : un groupement avec une autre entreprise peut permettre de la remplir à deux.");
    } else items.push({ key: "capacity", status: "partial", label: "Conditions remplies pour l'instant (répondez aux autres)" });
  }

  const profileIncomplete = c.sectors.length === 0 || (!c.department && !c.region) || c.certifications.length === 0;
  // Note seulement si le métier et au moins un autre point sont connus (sinon elle ne voudrait rien dire)
  const tradeKnown = items.find((i) => i.key === "trade")?.status !== "unknown";
  const score = tradeKnown && max >= WEIGHTS.trade + WEIGHTS.certifications - 1 ? Math.round((earned / max) * 100) : null;
  const level = score == null ? null : score >= 80 ? "high" : score >= 60 ? "good" : score >= 35 ? "partial" : "low";
  const levelLabel =
    level === "high" ? "Très bonne correspondance" : level === "good" ? "Bonne correspondance" : level === "partial" ? "Correspondance partielle" : level === "low" ? "Faible correspondance" : "Note à compléter";
  if (score == null && profileIncomplete) advice.push("Complétez votre fiche (métier, ville, certifications) pour obtenir une note fiable.");

  return {
    score,
    level,
    levelLabel,
    items,
    advice: [...new Set(advice)].slice(0, 2),
    suggestPartner: items.some((i) => i.key !== "zone" && (i.status === "missing" || i.status === "partial")),
    profileIncomplete,
    questions,
  };
}
