"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError } from "@/lib/errors";
import type { ActionResult } from "@/lib/validation";
import { loadVeilleSettings, previewFor, refreshCampaign } from "@/lib/veille/engine";
import { sendVeilleEmail } from "@/lib/veille/send";
import type { VeilleKind } from "@/lib/veille/render";

async function saveSettings(patch: Record<string, unknown>) {
  const db = createAdminClient();
  const current = await loadVeilleSettings(db);
  const supabase = await createClient();
  // Fonction d'administration : vérifie les droits (et la double authentification) et trace la modification
  const { error } = await supabase.rpc("admin_update_setting", { p_key: "veille", p_value: { ...current, ...patch } as never });
  if (error) throw error;
}

/** Envoi test : rendu réel (annonces réelles du moment) vers une adresse de contrôle. */
export async function sendVeilleTest(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const to = z.email().safeParse(String(fd.get("to") ?? "").trim());
  if (!to.success) return { ok: false, error: "Adresse de contrôle invalide." };
  const kind = (["LAUNCH", "MONDAY", "FRIDAY", "DAILY"].includes(String(fd.get("kind"))) ? fd.get("kind") : "LAUNCH") as VeilleKind;
  if (!env.emailTransport) return { ok: false, error: "Aucun service d'envoi configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) : aucun e-mail ne peut partir." };
  const db = createAdminClient();
  const p = await previewFor(db, kind, String(fd.get("user") ?? "") || session.userId);
  if (!p.items.length) return { ok: false, error: "Aucune opportunité pertinente disponible pour cet aperçu : rien à envoyer." };
  const r = await sendVeilleEmail({ to: to.data, subject: `[Test] ${p.email.subject}`, html: p.email.html, text: p.email.text, token: "apercu" });
  if (r.status !== "SENT") return { ok: false, error: `Envoi test non abouti : ${r.error ?? r.status}` };
  try {
    await saveSettings({ test_sent_at: new Date().toISOString(), test_sent_to: to.data });
  } catch (e) {
    logServerError("veille test", e);
  }
  revalidatePath("/admin/veille");
  return { ok: true, message: `E-mail test envoyé à ${to.data} (${p.items.length} opportunité(s)). Vérifiez sa réception, son affichage et le dossier « indésirables ».` };
}

export async function setVeilleEnabled(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const enable = fd.get("enabled") === "1";
  const settings = await loadVeilleSettings(createAdminClient());
  if (enable && !env.emailTransport) return { ok: false, error: "Impossible d'activer : aucun service d'envoi configuré." };
  if (enable && !settings.test_sent_at) return { ok: false, error: "Faites d'abord un envoi test et vérifiez sa réception." };
  try {
    await saveSettings({ enabled: enable });
  } catch (e) {
    logServerError("veille enable", e);
    return { ok: false, error: "Modification refusée (droits ou double authentification)." };
  }
  revalidatePath("/admin/veille");
  return { ok: true, message: enable ? "Envois automatiques activés." : "Envois automatiques suspendus." };
}

export async function setVeilleCampaignStatus(fd: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(fd.get("id"));
  const to = String(fd.get("status"));
  if (!id.success || !["SENDING", "PAUSED", "CANCELLED"].includes(to)) return;
  const db = createAdminClient();
  const from = to === "SENDING" ? ["PAUSED"] : ["SENDING", "PAUSED"];
  await db.from("veille_campaigns").update({ status: to, updated_at: new Date().toISOString() }).eq("id", id.data).in("status", from);
  if (to === "CANCELLED") await db.from("veille_sends").update({ status: "SKIPPED", error: "Édition annulée" }).eq("campaign_id", id.data).eq("status", "PENDING");
  await refreshCampaign(db, id.data);
  revalidatePath("/admin/veille");
}

export async function testVeilleSmtp(_prev: ActionResult | null): Promise<ActionResult> {
  await requireAdmin();
  if (env.emailTransport !== "smtp") return { ok: false, error: env.emailTransport ? `Transport actif : ${env.emailTransport} (pas de SMTP).` : "SMTP non configuré." };
  const { verifySmtp } = await import("@/lib/email/smtp");
  const r = await verifySmtp();
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
}
