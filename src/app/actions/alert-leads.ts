"use server";

import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/errors";
import { emailSchema, type ActionResult } from "@/lib/validation";
import { subscribeLead, unsubscribeLead } from "@/lib/alert-leads";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { track } from "@/lib/analytics";

const schema = z.object({
  email: emailSchema,
  sector: z.string().regex(/^[a-z0-9-]{1,60}$/).nullable(),
  department: z.string().regex(/^[0-9AB]{2,3}$/).nullable(),
  region: z.string().max(80).nullable(),
  opportunityId: z.uuid().nullable(),
  path: z.string().max(300).nullable(),
  label: z.string().max(200),
  consent: z.literal("on", { error: "Cochez la case pour recevoir les marchés par e-mail." }),
});

const opt = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** « Recevoir les marchés similaires » : adresse e-mail seule, confirmation par lien (double opt-in). */
export async function subscribeAlertLead(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  // Champ piège (robots) : réponse identique à un succès, rien n'est enregistré
  if (opt(fd.get("website"))) return { ok: true, message: "Vérifiez votre boîte e-mail pour confirmer l'alerte." };
  const parsed = schema.safeParse({
    email: fd.get("email"),
    sector: opt(fd.get("sector")),
    department: opt(fd.get("department")),
    region: opt(fd.get("region")),
    opportunityId: opt(fd.get("opportunityId")),
    path: opt(fd.get("path")),
    label: opt(fd.get("label")) ?? "",
    consent: fd.get("consent"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Adresse e-mail invalide." };
  if (!(await rateLimit("alert-lead", 5, 3600))) return { ok: false, error: "Trop de demandes. Réessayez dans une heure." };
  const d = parsed.data;
  try {
    const r = await subscribeLead({
      email: d.email,
      criteria: { sector: d.sector, department: d.department, region: d.region },
      opportunityId: d.opportunityId,
      path: d.path,
      criteriaLabel: d.label || "vos critères",
    });
    await track("create_alert", { kind: "email_only", state: r.state, path: d.path, sector: d.sector, department: d.department });
    if (r.state === "already") return { ok: true, message: "Cette alerte est déjà active pour votre adresse : vous recevez déjà ces marchés." };
    flushEmailsAfterResponse();
    return { ok: true, message: "C'est presque fini : cliquez sur le lien que nous venons de vous envoyer par e-mail pour activer l'alerte." };
  } catch (e) {
    logServerError("alert lead", e);
    return { ok: false, error: "L'alerte n'a pas pu être enregistrée. Réessayez dans quelques instants." };
  }
}

export async function unsubscribeAlertLead(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const token = z.uuid().safeParse(fd.get("token"));
  if (!token.success) return { ok: false, error: "Lien invalide." };
  if (!(await rateLimit("unsubscribe", 30, 3600))) return { ok: false, error: "Trop de requêtes." };
  const lead = await unsubscribeLead(token.data);
  if (!lead) return { ok: false, error: "Ce lien de désinscription n'est plus valide." };
  return { ok: true, message: "C'est fait : vous ne recevrez plus ces e-mails." };
}
