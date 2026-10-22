import { escapeHtml } from "@/lib/email/templates";
import type { VeilleOpportunity, CriteriaBasis } from "@/lib/veille/select";

export type VeilleKind = "LAUNCH" | "MONDAY" | "FRIDAY" | "DAILY";

export type VeilleEmailInput = {
  kind: VeilleKind;
  base: string;
  /** Jeton de l'envoi (suivi des clics, désinscription) ; « apercu » pour un aperçu ou un test */
  token: string;
  firstName: string | null;
  items: VeilleOpportunity[];
  basis: CriteriaBasis;
  frequency: string;
  sectorLabel: (slug: string) => string;
  typeLabel: (type: string) => string;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });
export const day = (iso: string) => dateFmt.format(new Date(iso));
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function veilleSubject(kind: VeilleKind, count: number): string {
  if (kind === "LAUNCH") return "Votre veille B2B LinkProB2B — une première sélection d'opportunités ouvertes";
  if (kind === "MONDAY") return "Votre veille B2B — les nouvelles opportunités de la semaine";
  if (kind === "FRIDAY") return "Votre veille B2B — la sélection du vendredi";
  return count > 1 ? `Vos opportunités du jour — ${count} correspondent à vos critères` : "Votre opportunité du jour correspond à vos critères";
}

export const veilleLinks = (base: string, token: string) => ({
  item: (id: string) => `${base}/api/veille/c?t=${encodeURIComponent(token)}&o=${id}`,
  all: `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=opportunites`,
  daily: `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=quotidien`,
  prefs: `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=preferences`,
  unsubscribe: `${base}/veille/desabonnement?jeton=${encodeURIComponent(token)}`,
  pixel: `${base}/api/veille/o?t=${encodeURIComponent(token)}`,
});

function intro(i: VeilleEmailInput): string[] {
  const hello = i.firstName ? `Bonjour ${i.firstName},` : "Bonjour,";
  const why =
    i.basis === "preferences"
      ? "Cette sélection a été établie à partir des critères que vous avez enregistrés dans vos préférences de veille."
      : i.basis === "entreprise"
        ? "Cette sélection a été établie à partir des secteurs et de la région renseignés pour votre entreprise. Précisez vos critères pour l'affiner."
        : "Vous n'avez pas encore indiqué vos critères : voici une sélection variée d'opportunités récentes. Indiquez vos secteurs et vos régions pour recevoir une sélection adaptée.";
  if (i.kind === "LAUNCH")
    return [
      hello,
      "LinkProB2B rassemble chaque jour les marchés publics (BOAMP, TED) et les besoins publiés par des entreprises, partout en France, pour que vous trouviez plus vite les opportunités qui vous concernent.",
      "Nous lançons aujourd'hui la veille par e-mail : une sélection d'opportunités ouvertes, vérifiées avant l'envoi, avec un lien vers la fiche détaillée et la source officielle.",
      why,
    ];
  if (i.kind === "DAILY") return [hello, "Voici les nouvelles opportunités qui correspondent à vos critères depuis votre dernière alerte.", why];
  return [hello, i.kind === "MONDAY" ? "Voici une sélection des nouvelles opportunités B2B publiées cette semaine et encore ouvertes." : "Voici une sélection actualisée des dernières opportunités B2B encore ouvertes.", why];
}

function meta(o: VeilleOpportunity, i: Pick<VeilleEmailInput, "sectorLabel">): string[] {
  return [
    o.sector_slug ? i.sectorLabel(o.sector_slug) : null,
    [o.city, o.department_code ? `(${o.department_code})` : null].filter(Boolean).join(" ") || o.region,
    o.published_at ? `Publiée le ${day(o.published_at)}` : null,
  ].filter((x): x is string => Boolean(x));
}

/** Cartes d'opportunités (HTML) : type, titre, acheteur, résumé, lieu, date limite, source. */
export function renderCards(items: VeilleOpportunity[], link: (id: string) => string, i: Pick<VeilleEmailInput, "sectorLabel" | "typeLabel">): string {
  return items
    .map((o) => {
      const m = meta(o, i);
      const desc = o.summary ?? o.description;
      return `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe4ee;border-radius:10px;background:#ffffff"><tr><td style="padding:16px 18px">
<p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#0F766E;font-weight:600;text-transform:uppercase;letter-spacing:.3px">${escapeHtml(i.typeLabel(o.type))}</p>
<a href="${escapeHtml(link(o.id))}" style="font-size:16px;line-height:22px;font-weight:700;color:#0F2D4A;text-decoration:none">${escapeHtml(clip(o.title, 140))}</a>
${o.origin === "EXTERNAL" && o.external_buyer_name ? `<p style="margin:6px 0 0;font-size:13px;line-height:19px;color:#334155">${escapeHtml(o.external_buyer_name)}</p>` : ""}
${desc ? `<p style="margin:8px 0 0;font-size:14px;line-height:21px;color:#475569">${escapeHtml(clip(desc.replace(/\s+/g, " ").trim(), 220))}</p>` : ""}
${m.length ? `<p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#64748b">${m.map(escapeHtml).join(" · ")}</p>` : ""}
<p style="margin:6px 0 0;font-size:12px;line-height:18px;color:#64748b">${o.response_deadline ? `<strong style="color:#0F2D4A">Réponse avant le ${escapeHtml(day(o.response_deadline))}</strong> · ` : ""}${escapeHtml(o.origin === "EXTERNAL" ? `Source : ${o.source}` : "Publiée sur LinkProB2B")}</p>
<p style="margin:12px 0 0"><a href="${escapeHtml(link(o.id))}" style="font-size:14px;font-weight:600;color:#0F766E;text-decoration:none">Voir l'opportunité →</a></p>
</td></tr></table></td></tr>`;
    })
    .join("");
}

/** E-mail de veille (HTML adapté au mobile + version texte). Aucune donnée inventée : uniquement les champs présents. */
export function renderVeilleEmail(i: VeilleEmailInput): { subject: string; html: string; text: string } {
  const L = veilleLinks(i.base, i.token);
  const subject = veilleSubject(i.kind, i.items.length);
  const paragraphs = intro(i);
  const cards = renderCards(i.items, L.item, i);
  const dailyBlock =
    i.frequency !== "DAILY"
      ? `<tr><td style="padding:8px 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F2D4A;border-radius:12px"><tr><td style="padding:22px 22px">
<p style="margin:0 0 8px;font-size:18px;line-height:24px;font-weight:700;color:#ffffff">Et si les opportunités venaient directement à vous ?</p>
<p style="margin:0 0 16px;font-size:14px;line-height:21px;color:#dbeafe">Recevez chaque jour une sélection d'opportunités B2B adaptée à votre entreprise, à votre secteur d'activité et à votre zone géographique.</p>
<a href="${escapeHtml(L.daily)}" style="display:inline-block;background:#14B8A6;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Recevoir mes opportunités chaque jour</a>
<p style="margin:14px 0 0;font-size:13px;line-height:19px;color:#bfdbfe">Vous préférez une veille moins fréquente ? Recevez deux sélections par semaine, le lundi et le vendredi.</p>
</td></tr></table></td></tr>`
      : "";
  const reason =
    i.frequency === "DAILY"
      ? "Vous recevez cet e-mail car vous avez activé les alertes quotidiennes de LinkProB2B."
      : "Vous recevez cet e-mail car vous avez un compte LinkProB2B et avez accepté de recevoir ses actualités ou sa veille par e-mail.";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#EEF4F9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(i.items.length ? clip(i.items[0].title, 90) : "Votre veille B2B")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4F9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:#0F2D4A;border-radius:12px 12px 0 0;padding:18px 24px"><a href="${escapeHtml(i.base)}" style="text-decoration:none"><img src="${escapeHtml(i.base)}/brand/logo-white.png" width="170" height="34" alt="LinkProB2B" style="display:block;border:0;width:170px;height:34px"></a></td></tr>
<tr><td style="background:#F8FAFC;padding:24px 24px 8px;border-radius:0 0 12px 12px">
<p style="margin:0 0 4px;font-size:12px;color:#0F766E;font-weight:600;letter-spacing:.3px;text-transform:uppercase">${i.kind === "DAILY" ? "Alerte quotidienne" : "Veille commerciale"}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#0F2D4A">${escapeHtml(subject.replace(/^Votre veille B2B( LinkProB2B)? — /, ""))}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:#334155">${escapeHtml(p)}</p>`).join("")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${cards}
<tr><td align="center" style="padding:8px 0 20px"><a href="${escapeHtml(L.all)}" style="display:inline-block;background:#14B8A6;color:#ffffff;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Voir toutes les opportunités ouvertes</a></td></tr>
${dailyBlock}</table>
<p style="margin:20px 0 6px;font-size:12px;line-height:18px;color:#64748b">${escapeHtml(reason)} Chaque annonce est vérifiée (toujours ouverte) au moment de l'envoi ; consultez la source officielle avant de répondre.</p>
<p style="margin:0 0 20px;font-size:12px;line-height:18px;color:#64748b"><a href="${escapeHtml(L.prefs)}" style="color:#0F2D4A">Gérer mes préférences</a> · <a href="${escapeHtml(L.unsubscribe)}" style="color:#0F2D4A">Se désabonner</a> · LinkProB2B — <a href="${escapeHtml(i.base)}" style="color:#0F2D4A">www.linkprob2b.com</a></p>
</td></tr></table></td></tr></table>
${i.token !== "apercu" ? `<img src="${escapeHtml(L.pixel)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : ""}
</body></html>`;
  const text = [
    subject,
    "",
    ...paragraphs,
    "",
    ...i.items.flatMap((o) => [
      `• ${o.title}`,
      ...(o.origin === "EXTERNAL" && o.external_buyer_name ? [`  ${o.external_buyer_name}`] : []),
      ...(meta(o, i).length ? [`  ${meta(o, i).join(" · ")}`] : []),
      ...(o.response_deadline ? [`  Réponse avant le ${day(o.response_deadline)}`] : []),
      `  ${o.origin === "EXTERNAL" ? `Source : ${o.source}` : "Publiée sur LinkProB2B"}`,
      `  ${L.item(o.id)}`,
      "",
    ]),
    `Toutes les opportunités ouvertes : ${L.all}`,
    ...(i.frequency !== "DAILY" ? ["", "Recevoir mes opportunités chaque jour : " + L.daily, "Vous préférez une veille moins fréquente ? Recevez deux sélections par semaine, le lundi et le vendredi."] : []),
    "",
    reason,
    `Gérer mes préférences : ${L.prefs}`,
    `Se désabonner : ${L.unsubscribe}`,
    "LinkProB2B — www.linkprob2b.com",
  ].join("\n");
  return { subject, html, text };
}

/**
 * Invitation unique à activer la veille (inscrits sans accord) : explique pourquoi ce message,
 * montre quelques opportunités réelles, un bouton pour activer, et rien d'autre ne suit sans accord.
 */
export function renderVeilleInvitation(i: { base: string; token: string; firstName: string | null; items: VeilleOpportunity[]; personalized: boolean; sectorLabel: (slug: string) => string }) {
  const L = veilleLinks(i.base, i.token);
  const subject = "Activez votre veille B2B gratuite sur LinkProB2B";
  const paragraphs = [
    i.firstName ? `Bonjour ${i.firstName},` : "Bonjour,",
    "Vous avez créé un compte sur LinkProB2B. Nous proposons désormais une veille gratuite par e-mail : une sélection d'opportunités B2B réelles et encore ouvertes (marchés publics BOAMP et TED, besoins d'entreprises), le lundi et le vendredi, ou chaque jour si vous le préférez.",
    i.personalized
      ? "Voici quelques opportunités publiées récemment qui correspondent aux secteurs de votre entreprise :"
      : "Voici quelques opportunités publiées récemment :",
  ];
  const cards = i.items
    .map((o) => {
      const meta = [o.sector_slug ? i.sectorLabel(o.sector_slug) : null, o.region, o.response_deadline ? `réponse avant le ${day(o.response_deadline)}` : null].filter((x): x is string => Boolean(x));
      return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe4ee;border-radius:10px;background:#ffffff"><tr><td style="padding:14px 16px">
<a href="${escapeHtml(L.item(o.id))}" style="font-size:15px;line-height:21px;font-weight:700;color:#0F2D4A;text-decoration:none">${escapeHtml(clip(o.title, 140))}</a>
${o.origin === "EXTERNAL" && o.external_buyer_name ? `<p style="margin:4px 0 0;font-size:13px;color:#334155">${escapeHtml(o.external_buyer_name)}</p>` : ""}
${meta.length ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b">${meta.map(escapeHtml).join(" · ")}</p>` : ""}
</td></tr></table></td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#EEF4F9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4F9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:#0F2D4A;border-radius:12px 12px 0 0;padding:18px 24px"><a href="${escapeHtml(i.base)}" style="text-decoration:none"><img src="${escapeHtml(i.base)}/brand/logo-white.png" width="170" height="34" alt="LinkProB2B" style="display:block;border:0;width:170px;height:34px"></a></td></tr>
<tr><td style="background:#F8FAFC;padding:24px;border-radius:0 0 12px 12px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#0F2D4A">Activez votre veille B2B gratuite</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:#334155">${escapeHtml(p)}</p>`).join("")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">${cards}</table>
<p style="margin:18px 0 8px;text-align:center"><a href="${escapeHtml(L.prefs)}" style="display:inline-block;background:#14B8A6;color:#ffffff;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Activer ma veille</a></p>
<p style="margin:0 0 16px;text-align:center;font-size:13px;color:#475569">Vous choisissez vos secteurs, vos régions et la fréquence. Gratuit, sans engagement.</p>
<p style="margin:16px 0 6px;font-size:12px;line-height:18px;color:#64748b">Vous recevez ce message unique parce que vous avez un compte LinkProB2B. Sans action de votre part, vous ne recevrez pas la veille et nous ne vous écrirons plus à ce sujet.</p>
<p style="margin:0;font-size:12px;line-height:18px;color:#64748b"><a href="${escapeHtml(L.unsubscribe)}" style="color:#0F2D4A">Ne plus recevoir ce type d'e-mail</a> · LinkProB2B — <a href="${escapeHtml(i.base)}" style="color:#0F2D4A">www.linkprob2b.com</a></p>
</td></tr></table></td></tr></table>
<img src="${escapeHtml(L.pixel)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">
</body></html>`;
  const text = [
    subject,
    "",
    ...paragraphs,
    "",
    ...i.items.flatMap((o) => [`• ${o.title}`, `  ${L.item(o.id)}`]),
    "",
    `Activer ma veille : ${L.prefs}`,
    "Vous choisissez vos secteurs, vos régions et la fréquence. Gratuit, sans engagement.",
    "",
    "Vous recevez ce message unique parce que vous avez un compte LinkProB2B. Sans action de votre part, vous ne recevrez pas la veille et nous ne vous écrirons plus à ce sujet.",
    `Ne plus recevoir ce type d'e-mail : ${L.unsubscribe}`,
  ].join("\n");
  return { subject, html, text };
}
