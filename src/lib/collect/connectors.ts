import { classifySector, extractKeywords } from "@/lib/collect/classify";
import { asArray, cleanString, isSafeUrl, toDate, toIsoDeadline, type MapResult } from "@/lib/collect/normalize";
import { locateNuts, normalizeDepartment } from "@/lib/geo";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type SourceConfig = Record<string, unknown>;
export type ConnectorContext = { config: SourceConfig; since: Date; fetchImpl: FetchLike; now?: Date };
export type ConnectorBatch = { records: unknown[]; mapped: MapResult[] };

const USER_AGENT = "LinkProB2B/1.0 (plateforme B2B ; collecte de données ouvertes)";
const TIMEOUT_MS = 25_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Requête JSON. Limitation de débit de la source (HTTP 429) : attente du délai
 * indiqué (Retry-After, 30 s au plus) puis nouvelle tentative de la même page.
 */
async function getJson(fetchImpl: FetchLike, url: string, init: RequestInit = {}, attempt = 0): Promise<unknown> {
  const res = await fetchImpl(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * 2 ** attempt, 30_000));
    return getJson(fetchImpl, url, init, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} sur ${new URL(url).host} : ${body.slice(0, 300)}`);
  }
  return res.json();
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown, def: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

// ---------------------------------------------------------------------------
// BOAMP — API Opendatasoft de la DILA (Licence Ouverte 2.0)
// https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records
// ---------------------------------------------------------------------------
export const BOAMP_ENDPOINT = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records";

export function boampWhere(config: SourceConfig, since: Date, now = new Date()): string {
  const deps = asArray(config.departments).filter((d) => /^(\d{2,3}|2[AB])$/.test(d));
  const parts = [`dateparution >= date'${ymd(since)}'`, `datelimitereponse >= date'${ymd(now)}'`];
  if (deps.length) parts.push(`(${deps.map((d) => `code_departement="${d}"`).join(" OR ")})`);
  return parts.join(" AND ");
}

export function mapBoampRecord(r: Record<string, unknown>): MapResult {
  const id = cleanString(r.idweb, 60);
  const title = cleanString(r.objet, 300);
  if (!id) return { ok: false, reason: "idweb manquant" };
  if (!title || title.length < 5) return { ok: false, reason: `objet manquant (${id})` };
  const buyer = cleanString(r.nomacheteur, 200);
  const deps = asArray(r.code_departement).map(normalizeDepartment).filter((d): d is string => Boolean(d));
  const descriptors = asArray(r.descripteur_libelle);
  const types = asArray(r.type_marche ?? r.type_marche_facette);
  const nature = cleanString(r.nature_libelle ?? r.nature, 100) ?? "";
  const procedure = cleanString(r.procedure_libelle, 120);
  const url = cleanString(r.url_avis, 400) ?? `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(id)}`;
  if (!isSafeUrl(url)) return { ok: false, reason: `URL invalide (${id})` };
  const deadline = toIsoDeadline(r.datelimitereponse);
  const { sector } = classifySector([], `${title} ${descriptors.join(" ")}`);
  const typeLabel = types.map((t) => t.toLowerCase()).join(", ");
  const description = [
    `Avis publié au BOAMP${buyer ? ` par ${buyer}` : ""}.`,
    `Objet : ${title}.`,
    typeLabel && `Type de marché : ${typeLabel}.`,
    procedure && `Procédure : ${procedure}.`,
    descriptors.length ? `Descripteurs : ${descriptors.join(", ")}.` : null,
    "Les conditions de participation et les documents de consultation sont disponibles sur l'annonce originale.",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ok: true,
    item: {
      externalId: id,
      type: "PUBLIC_TENDER",
      title,
      summary: [buyer, typeLabel && `Marché de ${typeLabel}`].filter(Boolean).join(" — ").slice(0, 400) || null,
      description,
      buyer,
      originalUrl: url,
      publishedAt: toDate(r.dateparution),
      deadline,
      departmentCode: deps[0] ?? null,
      region: null,
      city: null,
      cpv: [],
      keywords: extractKeywords(descriptors),
      sectorSlug: sector,
      status: /annul/i.test(nature) ? "CANCELLED" : "ACTIVE",
    },
  };
}

export async function collectBoamp(ctx: ConnectorContext): Promise<ConnectorBatch> {
  const max = num(ctx.config.maxRecords, 500, 9900);
  const where = boampWhere(ctx.config, ctx.since, ctx.now);
  const records: unknown[] = [];
  for (let offset = 0; offset < max; offset += 100) {
    const url = `${BOAMP_ENDPOINT}?${new URLSearchParams({ where, order_by: "dateparution desc", limit: "100", offset: String(offset) })}`;
    const data = (await getJson(ctx.fetchImpl, url)) as { results?: unknown[]; total_count?: number };
    const page = data.results ?? [];
    records.push(...page);
    if (page.length < 100 || records.length >= (data.total_count ?? Infinity)) break;
  }
  return { records, mapped: records.map((r) => mapBoampRecord(r as Record<string, unknown>)) };
}

// ---------------------------------------------------------------------------
// TED — API de recherche v3 de l'Office des publications de l'UE (anonyme)
// POST https://api.ted.europa.eu/v3/notices/search
// ---------------------------------------------------------------------------
export const TED_ENDPOINT = "https://api.ted.europa.eu/v3/notices/search";

/** Texte d'un champ multilingue TED : français, puis anglais, puis première langue disponible. */
export function tedText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return tedText(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return tedText(o.fra ?? o.FRA ?? o.eng ?? o.ENG ?? Object.values(o)[0]);
  }
  return String(v);
}

export function tedQuery(config: SourceConfig, since: Date): string {
  const country = String(config.country ?? "FRA").replace(/[^A-Z]/g, "") || "FRA";
  const nuts = asArray(config.nuts).map((x) => x.toUpperCase()).filter((x) => /^[A-Z]{2}[A-Z0-9]{0,3}$/.test(x));
  // Filtrage géographique côté serveur (lieu d'exécution NUTS) : vérifié sur l'API réelle.
  const zone = nuts.length ? `place-of-performance IN (${nuts.join(" ")})` : `buyer-country=${country}`;
  return `${zone} AND PD>=${ymd(since).replace(/-/g, "")} SORT BY publication-date DESC`;
}

export function mapTedNotice(n: Record<string, unknown>, nutsFilter: string[]): MapResult {
  const pub = cleanString(n["publication-number"], 40);
  if (!pub) return { ok: false, reason: "numéro de publication manquant" };
  const nuts = asArray(n["place-of-performance"]).map((x) => x.toUpperCase());
  if (nutsFilter.length && !nuts.some((code) => nutsFilter.some((f) => code.startsWith(f)))) {
    return { ok: false, reason: `hors zone (${pub})` };
  }
  const rawTitle = tedText(n["notice-title"]) ?? "";
  // Titre TED généré « Pays – Libellé CPV – Titre de l'acheteur » : on garde le titre de l'acheteur.
  const segments = rawTitle.split(/\s[–-]\s/);
  const title = cleanString(segments.length >= 3 ? segments.slice(2).join(" – ") : rawTitle, 300);
  if (!title || title.length < 5) return { ok: false, reason: `titre manquant (${pub})` };
  const buyer = cleanString(tedText(n["buyer-name"]), 200);
  const cpv = [...new Set(asArray(n["classification-cpv"]).map((c) => c.replace(/\D/g, "")).filter((c) => c.length >= 2))];
  // Date limite de remise des offres ; à défaut (procédures restreintes), date limite de candidature.
  const deadline = toIsoDeadline(asArray(n["deadline-receipt-tender-date-lot"] ?? n["deadline-receipt-request-date-lot"] ?? n.deadline)[0]);
  const { departmentCode: department, region } = locateNuts(nuts);
  const nature = cleanString(asArray(n["contract-nature"])[0], 60);
  const { sector } = classifySector(cpv, title);
  const url = `https://ted.europa.eu/fr/notice/-/detail/${encodeURIComponent(pub)}`;
  return {
    ok: true,
    item: {
      externalId: pub,
      type: "PUBLIC_TENDER",
      title,
      summary: [buyer, nature && `Marché de ${nature}`].filter(Boolean).join(" — ").slice(0, 400) || null,
      description: [
        `Avis publié au Journal officiel de l'Union européenne (TED)${buyer ? ` par ${buyer}` : ""}.`,
        `Objet : ${title}.`,
        cpv.length ? `Codes CPV : ${cpv.slice(0, 5).join(", ")}.` : null,
        "Les conditions de participation et les documents de consultation sont disponibles sur l'annonce originale.",
      ]
        .filter(Boolean)
        .join("\n"),
      buyer,
      originalUrl: url,
      publishedAt: toDate(asArray(n["publication-date"])[0]),
      deadline,
      departmentCode: department,
      region,
      city: null,
      cpv,
      keywords: [],
      sectorSlug: sector,
      status: "ACTIVE",
    },
  };
}

export async function collectTed(ctx: ConnectorContext): Promise<ConnectorBatch> {
  const max = num(ctx.config.maxRecords, 300, 5000);
  const fields = asArray(ctx.config.fields).length
    ? asArray(ctx.config.fields)
    : ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "place-of-performance", "classification-cpv", "contract-nature"];
  const nuts = asArray(ctx.config.nuts).map((x) => x.toUpperCase());
  const records: unknown[] = [];
  for (let page = 1; records.length < max; page++) {
    const data = (await getJson(ctx.fetchImpl, TED_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: tedQuery(ctx.config, ctx.since), fields, limit: 100, page, scope: "ACTIVE", paginationMode: "PAGE_NUMBER" }),
    })) as { notices?: unknown[]; totalNoticeCount?: number };
    const notices = data.notices ?? [];
    records.push(...notices);
    if (notices.length < 100 || records.length >= (data.totalNoticeCount ?? Infinity)) break;
    // Respect de la limite de débit de l'API TED entre deux pages
    await sleep(num(ctx.config.pageDelayMs, 1000, 10_000));
  }
  return { records, mapped: records.map((r) => mapTedNotice(r as Record<string, unknown>, nuts)) };
}

// ---------------------------------------------------------------------------
// Opendatasoft générique — correspondance des champs définie dans la source
// (ex. APProch sur data.economie.gouv.fr)
// ---------------------------------------------------------------------------
type FieldMap = Partial<Record<"id" | "title" | "buyer" | "published" | "deadline" | "department" | "cpv" | "url" | "description" | "city", string>>;

export function mapGenericRecord(r: Record<string, unknown>, config: SourceConfig): MapResult {
  const fm = (config.fieldMap ?? {}) as FieldMap;
  const get = (k: keyof FieldMap) => (fm[k] ? r[fm[k] as string] : undefined);
  const id = cleanString(get("id"), 120);
  const title = cleanString(get("title"), 300);
  if (!id) return { ok: false, reason: "identifiant manquant (vérifier fieldMap.id)" };
  if (!title || title.length < 5) return { ok: false, reason: `titre manquant (${id})` };
  const url = cleanString(get("url"), 400) ?? (typeof config.itemUrlTemplate === "string" ? config.itemUrlTemplate.replace("{id}", encodeURIComponent(id)) : null);
  if (!isSafeUrl(url)) return { ok: false, reason: `URL originale manquante (${id})` };
  const buyer = cleanString(get("buyer"), 200);
  const cpv = asArray(get("cpv")).map((c) => c.replace(/\D/g, "")).filter((c) => c.length >= 2);
  const desc = cleanString(get("description"), 1500);
  const { sector } = classifySector(cpv, `${title} ${desc ?? ""}`);
  return {
    ok: true,
    item: {
      externalId: id,
      type: config.type === "PUBLIC_TENDER" ? "PUBLIC_TENDER" : "EXTERNAL_OPPORTUNITY",
      title,
      summary: buyer,
      description: [buyer ? `Publié par ${buyer}.` : null, `Objet : ${title}.`, desc, "Informations complètes sur la source originale."].filter(Boolean).join("\n"),
      buyer,
      originalUrl: url,
      publishedAt: toDate(get("published")),
      deadline: toIsoDeadline(get("deadline")),
      departmentCode: normalizeDepartment(asArray(get("department"))[0]),
      region: null,
      city: cleanString(get("city"), 120),
      cpv,
      keywords: [],
      sectorSlug: sector,
      status: "ACTIVE",
    },
  };
}

export async function collectGeneric(ctx: ConnectorContext): Promise<ConnectorBatch> {
  const base = String(ctx.config.baseUrl ?? "");
  const dataset = String(ctx.config.dataset ?? "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(base) || !/^[a-z0-9_-]+$/i.test(dataset)) throw new Error("Configuration invalide : baseUrl (https) et dataset requis");
  const max = num(ctx.config.maxRecords, 300, 5000);
  const params: Record<string, string> = { limit: "100" };
  if (typeof ctx.config.where === "string") params.where = ctx.config.where;
  if (typeof ctx.config.orderBy === "string") params.order_by = ctx.config.orderBy;
  const records: unknown[] = [];
  for (let offset = 0; offset < max; offset += 100) {
    const url = `${base}/api/explore/v2.1/catalog/datasets/${dataset}/records?${new URLSearchParams({ ...params, offset: String(offset) })}`;
    const data = (await getJson(ctx.fetchImpl, url)) as { results?: unknown[] };
    const page = data.results ?? [];
    records.push(...page);
    if (page.length < 100) break;
  }
  return { records, mapped: records.map((r) => mapGenericRecord(r as Record<string, unknown>, ctx.config)) };
}

export const CONNECTORS: Record<string, (ctx: ConnectorContext) => Promise<ConnectorBatch>> = {
  boamp: collectBoamp,
  ted: collectTed,
  "ods-generic": collectGeneric,
};
