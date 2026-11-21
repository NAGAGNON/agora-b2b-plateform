import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape";
import { C, button, note, paragraph, shell } from "@/lib/email/design";
import { siteUrl } from "@/lib/seo";
import { logServerError } from "@/lib/errors";
import { isWeekendPause } from "@/lib/weekend";

type Db = ReturnType<typeof createAdminClient>;

/** Une entreprise à qui la campagne a présenté l'entreprise cliente. */
export type Presented = {
  at: string;
  name: string;
  city: string | null;
  channel: "MEMBER" | "PROSPECT";
  /** E-mail : envoyé, lu, ou la fiche a été ouverte depuis l'e-mail. Espace membre : présentée. */
  state: "presented" | "sent" | "read" | "clicked";
};

export type CampaignReport = {
  presented: Presented[];
  read: number;
  clicked: number;
  messages: number;
};

/** Tout ce que la campagne a fait, depuis son démarrage (ou depuis une date), à partir des données réelles. */
export async function campaignReport(db: Db, b: { id: string; company_id: string; starts_at: string | null }, since?: string): Promise<CampaignReport> {
  const from = since ?? b.starts_at ?? new Date(0).toISOString();
  const [{ data: pres }, { data: camp }, { data: members }] = await Promise.all([
    db.from("boost_presentations").select("created_at, presented_to, prospect_id, channel").eq("boost_id", b.id).gte("created_at", from).order("created_at", { ascending: false }).limit(2000),
    db.from("outreach_campaigns").select("id").eq("kind", "BOOST").eq("boost_id", b.id).maybeSingle(),
    db.from("company_members").select("user_id").eq("company_id", b.company_id),
  ]);
  const rows = pres ?? [];
  const companyIds = [...new Set(rows.map((r) => r.presented_to).filter((x): x is string => Boolean(x)))];
  const prospectIds = [...new Set(rows.map((r) => r.prospect_id).filter((x): x is string => Boolean(x)))];
  const [{ data: cos }, { data: pros }, { data: recips }] = await Promise.all([
    companyIds.length ? db.from("companies").select("id, name, city").in("id", companyIds) : Promise.resolve({ data: [] as { id: string; name: string; city: string | null }[] }),
    prospectIds.length ? db.from("outreach_prospects").select("id, name, city").in("id", prospectIds) : Promise.resolve({ data: [] as { id: string; name: string; city: string | null }[] }),
    camp && prospectIds.length
      ? db.from("outreach_recipients").select("prospect_id, opened_at, clicked_at").eq("campaign_id", camp.id).in("prospect_id", prospectIds)
      : Promise.resolve({ data: [] as { prospect_id: string; opened_at: string | null; clicked_at: string | null }[] }),
  ]);
  const co = new Map((cos ?? []).map((c) => [c.id, c]));
  const pr = new Map((pros ?? []).map((p) => [p.id, p]));
  const rc = new Map((recips ?? []).map((r) => [r.prospect_id, r]));
  const presented: Presented[] = rows.map((r) => {
    if (r.prospect_id) {
      const p = pr.get(r.prospect_id);
      const x = rc.get(r.prospect_id);
      return { at: r.created_at, name: p?.name ?? "Entreprise", city: p?.city ?? null, channel: "PROSPECT", state: x?.clicked_at ? "clicked" : x?.opened_at ? "read" : "sent" };
    }
    const c = r.presented_to ? co.get(r.presented_to) : undefined;
    return { at: r.created_at, name: c?.name ?? "Entreprise inscrite", city: c?.city ?? null, channel: "MEMBER", state: "presented" };
  });
  const memberIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  const { count: messages } = await db
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .or(`buyer_company_id.eq.${b.company_id},supplier_company_id.eq.${b.company_id}`)
    .gte("created_at", from)
    .not("created_by", "in", `(${memberIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
  return {
    presented,
    read: presented.filter((p) => p.state === "read" || p.state === "clicked").length,
    clicked: presented.filter((p) => p.state === "clicked").length,
    messages: messages ?? 0,
  };
}

/** Phrase honnête quand rien n'est parti : on dit pourquoi, et ce que l'entreprise peut faire. */
export function nothingReason(b: { ad_status: string | null; ad_title: string | null }): string {
  if (b.ad_title && b.ad_status === "REJECTED") return "Votre annonce attend une petite correction : tant qu'elle n'est pas corrigée, nous ne pouvons pas l'envoyer.";
  if (b.ad_title && b.ad_status === "PENDING_REVIEW") return "Votre annonce est en cours de relecture : les présentations par e-mail partent dès qu'elle est validée.";
  return "Aucune entreprise correspondant à votre ciblage n'était disponible sur ces jours. Élargir le ciblage (région, métier) aide à présenter votre entreprise plus souvent.";
}

/** E-mail de bilan (tous les 2 jours) : ce qui a été fait, les retours, et le lien vers le suivi. */
export function renderVisibilityRecap(i: { company: string; days: number; report: CampaignReport; nothing: string | null; daysLeft: number | null; url: string }) {
  const base = siteUrl();
  const n = i.report.presented.length;
  const plural = (k: number, one: string, many: string) => `${k} ${k > 1 ? many : one}`;
  const subject = n
    ? `Votre campagne : ${plural(n, "entreprise a découvert", "entreprises ont découvert")} ${i.company}`
    : `Votre campagne de visibilité : le point des ${i.days} derniers jours`;
  const names = i.report.presented.slice(0, 5).map((p) => `${p.name}${p.city ? ` (${p.city})` : ""}`);
  const tiles: [string, number][] = [
    ["Entreprises présentées", n],
    ["Ont lu votre présentation", i.report.read],
    ["Vous ont écrit", i.report.messages],
  ];
  const tilesHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr>${tiles
    .map(
      ([l, v]) =>
        `<td width="33%" align="center" style="padding:14px 6px;background:${C.sky};border:4px solid #ffffff;border-radius:12px"><p style="margin:0;font-size:26px;line-height:30px;font-weight:800;color:${C.navy}">${v}</p><p style="margin:4px 0 0;font-size:12px;line-height:16px;color:${C.slate}">${escapeHtml(l)}</p></td>`,
    )
    .join("")}</tr></table>`;
  const body = [
    paragraph(
      n
        ? `Ces ${i.days} derniers jours, nous avons présenté ${i.company} à ${plural(n, "entreprise", "entreprises")} correspondant à votre ciblage.`
        : `Ces ${i.days} derniers jours, aucune présentation n'est partie. ${i.nothing ?? ""}`,
    ),
    tilesHtml,
    names.length ? `<p style="margin:0 0 6px;font-size:14px;line-height:20px;font-weight:700;color:${C.navy}">Parmi elles</p><p style="margin:0 0 18px;font-size:14px;line-height:22px;color:${C.slate}">${names.map(escapeHtml).join("<br>")}${n > names.length ? `<br>et ${n - names.length} autre${n - names.length > 1 ? "s" : ""}` : ""}</p>` : "",
    i.daysLeft !== null && i.daysLeft > 0 ? paragraph(`Votre campagne continue encore ${plural(i.daysLeft, "jour", "jours")}.`) : "",
    button("Voir le détail de ma campagne", i.url),
  ].join("");
  const html = shell({
    base,
    subject,
    preheader: n ? `${n} présentation(s), ${i.report.read} lecture(s), ${i.report.messages} message(s).` : "Le point sur votre campagne et ce qui peut l'aider.",
    kicker: "Campagne de visibilité",
    title: n ? "Le point sur votre campagne" : "Votre campagne : le point",
    body,
    notes: note(escapeHtml("Vous recevez ce bilan tous les 2 jours ouvrés pendant votre campagne de visibilité. Gérez vos e-mails dans votre espace, rubrique Paramètres.")),
  });
  const text = [
    n ? `Ces ${i.days} derniers jours, nous avons présenté ${i.company} à ${n} entreprise(s).` : `Ces ${i.days} derniers jours, aucune présentation n'est partie. ${i.nothing ?? ""}`,
    `Entreprises présentées : ${n} · Ont lu : ${i.report.read} · Vous ont écrit : ${i.report.messages}`,
    ...(names.length ? ["", "Parmi elles :", ...names] : []),
    "",
    `Voir le détail : ${i.url}`,
  ].join("\n");
  return { subject, html, text };
}

const RECAP_EVERY_MS = 46 * 3_600_000;

/**
 * Bilan tous les 2 jours (validé par le fondateur le 21/11) : pour chaque campagne en cours depuis au
 * moins 36 h, e-mail aux membres de l'entreprise qui acceptent les e-mails. Jamais le week-end.
 */
export async function sendVisibilityRecaps(db: Db = createAdminClient(), now = new Date()) {
  if (isWeekendPause(now)) return { sent: 0, skipped: "week-end" };
  const { data: boosts } = await db
    .from("visibility_boosts")
    .select("id, company_id, starts_at, ends_at, ad_status, ad_title")
    .eq("status", "ACTIVE")
    .lte("starts_at", new Date(now.getTime() - 36 * 3_600_000).toISOString())
    .limit(100);
  let sent = 0;
  for (const b of boosts ?? []) {
    try {
      const { data: last } = await db.from("audit_logs").select("created_at").eq("action", "visibility.recap_sent").eq("entity_id", b.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last && now.getTime() - new Date(last.created_at).getTime() < RECAP_EVERY_MS) continue;
      const since = last?.created_at ?? b.starts_at!;
      const days = Math.max(1, Math.round((now.getTime() - new Date(since).getTime()) / 86_400_000));
      const [{ data: co }, { data: members }, report] = await Promise.all([
        db.from("companies").select("name").eq("id", b.company_id).single(),
        db.from("company_members").select("user_id, users!inner(email, notify_email, notify_prefs, status, is_internal)").eq("company_id", b.company_id),
        campaignReport(db, b, since),
      ]);
      const to = (members ?? [])
        .map((m) => (Array.isArray(m.users) ? m.users[0] : m.users) as { email: string; notify_email: boolean; notify_prefs: Record<string, unknown> | null; status: string; is_internal: boolean } | null)
        .filter((u): u is NonNullable<typeof u> => Boolean(u && u.email && u.notify_email && u.status === "ACTIVE" && (u.notify_prefs ?? {})["visibilite"] !== false));
      // Enregistré avant l'envoi : jamais deux bilans pour la même campagne en moins de 2 jours
      await db.from("audit_logs").insert({ action: "visibility.recap_sent", entity_type: "visibility_boost", entity_id: b.id, metadata: { recipients: to.length, presented: report.presented.length, read: report.read, messages: report.messages } });
      if (!to.length) continue;
      const daysLeft = b.ends_at ? Math.max(0, Math.ceil((new Date(b.ends_at).getTime() - now.getTime()) / 86_400_000)) : null;
      const msg = renderVisibilityRecap({
        company: co?.name ?? "votre entreprise",
        days,
        report,
        nothing: report.presented.length ? null : nothingReason(b),
        daysLeft,
        url: `${siteUrl()}/dashboard/visibilite/${b.id}`,
      });
      for (const u of to) {
        const r = await sendEmail({ to: u.email, ...msg, bulk: true, idempotencyKey: `visibility-recap-${b.id}-${now.toISOString().slice(0, 10)}-${u.email}` });
        if (r.status === "SENT") sent++;
        else logServerError("visibility recap", new Error(r.error ?? "échec d'envoi"));
      }
    } catch (e) {
      logServerError("visibility recap", e);
    }
  }
  return { sent };
}
