"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBuyerProfiles, type BuyerProfile } from "@/lib/buyer-profiles";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { logServerError } from "@/lib/errors";

import { RELAUNCH_GAP_DAYS } from "@/lib/reengagement";

const DAY = 86_400_000;

const nf = (n: number) => n.toLocaleString("fr-FR");

/** E-mail de relance personnel, à partir de ce que le membre regardait et de ce qui a été publié depuis. */
async function relaunchEmail(db: ReturnType<typeof createAdminClient>, p: BuyerProfile) {
  const first = p.name?.trim().split(/\s+/)[0] ?? null;
  const since = p.lastSeenAt ?? p.createdAt;
  let fresh = 0;
  if (p.topSectorSlug) {
    const { count } = await db
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "PUBLISHED")
      .eq("sector_slug", p.topSectorSlug)
      .eq("is_demo", false)
      .gt("created_at", since);
    fresh = count ?? 0;
  }
  const sector = p.topSector?.toLowerCase() ?? null;
  const paragraphs = [
    `Bonjour${first ? ` ${first}` : ""},`,
    fresh && sector
      ? `Depuis votre dernière visite, ${nf(fresh)} nouveaux marchés ${sector} ont été publiés sur LinkProB2B.${p.openInSector ? ` ${nf(p.openInSector)} sont ouverts en ce moment.` : ""}`
      : "De nouveaux appels d'offres et besoins d'entreprises sont publiés chaque jour sur LinkProB2B.",
    p.signals.favorites ? `Les ${nf(p.signals.favorites)} offres que vous aviez mises de côté vous attendent dans vos favoris.` : null,
    p.signals.alerts
      ? "Votre alerte continue de vous envoyer les nouveaux marchés correspondant à votre activité."
      : "Astuce : créez une alerte en 30 secondes pour recevoir les nouveaux marchés de votre métier, sans avoir à revenir chercher.",
    "Une question, un besoin particulier ? Répondez simplement à cet e-mail : je vous lis personnellement.",
  ].filter(Boolean) as string[];
  return {
    subject: fresh && sector ? `${nf(fresh)} nouveaux marchés ${sector} depuis votre dernière visite` : "Les nouveaux marchés de votre métier vous attendent",
    payload: { type: "reengagement", title: fresh && sector ? `${nf(fresh)} nouveaux marchés ${sector}` : "Les nouveaux marchés vous attendent", paragraphs, link: p.signals.favorites ? "/dashboard/favoris" : "/opportunites" },
  };
}

async function relaunch(userIds: string[], adminId: string) {
  const db = createAdminClient();
  const cutoff = new Date(Date.now() - RELAUNCH_GAP_DAYS * DAY).toISOString();
  const { data: recent } = await db.from("reengagement_sends").select("user_id").in("user_id", userIds).gte("sent_at", cutoff);
  const skip = new Set((recent ?? []).map((r) => r.user_id));
  const { data: users } = await db.from("users").select("id, email, notify_email").in("id", userIds);
  const ok = new Map((users ?? []).filter((u) => u.notify_email && u.email).map((u) => [u.id, u.email]));
  const profiles = await loadBuyerProfiles(db, userIds.filter((id) => !skip.has(id) && ok.has(id)));
  let sent = 0;
  for (const p of profiles) {
    const m = await relaunchEmail(db, p);
    const { error } = await db.from("email_outbox").insert({ user_id: p.userId, to_email: ok.get(p.userId)!, template: "reengagement", subject: m.subject, payload: m.payload });
    if (error) {
      logServerError("reengagement", error);
      continue;
    }
    await db.from("reengagement_sends").insert({ user_id: p.userId, sent_by: adminId });
    sent++;
  }
  if (sent) flushEmailsAfterResponse();
  revalidatePath("/admin/clients-potentiels");
  return sent;
}

/** Relancer un membre inactif (bouton de la page « Clients potentiels »). */
export async function relaunchUser(fd: FormData) {
  const session = await requireAdmin();
  const id = String(fd.get("userId") ?? "");
  if (/^[0-9a-f-]{36}$/.test(id)) await relaunch([id], session.userId);
}

/** Relancer tous les inactifs éligibles (pas relancés depuis 14 jours, e-mails acceptés). */
export async function relaunchAllInactive(fd: FormData) {
  const session = await requireAdmin();
  const ids = String(fd.get("userIds") ?? "")
    .split(",")
    .filter((x) => /^[0-9a-f-]{36}$/.test(x))
    .slice(0, 200);
  if (ids.length) await relaunch(ids, session.userId);
}
