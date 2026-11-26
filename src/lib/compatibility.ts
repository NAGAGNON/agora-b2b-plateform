import { matchedSkill } from "@/lib/skill-catalog";

/**
 * Note de correspondance entre une entreprise et un appel d'offres.
 *
 * Ce que la note EST : un indicateur de proximité entre ce que l'entreprise a déclaré (sa fiche, ses
 * réponses) et ce que demande l'avis (d'après son résumé). Ce qu'elle N'EST PAS : une probabilité de
 * gagner, ni une garantie d'éligibilité. Le règlement de la consultation fait toujours foi.
 *
 * Méthode (documentée aussi dans docs/note-compatibilite.md et affichée sur la carte) :
 * 1. Critères pondérés, comptés seulement quand l'information existe des deux côtés :
 *    métier 45 · zone 30 · certifications exigées 25 · autres conditions 15 (seulement si le membre a répondu).
 *    Note = points obtenus / points des critères connus × 100. Ce qu'on ne sait pas n'enlève rien.
 * 2. Conditions OBLIGATOIRES = certifications et conditions de participation écrites dans l'avis.
 *    - Une obligatoire non remplie (absente de la fiche et non confirmée, ou « Je ne l'ai pas ») :
 *      note plafonnée à 45 et niveau « Condition obligatoire manquante ».
 *    - Une obligatoire non vérifiée (inconnue ou sans réponse) : note plafonnée à 70 et niveau « sous réserve ».
 *    Ainsi une note élevée ne masque jamais une condition éliminatoire.
 * 3. Chaque point indique sa source : avis, fiche (déclaré), réponse (déclaré) ou calcul. Rien n'est vérifié
 *    par LinkProB2B auprès d'un organisme : tout ce qui vient de l'entreprise est « déclaré ».
 * 4. Pas de note si le métier n'est pas connu ou si trop peu de critères le sont.
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
/** D'où vient l'information : avis officiel (résumé), fiche de l'entreprise, réponse du membre, ou calcul. */
export type CompatBasis = "notice" | "profile" | "answer" | "computed";
export type CompatItem = {
  key: string;
  status: CompatStatus;
  label: string;
  detail?: string;
  basis: CompatBasis[];
  /** Condition de participation exigée par l'avis (éliminatoire si elle n'est pas remplie) */
  mandatory?: boolean;
};

/** Question posée au membre : une certification absente de sa fiche, ou une autre condition de l'avis. */
export type CompatQuestion = { text: string; kind: "cert" | "capacity"; answer: boolean | null };
/** Réponses du membre, par texte de l'exigence (true = « Je l'ai », false = « Je ne l'ai pas »). */
export type CompatAnswers = Record<string, boolean>;

export type CompatLevel = "high" | "good" | "partial" | "low" | "blocked" | null;

export type Compatibility = {
  /** null quand trop peu d'éléments sont connus pour donner une note honnête */
  score: number | null;
  /** Note avant plafond (pour expliquer le plafond) */
  rawScore: number | null;
  level: CompatLevel;
  levelLabel: string;
  items: CompatItem[];
  advice: string[];
  /** Conditions obligatoires non remplies (selon la fiche ou les réponses) */
  blockers: string[];
  /** Conditions obligatoires pas encore vérifiées */
  toCheck: string[];
  /** Plafond appliqué à cause d'une condition obligatoire (45 ou 70), sinon null */
  cap: number | null;
  suggestPartner: boolean;
  profileIncomplete: boolean;
  questions: CompatQuestion[];
  /** La liste des conditions vient d'un résumé de l'avis : le règlement de la consultation fait foi */
  fromSummary: boolean;
};

export const COMPAT_WEIGHTS = { trade: 45, zone: 30, certifications: 25, capacity: 15 } as const;
export const COMPAT_CAP_BLOCKED = 45;
export const COMPAT_CAP_UNVERIFIED = 70;
const WEIGHTS = COMPAT_WEIGHTS;

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
  const blockers: string[] = [];
  const toCheck: string[] = [];
  let earned = 0;
  let max = 0;

  // 1. Métier (fiche déclarée × métier de l'offre)
  const skill = matchedSkill(c.skills, `${o.title} ${o.summary ?? ""}`);
  if (o.sector_slug && c.sectors.includes(o.sector_slug)) {
    earned += WEIGHTS.trade;
    max += WEIGHTS.trade;
    items.push({ key: "trade", status: "ok", label: "Votre métier correspond", detail: tradeName ?? undefined, basis: ["profile"] });
  } else if (skill) {
    earned += Math.round(WEIGHTS.trade * 0.75);
    max += WEIGHTS.trade;
    items.push({ key: "trade", status: "partial", label: "Un de vos savoir-faire est cité dans l'offre", detail: `« ${skill} »`, basis: ["profile"] });
  } else if (o.sector_slug && c.sectors.length > 0) {
    max += WEIGHTS.trade;
    items.push({ key: "trade", status: "missing", label: "Ce n'est pas le métier indiqué sur votre fiche", detail: tradeName ?? undefined, basis: ["profile"] });
    advice.push("Si vous faites ce travail, ajoutez ce métier à votre fiche ; sinon, proposez-vous en sous-traitance à une entreprise du métier.");
  } else {
    items.push({ key: "trade", status: "unknown", label: "Métier à vérifier", detail: c.sectors.length === 0 ? "Votre fiche n'indique pas votre métier" : "L'offre ne précise pas de métier", basis: ["profile"] });
  }

  // 2. Zone (fiche déclarée × lieu de l'offre ; distance calculée)
  const km = o.lat != null && o.lng != null && c.lat != null && c.lng != null ? Math.round(distanceKm({ lat: o.lat, lng: o.lng }, { lat: c.lat, lng: c.lng })) : null;
  const kmText = km == null ? undefined : km < 3 ? "tout près de chez vous" : `à environ ${km} km`;
  const zoneBasis: CompatBasis[] = km != null ? ["profile", "computed"] : ["profile"];
  if (o.department_code && c.department && o.department_code === c.department) {
    earned += WEIGHTS.zone;
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "ok", label: "Dans votre département", detail: kmText, basis: zoneBasis });
  } else if (km != null && c.radiusKm && km <= c.radiusKm) {
    earned += WEIGHTS.zone;
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "ok", label: "Dans votre zone d'intervention", detail: `${kmText} (vous intervenez jusqu'à ${c.radiusKm} km)`, basis: zoneBasis });
  } else if (c.zone && NATIONAL.test(c.zone)) {
    earned += WEIGHTS.zone;
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "ok", label: "Vous intervenez dans toute la France", basis: ["profile"] });
  } else if (o.region && c.region && o.region === c.region) {
    earned += Math.round(WEIGHTS.zone * 0.7);
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "partial", label: "Dans votre région", detail: kmText ?? o.region, basis: zoneBasis });
  } else if ((o.department_code || o.region) && (c.department || c.region)) {
    max += WEIGHTS.zone;
    items.push({ key: "zone", status: "missing", label: "Hors de votre zone habituelle", detail: kmText ?? o.region ?? undefined, basis: zoneBasis });
    advice.push("Le lieu est loin de chez vous : comptez les déplacements dans votre prix, ou répondez avec un partenaire proche du lieu.");
  } else {
    items.push({ key: "zone", status: "unknown", label: "Lieu à vérifier", detail: o.department_code || o.region ? "Votre fiche n'indique pas votre ville" : "L'offre ne précise pas le lieu", basis: ["profile"] });
  }

  // 3. Certifications exigées par l'avis : conditions OBLIGATOIRES, une ligne chacune
  if (req) {
    if (req.certifications.length === 0) {
      earned += WEIGHTS.certifications;
      max += WEIGHTS.certifications;
      items.push({ key: "certifications", status: "ok", label: "Aucune certification exigée dans le résumé de l'avis", detail: "À confirmer dans le règlement de la consultation", basis: ["notice"] });
    } else {
      let okCount = 0;
      for (const x of req.certifications) {
        const onProfile = certificationMatch(x, c.certifications);
        const a = answers[x];
        if (!onProfile) questions.push({ text: x, kind: "cert", answer: a ?? null });
        if (onProfile || a === true) {
          okCount++;
          items.push({ key: `cert:${x}`, status: "ok", label: x, detail: onProfile ? "Sur votre fiche (déclarée, non vérifiée par LinkProB2B)" : "Selon votre réponse (déclarée)", basis: ["notice", onProfile ? "profile" : "answer"], mandatory: true });
        } else if (a === false) {
          blockers.push(x);
          items.push({ key: `cert:${x}`, status: "missing", label: x, detail: "Vous ne l'avez pas, selon votre réponse", basis: ["notice", "answer"], mandatory: true });
        } else {
          toCheck.push(x);
          items.push({ key: `cert:${x}`, status: "unknown", label: x, detail: "Absente de votre fiche : à vérifier (répondez ci-dessous)", basis: ["notice"], mandatory: true });
        }
      }
      earned += Math.round(WEIGHTS.certifications * (okCount / req.certifications.length));
      max += WEIGHTS.certifications;
      if (blockers.length || toCheck.length) advice.push("Si vous avez ces certifications, ajoutez-les à votre fiche. Sinon, répondez avec un partenaire qui les a (groupement ou sous-traitance).");
    }
  } else {
    items.push({ key: "certifications", status: "unknown", label: "Certifications exigées à vérifier", detail: "Ouvrez « En savoir plus » : la fiche de l'appel d'offres les liste", basis: ["notice"], mandatory: true });
  }

  // 4. Autres conditions de participation : OBLIGATOIRES, comptées seulement quand le membre a répondu
  if (req && req.capacity.length > 0) {
    const lines = req.capacity.slice(0, 5);
    let answered = 0;
    let yes = 0;
    for (const x of lines) {
      const a = answers[x];
      questions.push({ text: x, kind: "capacity", answer: a ?? null });
      if (a === true) {
        answered++;
        yes++;
        items.push({ key: `cap:${x}`, status: "ok", label: x, detail: "Selon votre réponse (déclarée)", basis: ["notice", "answer"], mandatory: true });
      } else if (a === false) {
        answered++;
        blockers.push(x);
        items.push({ key: `cap:${x}`, status: "missing", label: x, detail: "Non remplie, selon votre réponse", basis: ["notice", "answer"], mandatory: true });
      } else {
        toCheck.push(x);
        items.push({ key: `cap:${x}`, status: "unknown", label: x, detail: "À vérifier (répondez ci-dessous)", basis: ["notice"], mandatory: true });
      }
    }
    if (answered) {
      const part = WEIGHTS.capacity * (answered / lines.length);
      max += Math.round(part);
      earned += Math.round(part * (yes / answered));
    }
    if (answered > yes) advice.push("Une condition manque : un groupement avec une autre entreprise peut permettre de la remplir à deux.");
  }

  const profileIncomplete = c.sectors.length === 0 || (!c.department && !c.region) || c.certifications.length === 0;
  const tradeKnown = items.find((i) => i.key === "trade")?.status !== "unknown";
  const rawScore = tradeKnown && max >= WEIGHTS.trade + WEIGHTS.certifications - 1 ? Math.round((earned / max) * 100) : null;

  // Plafond : une note élevée ne doit jamais masquer une condition obligatoire non remplie ou non vérifiée
  const cap = blockers.length ? COMPAT_CAP_BLOCKED : toCheck.length || !req ? COMPAT_CAP_UNVERIFIED : null;
  const score = rawScore == null ? null : cap != null ? Math.min(rawScore, cap) : rawScore;
  const base: CompatLevel = score == null ? null : score >= 80 ? "high" : score >= 60 ? "good" : score >= 35 ? "partial" : "low";
  const level: CompatLevel = score != null && blockers.length ? "blocked" : base;
  const levelLabel =
    level === "blocked"
      ? "Condition obligatoire manquante"
      : level === "high"
        ? "Très bonne correspondance"
        : level === "good"
          ? toCheck.length || !req
            ? "Bonne correspondance, sous réserve"
            : "Bonne correspondance"
          : level === "partial"
            ? toCheck.length || !req
              ? "Correspondance partielle, sous réserve"
              : "Correspondance partielle"
            : level === "low"
              ? "Faible correspondance"
              : "Note à compléter";
  if (score == null && profileIncomplete) advice.push("Complétez votre fiche (métier, ville, certifications) pour obtenir une note fiable.");

  return {
    score,
    rawScore,
    level,
    levelLabel,
    items,
    advice: [...new Set(advice)].slice(0, 2),
    blockers,
    toCheck,
    cap: rawScore != null && cap != null && rawScore > cap ? cap : null,
    suggestPartner: blockers.length > 0 || toCheck.some((x) => req?.certifications.includes(x)) || items.some((i) => i.key === "trade" && i.status === "missing"),
    profileIncomplete,
    questions,
    fromSummary: Boolean(req),
  };
}
