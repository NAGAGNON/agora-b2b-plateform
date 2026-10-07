import { escapeHtml } from "@/lib/email/templates";

/**
 * E-mail de veille commerciale : une entreprise, ses opportunités du jour
 * présentées en cartes, un bouton principal vers sa sélection personnalisée.
 * Gabarit en tableaux et styles en ligne (Outlook, Gmail, Apple Mail, mobile).
 */

export type EmailOpportunity = {
  id: string;
  title: string;
  sector: string | null;
  location: string | null;
  deadline: string | null;
  summary: string | null;
  source: string | null;
  url: string;
};

export type OutreachEmailInput = {
  companyName: string;
  subject: string;
  intro: string;
  opportunities: EmailOpportunity[];
  landingUrl: string;
  signupUrl: string;
  unsubscribeUrl: string;
  pixelUrl?: string;
  siteUrl: string;
  /** Pourquoi ce message : activité et zone qui ont déterminé la sélection. */
  reason: string;
  /** Origine des coordonnées (traçabilité). */
  dataSource: string;
  /** Identification de l'expéditeur (lignes de pied de page). */
  sender: string[];
};

/** Remplace {variable} dans un modèle (texte brut, échappé ensuite). */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m)).replace(/\s+([,.])/g, "$1").trim();
}

const C = { navy: "#0F2D4A", teal: "#14B8A6", tealDark: "#0F766E", sky: "#E8F4FD", slate: "#334155", muted: "#64748B", border: "#E2E8F0" };

function card(o: EmailOpportunity): string {
  const meta = [o.sector, o.location].filter(Boolean).map((v) => escapeHtml(v!)).join(" &nbsp;·&nbsp; ");
  return `<tr><td style="padding:0 0 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background:#ffffff">
<tr><td style="padding:18px 20px">
${meta ? `<p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${C.tealDark};font-weight:600;text-transform:uppercase;letter-spacing:.3px">${meta}</p>` : ""}
<p style="margin:0 0 8px;font-size:16px;line-height:22px;font-weight:700;color:${C.navy}">${escapeHtml(o.title)}</p>
${o.summary ? `<p style="margin:0 0 10px;font-size:14px;line-height:20px;color:${C.slate}">${escapeHtml(o.summary)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:13px;line-height:18px;color:${C.muted}">${o.deadline ? `Date limite : <strong style="color:${C.navy}">${escapeHtml(o.deadline)}</strong>` : "Date limite : voir l'annonce"}${o.source ? `<br>Source : ${escapeHtml(o.source)}` : ""}</td>
<td align="right" style="white-space:nowrap;padding-left:12px"><a href="${escapeHtml(o.url)}" style="display:inline-block;border:1px solid ${C.navy};color:${C.navy};padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">Voir l'opportunité</a></td>
</tr></table>
</td></tr></table>
</td></tr>`;
}

export function renderOutreachEmail(i: OutreachEmailInput): { subject: string; html: string; text: string } {
  const n = i.opportunities.length;
  const preheader = `${n} opportunité${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""} pour ${i.companyName}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(i.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky};font-family:Inter,Segoe UI,Arial,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="background:${C.navy};border-radius:14px 14px 0 0;padding:20px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><a href="${escapeHtml(i.siteUrl)}" style="text-decoration:none"><img src="${escapeHtml(i.siteUrl)}/brand/logo-white.png" width="150" alt="LinkProB2B" style="display:block;border:0;width:150px;height:auto;color:#ffffff;font-size:20px;font-weight:700"></a></td>
<td align="right" style="color:#CBD5E1;font-size:12px;line-height:16px">Veille opportunités<br>B2B</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;padding:28px 28px 8px">
<p style="margin:0 0 6px;font-size:13px;color:${C.tealDark};font-weight:700;text-transform:uppercase;letter-spacing:.4px">Sélection du jour</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:28px;color:${C.navy}">${n} opportunité${n > 1 ? "s" : ""} correspondant à votre activité</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:${C.slate}">Bonjour ${escapeHtml(i.companyName)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:23px;color:${C.slate}">${escapeHtml(i.intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="border-radius:10px;background:${C.teal}"><a href="${escapeHtml(i.landingUrl)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:${C.navy};text-decoration:none;border-radius:10px">Découvrir les opportunités</a></td></tr></table>
</td></tr>
<tr><td style="background:#ffffff;padding:0 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${i.opportunities.map(card).join("")}</table></td></tr>
<tr><td style="background:#ffffff;padding:8px 28px 28px;border-radius:0 0 14px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky};border-radius:12px"><tr><td style="padding:18px 20px">
<p style="margin:0 0 6px;font-size:15px;line-height:22px;font-weight:700;color:${C.navy}">Recevez automatiquement les prochaines opportunités</p>
<p style="margin:0 0 12px;font-size:14px;line-height:20px;color:${C.slate}">LinkProB2B rassemble chaque jour les appels d'offres et besoins d'entreprises partout en France. Créez un compte gratuit pour recevoir les opportunités adaptées à votre activité.</p>
<a href="${escapeHtml(i.signupUrl)}" style="color:${C.tealDark};font-size:14px;font-weight:700">Créer mon compte gratuitement →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px;font-size:12px;line-height:18px;color:${C.muted}">
<p style="margin:0 0 8px">${escapeHtml(i.reason)}</p>
<p style="margin:0 0 8px">Les opportunités proviennent de sources publiques (BOAMP, TED…) ou d'entreprises inscrites sur LinkProB2B ; l'annonce officielle fait foi. ${escapeHtml(i.dataSource)}</p>
<p style="margin:0 0 8px">${i.sender.map(escapeHtml).join("<br>")}</p>
<p style="margin:0"><a href="${escapeHtml(i.unsubscribeUrl)}" style="color:${C.muted}">Ne plus recevoir ces sélections</a></p>
</td></tr>
</table></td></tr></table>
${i.pixelUrl ? `<img src="${escapeHtml(i.pixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : ""}
</body></html>`;
  const text = [
    `${n} opportunité${n > 1 ? "s" : ""} correspondant à votre activité`,
    "",
    `Bonjour ${i.companyName},`,
    "",
    i.intro,
    "",
    `Découvrir les opportunités : ${i.landingUrl}`,
    "",
    ...i.opportunities.flatMap((o) => [
      `• ${o.title}`,
      [o.sector, o.location, o.deadline ? `date limite : ${o.deadline}` : null, o.source ? `source : ${o.source}` : null].filter(Boolean).join(" · "),
      `  Voir l'opportunité : ${o.url}`,
      "",
    ]),
    `Recevez automatiquement les prochaines opportunités : ${i.signupUrl}`,
    "",
    i.reason,
    i.dataSource,
    ...i.sender,
    `Ne plus recevoir ces sélections : ${i.unsubscribeUrl}`,
  ].join("\n");
  return { subject: i.subject, html, text };
}
