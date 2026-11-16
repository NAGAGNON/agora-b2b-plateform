import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { windowNumbers } from "@/lib/weekly-review";
import { reportRecipients } from "@/lib/daily-report-email";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { siteUrl } from "@/lib/seo";
import type { Json } from "@/lib/database.types";
import { evaluateLaunch, LAUNCH_THRESHOLDS, type Criterion } from "@/lib/launch-readiness-core";

const DAY = 86_400_000;
const KEY = "private.launch_readiness";

/** Où en sont les seuils du lancement payant (semaines glissantes de 7 jours, comptes de l'équipe exclus). */
export async function launchReadiness(now = new Date()) {
  const db = createAdminClient();
  const { data: team } = await db.from("users").select("id").or("is_internal.eq.true,is_demo.eq.true");
  const excluded = new Set((team ?? []).map((u) => u.id));
  const weeks = await Promise.all(
    Array.from({ length: LAUNCH_THRESHOLDS.semaines }, (_, i) => windowNumbers(db, new Date(now.getTime() - (i + 1) * 7 * DAY), new Date(now.getTime() - i * 7 * DAY), excluded)),
  );
  const { count } = await db.from("companies").select("id", { count: "exact", head: true }).eq("is_demo", false).eq("status", "ACTIVE");
  return evaluateLaunch(
    weeks.map((w) => ({ inscrits: w.inscrits, revenus: w.revenus })),
    count ?? 0,
  );
}

function render(criteres: Criterion[]) {
  const rows = criteres
    .map((c) => `<tr><td style="padding:8px;border-top:1px solid #E2E8F0;font-size:14px;color:#334155">✅ ${escapeHtml(c.libelle)}</td><td style="padding:8px;border-top:1px solid #E2E8F0;font-size:14px;font-weight:700;color:#0F2D4A;text-align:right">${escapeHtml(c.actuel)}</td><td style="padding:8px;border-top:1px solid #E2E8F0;font-size:13px;color:#64748B;text-align:right">${escapeHtml(c.seuil)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#ffffff">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0D9488">Lancement payant</p>
<h1 style="margin:0 0 10px;font-size:21px;color:#0F2D4A">Les seuils que vous avez fixés sont atteints</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:21px;color:#334155">Tous les seuils sont atteints. Rien n'a été lancé : la décision de passer au payant vous appartient (informations de l'entreprise, CGV, passage de Stripe en mode réel).</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>
<p style="margin:20px 0 0"><a href="${siteUrl()}/admin/comite" style="display:inline-block;background:#0F2D4A;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px">Ouvrir le comité</a></p>
</div>`;
  const text = ["Lancement payant : les seuils que vous avez fixés sont atteints.", "Rien n'a été lancé : la décision vous appartient.", "", ...criteres.map((c) => `- ${c.libelle} : ${c.actuel} (seuil : ${c.seuil})`), "", `${siteUrl()}/admin/comite`].join("\n");
  return { html, text };
}

/**
 * Vérifie les seuils et prévient le fondateur par e-mail la première fois qu'ils sont tous atteints
 * (une seule alerte ; elle peut repartir si les seuils retombent puis sont de nouveau atteints).
 */
export async function checkLaunchReadiness(now = new Date()) {
  const db = createAdminClient();
  const r = await launchReadiness(now);
  const { data: state } = await db.from("platform_settings").select("value").eq("key", KEY).maybeSingle();
  const prev = (state?.value ?? {}) as { notified_at?: string | null };
  if (!r.pret) {
    // Seuils retombés : une nouvelle alerte pourra partir lorsqu'ils seront de nouveau tous atteints
    if (prev.notified_at) await db.from("platform_settings").upsert({ key: KEY, value: { notified_at: null } as unknown as NonNullable<Json>, description: "Alerte des seuils du lancement payant" });
    return { pret: false, atteints: r.atteints };
  }
  if (prev.notified_at) return { pret: true, skipped: "Alerte déjà envoyée" };
  await db.from("platform_settings").upsert({ key: KEY, value: { notified_at: now.toISOString() } as unknown as NonNullable<Json>, description: "Alerte des seuils du lancement payant" });
  const to = await reportRecipients();
  const msg = render(r.criteres);
  let sent = 0;
  for (const address of to) {
    const res = await sendEmail({ to: address, subject: "Lancement payant : vos seuils sont atteints", html: msg.html, text: msg.text, idempotencyKey: `launch-ready-${now.toISOString().slice(0, 10)}-${address}` });
    if (res.status === "SENT") sent++;
  }
  return { pret: true, sent };
}
