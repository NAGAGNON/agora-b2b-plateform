import { z } from "zod";
import { splitList } from "@/lib/format";

/** Champ texte optionnel : chaîne vide → undefined. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
    z.string().max(max, `${max} caractères maximum`).optional(),
  );

const requiredText = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: `${label} est obligatoire` })
      .min(min, min <= 1 ? `${label} est obligatoire` : `${label} : ${min} caractères minimum`)
      .max(max, `${label} : ${max} caractères maximum`),
  );

const optionalNumber = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : v;
}, z.number({ error: "Nombre invalide" }).min(0, "Doit être positif").max(1_000_000_000, "Montant trop élevé").optional());

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number({ error: "Nombre invalide" }).int("Nombre entier attendu").min(min).max(max).optional());

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").optional(),
);

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const listField = (max = 30) => z.preprocess((v) => (Array.isArray(v) ? v : splitList(String(v ?? ""), max)), z.array(z.string()).max(max));

const optionalUrl = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return undefined;
    const t = v.trim();
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  },
  z.url({ protocol: /^https?$/, error: "Adresse web invalide" }).max(300).optional(),
);

export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128, "128 caractères maximum")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email({ error: "Adresse e-mail invalide" }).max(254),
);

export const signUpSchema = z.object({
  fullName: requiredText(2, 120, "Le nom"),
  email: emailSchema,
  password: passwordSchema,
  terms: z.preprocess((v) => v === "on", z.literal(true, { error: "Vous devez accepter les conditions d'utilisation" })),
  marketing: checkbox,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe obligatoire").max(128),
});

export const resetRequestSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] });

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Secteur : format validé ici, existence garantie par la clé étrangère en base. */
const sectorField = z.string({ error: "Secteur obligatoire" }).regex(SLUG_RE, "Secteur invalide").max(60);
const optionalSector = z.preprocess((v) => (v === "" ? undefined : v), sectorField.optional());
const sectorList = z.preprocess(
  (v) => (Array.isArray(v) ? v : v ? [v] : []),
  z.array(sectorField).max(20),
);

const companyKind = z.enum(["SUPPLIER", "BUYER", "BOTH"], { error: "Type d'entreprise invalide" });
const companySize = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.enum(["INDEPENDANT", "TPE", "PME", "ETI", "GE"]).optional(),
);

const postalCode = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
  z.string().regex(/^(\d{5}|2[AB]\d{3})$/, "Code postal invalide").optional(),
);

const departmentCode = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().regex(/^(\d{2,3}|2[AB])$/, "Département invalide").optional(),
);

export const companySchema = z.object({
  name: requiredText(2, 160, "Le nom de l'entreprise"),
  kind: companyKind,
  size: companySize,
  city: optionalText(120),
  postalCode,
  siren: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "") || undefined : v),
    z.string().regex(/^\d{9}$/, "Le SIREN comporte 9 chiffres").optional(),
  ),
  website: optionalUrl,
  tagline: optionalText(160),
  description: optionalText(4000),
  sectors: sectorList,
  skills: listField(30),
});

export const companyProfileSchema = z.object({
  name: requiredText(2, 160, "Le nom de l'entreprise"),
  kind: companyKind,
  size: companySize,
  city: optionalText(120),
  postalCode,
  departmentCode,
  siren: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "") || undefined : v),
    z.string().regex(/^\d{9}$/, "Le SIREN comporte 9 chiffres").optional(),
  ),
  website: optionalUrl,
  tagline: optionalText(160),
  description: optionalText(4000),
  sectors: sectorList,
  skills: listField(30),
  interventionZone: optionalText(300),
  interventionRadiusKm: optionalInt(0, 2000),
  certifications: listField(20),
  referencesText: optionalText(3000),
  employeesRange: optionalText(40),
  foundedYear: optionalInt(1800, 2100),
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.email({ error: "Adresse e-mail invalide" }).optional(),
  ),
  contactPhone: optionalText(30),
  isPublic: checkbox,
});

export const userProfileSchema = z.object({
  fullName: requiredText(2, 120, "Le nom"),
  jobTitle: optionalText(120),
  phone: optionalText(30),
  notifyEmail: checkbox,
  marketingConsent: checkbox,
});

const internalType = z.enum(["NEED", "QUOTE_REQUEST", "PRIVATE_CONSULTATION", "PRIVATE_TENDER"], {
  error: "Type d'opportunité invalide",
});

export const opportunitySchema = z
  .object({
    type: internalType,
    title: requiredText(5, 180, "Le titre"),
    summary: optionalText(400),
    description: requiredText(20, 20000, "La description"),
    sector: sectorField,
    city: optionalText(120),
    postalCode,
    departmentCode,
    budgetMin: optionalNumber,
    budgetMax: optionalNumber,
    budgetVisible: checkbox,
    startDate: optionalDate,
    responseDeadline: optionalDate,
    skills: listField(20),
    services: optionalText(4000),
    constraints: optionalText(4000),
    criteria: optionalText(4000),
    maxSuppliers: optionalInt(1, 100),
    visibility: z.enum(["PUBLIC", "MEMBERS_ONLY"]).default("PUBLIC"),
    targetCompanySize: companySize,
    keywords: listField(15),
    contactName: optionalText(120),
    attest: checkbox,
    intent: z.enum(["draft", "submit"]).default("draft"),
  })
  .superRefine((d, ctx) => {
    if (d.budgetMin != null && d.budgetMax != null && d.budgetMin > d.budgetMax) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Le budget maximum doit être supérieur au minimum" });
    }
    if (d.responseDeadline) {
      const deadline = new Date(`${d.responseDeadline}T23:59:59`);
      if (deadline.getTime() < Date.now()) {
        ctx.addIssue({ code: "custom", path: ["responseDeadline"], message: "La date limite doit être dans le futur" });
      }
    }
    if ((d.type === "PRIVATE_CONSULTATION" || d.type === "PRIVATE_TENDER") && !d.responseDeadline && d.intent === "submit") {
      ctx.addIssue({ code: "custom", path: ["responseDeadline"], message: "Une date limite est requise pour une consultation" });
    }
    if (!d.city && !d.departmentCode) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Indiquez une ville ou un département" });
    }
    if (d.intent === "submit" && !d.attest) {
      ctx.addIssue({
        code: "custom",
        path: ["attest"],
        message: "Vous devez confirmer être autorisé à publier ces informations",
      });
    }
  });

export const interestSchema = z.object({
  opportunityId: z.uuid(),
  message: optionalText(2000),
});

export const proposalSchema = z.object({
  opportunityId: z.uuid(),
  message: requiredText(10, 5000, "Le message"),
  proposalText: optionalText(20000),
  priceAmount: optionalNumber,
  priceDetails: optionalText(2000),
  leadTime: optionalText(200),
  validUntil: optionalDate,
  additionalInfo: optionalText(4000),
});

export const alertSchema = z.object({
  name: requiredText(1, 120, "Le nom de l'alerte"),
  sector: optionalSector,
  departmentCode,
  type: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["NEED", "QUOTE_REQUEST", "PRIVATE_CONSULTATION", "PRIVATE_TENDER", "EXTERNAL_OPPORTUNITY", "PUBLIC_TENDER"]).optional(),
  ),
  keywords: optionalText(200),
  frequency: z.enum(["IMMEDIATE", "DAILY", "WEEKLY"]),
});

export const messageSchema = z.object({
  conversationId: z.uuid(),
  body: requiredText(1, 5000, "Le message"),
});

export const reportSchema = z.object({
  targetType: z.enum(["OPPORTUNITY", "COMPANY", "MESSAGE", "USER", "PROPOSAL"]),
  targetId: z.uuid(),
  reason: z.enum(["SPAM", "FRAUD", "INAPPROPRIATE", "FALSE_INFO", "COPYRIGHT", "OTHER"], { error: "Motif invalide" }),
  details: optionalText(2000),
});

export const contactSchema = z.object({
  name: requiredText(2, 120, "Le nom"),
  email: emailSchema,
  company: optionalText(160),
  subject: requiredText(2, 200, "L'objet"),
  message: requiredText(10, 5000, "Le message"),
  website: z.string().max(0).optional(), // champ piège anti-robot
});

export const moderationSchema = z
  .object({
    opportunityId: z.uuid(),
    action: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES", "SUSPEND", "ARCHIVE", "REINSTATE"]),
    reason: optionalText(2000),
  })
  .superRefine((d, ctx) => {
    if (["REJECT", "REQUEST_CHANGES", "SUSPEND"].includes(d.action) && !d.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Un motif est obligatoire pour cette action" });
    }
  });

export const sourceSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  name: requiredText(2, 120, "Le nom"),
  baseUrl: optionalUrl,
  description: optionalText(1000),
  license: optionalText(500),
  termsUrl: optionalUrl,
  status: z.enum(["DRAFT", "LEGAL_REVIEW", "APPROVED", "SUSPENDED", "REJECTED"]),
  importMethod: z.enum(["MANUAL", "API", "FEED", "PARTNER"]),
  notes: optionalText(4000),
  legalConfirmed: checkbox,
});

export const externalOpportunitySchema = z.object({
  sourceId: z.uuid({ error: "Source obligatoire" }),
  type: z.enum(["EXTERNAL_OPPORTUNITY", "PUBLIC_TENDER"]),
  title: requiredText(5, 180, "Le titre"),
  summary: optionalText(400),
  description: requiredText(20, 5000, "Le résumé rédigé"),
  externalBuyerName: optionalText(200),
  sector: sectorField,
  city: optionalText(120),
  departmentCode,
  responseDeadline: optionalDate,
  originalUrl: z.url({ protocol: /^https?$/, error: "URL de la source originale invalide" }),
  externalId: optionalText(120),
  sourcePublishedAt: optionalDate,
});

export type FieldErrors = Record<string, string>;

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Convertit un FormData en objet ; les clés répétées deviennent des tableaux. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) continue;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function parseForm<S extends z.ZodType>(
  schema: S,
  fd: FormData,
): { success: true; data: z.output<S> } | { success: false; result: { ok: false; error: string; fieldErrors: FieldErrors } } {
  const parsed = schema.safeParse(formDataToObject(fd));
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    result: { ok: false, error: "Certains champs sont invalides.", fieldErrors: zodFieldErrors(parsed.error) },
  };
}
