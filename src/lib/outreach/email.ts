import { escapeHtml } from "@/lib/email/escape";
import { button, callout, cards, facts, note, noteLink, paragraph, sectorBannerUrl, sectorThumbUrl, shell, C } from "@/lib/email/design";

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
  /** Secteur (slug) : photo de la carte. */
  sectorSlug?: string | null;
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

/** Famille de secteur la plus représentée (photo d'en-tête). */
function mainSector(items: EmailOpportunity[]): string | null {
  const count = new Map<string, number>();
  for (const o of items) if (o.sectorSlug) count.set(o.sectorSlug, (count.get(o.sectorSlug) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const footerNotes = (i: { reason: string; dataSource: string; sender: string[]; unsubscribeUrl: string }, unsubscribe: string, extra = "") =>
  note(escapeHtml(i.reason)) + note(`${extra}${escapeHtml(i.dataSource)}`) + note(i.sender.map(escapeHtml).join("<br>")) + note(noteLink(unsubscribe, i.unsubscribeUrl));

export function renderOutreachEmail(i: OutreachEmailInput): { subject: string; html: string; text: string } {
  const n = i.opportunities.length;
  const html = shell({
    base: i.siteUrl,
    subject: i.subject,
    preheader: `${n} opportunité${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""} pour ${i.companyName}`,
    kicker: "Sélection du jour",
    title: `${n} opportunité${n > 1 ? "s" : ""} correspondant à votre activité`,
    heroImage: sectorBannerUrl(i.siteUrl, mainSector(i.opportunities)),
    body:
      paragraph(`Bonjour ${i.companyName},`) +
      paragraph(i.intro) +
      button("Découvrir les opportunités", i.landingUrl) +
      cards(
        i.opportunities.map((o) => ({
          kicker: o.sector,
          title: o.title,
          url: o.url,
          summary: o.summary,
          meta: [o.location, o.source ? `Source : ${o.source}` : null].filter((x): x is string => Boolean(x)),
          deadline: o.deadline,
          image: sectorThumbUrl(i.siteUrl, o.sectorSlug),
        })),
      ) +
      callout({
        kicker: "Gratuit",
        title: "Recevez automatiquement les prochaines opportunités",
        text: "LinkProB2B rassemble chaque jour les appels d'offres et besoins d'entreprises partout en France. Créez un compte gratuit pour recevoir les opportunités adaptées à votre activité.",
        cta: { label: "Créer mon compte gratuitement", url: i.signupUrl },
      }),
    notes: footerNotes(i, "Ne plus recevoir ces sélections", "Les opportunités proviennent de sources publiques (BOAMP, TED…) ou d'entreprises inscrites sur LinkProB2B ; l'annonce officielle fait foi. "),
    pixelUrl: i.pixelUrl,
  });
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

export type NeedEmailInput = {
  companyName: string;
  subject: string;
  /** Activité de l'entreprise contactée (code NAF, secteur), telle qu'elle figure dans sa fiche publique */
  activity: string;
  need: EmailOpportunity & { budget: string | null; buyer: string | null };
  messageUrl: string;
  unsubscribeUrl: string;
  pixelUrl?: string;
  siteUrl: string;
  reason: string;
  dataSource: string;
  sender: string[];
};

/**
 * E-mail dédié à UN besoin publié par une entreprise inscrite : court, factuel, sans relation
 * préalable supposée, avec une action principale « Envoyer un message ».
 */
export function renderNeedEmail(i: NeedEmailInput): { subject: string; html: string; text: string } {
  const n = i.need;
  const pairs = [
    n.sector ? ["Secteur", n.sector] : null,
    n.location ? ["Lieu", n.location] : null,
    n.budget ? ["Budget indiqué", n.budget] : null,
    n.deadline ? ["Réponse souhaitée avant le", n.deadline] : null,
  ].filter((x): x is [string, string] => Boolean(x));
  const intro = `Une entreprise a publié sur LinkProB2B un besoin qui pourrait correspondre à l'activité de ${i.companyName}.`;
  const why = `Au regard de votre activité (${i.activity})${n.location ? ` et de votre localisation` : ""}, nous pensons que cette demande peut vous intéresser. Vous pouvez consulter le détail et écrire directement à l'entreprise qui l'a publiée, sans créer de compte.`;
  const needCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid ${C.border};border-left:4px solid ${C.teal};border-radius:12px;background:${C.soft}"><tr><td style="padding:18px 20px">
<p style="margin:0 0 6px;font-size:18px;line-height:24px;font-weight:800;color:${C.navy}">${escapeHtml(n.title)}</p>
${n.buyer ? `<p style="margin:0 0 8px;font-size:13px;line-height:19px;color:${C.muted}">Publié par <strong style="color:${C.slate}">${escapeHtml(n.buyer)}</strong></p>` : ""}
${n.summary ? `<p style="margin:0;font-size:14px;line-height:22px;color:${C.slate}">${escapeHtml(n.summary)}</p>` : ""}
${facts(pairs)}
</td></tr></table>`;
  const html = shell({
    base: i.siteUrl,
    subject: i.subject,
    preheader: n.title,
    kicker: "Besoin publié par une entreprise",
    title: "Une entreprise recherche un prestataire",
    heroImage: sectorBannerUrl(i.siteUrl, n.sectorSlug),
    body:
      paragraph("Bonjour,") +
      paragraph(intro) +
      needCard +
      paragraph(why) +
      button("ENVOYER UN MESSAGE", i.messageUrl) +
      `<p style="margin:0 0 18px;clear:both;font-size:13px;line-height:19px;color:${C.muted}">Sans création de compte : votre message est transmis directement à l'entreprise. <a href="${escapeHtml(n.url)}" style="color:${C.tealDark};font-weight:600">Voir le besoin</a></p>`,
    notes: footerNotes(i, "Ne plus recevoir de messages de LinkProB2B"),
    pixelUrl: i.pixelUrl,
  });
  const text = [
    "Bonjour,",
    "",
    intro,
    "",
    `• ${n.title}`,
    ...(n.buyer ? [`  Publié par ${n.buyer}`] : []),
    ...(n.summary ? [`  ${n.summary}`] : []),
    ...pairs.map(([k, v]) => `  ${k} : ${v}`),
    "",
    why,
    "",
    `ENVOYER UN MESSAGE : ${i.messageUrl}`,
    `Voir le besoin : ${n.url}`,
    "",
    "L'équipe LinkProB2B",
    "",
    i.reason,
    i.dataSource,
    ...i.sender,
    `Ne plus recevoir de messages de LinkProB2B : ${i.unsubscribeUrl}`,
  ].join("\n");
  return { subject: i.subject, html, text };
}

export type CompanyPresentationInput = {
  companyName: string;
  subject: string;
  presented: { name: string; tagline: string | null; city: string | null; activities: string[]; description: string | null; url: string; sectorSlug: string | null };
  unsubscribeUrl: string;
  pixelUrl?: string;
  siteUrl: string;
  reason: string;
  dataSource: string;
  sender: string[];
};

/**
 * Offre « Visibilité » : présentation d'UNE entreprise inscrite sur LinkProB2B (demande validée par
 * l'équipe) à une entreprise ciblée. Court, factuel, une seule action : « Découvrir l'entreprise ».
 */
export function renderCompanyPresentationEmail(i: CompanyPresentationInput): { subject: string; html: string; text: string } {
  const p = i.presented;
  const intro = `${p.name}, entreprise inscrite sur LinkProB2B${p.city ? ` (${p.city})` : ""}, souhaite se faire connaître auprès d'entreprises comme ${i.companyName}.`;
  const pairs = [p.activities.length ? ["Activité", p.activities.join(", ")] : null, p.city ? ["Localisation", p.city] : null].filter((x): x is [string, string] => Boolean(x));
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid ${C.border};border-left:4px solid ${C.teal};border-radius:12px;background:${C.soft}"><tr><td style="padding:18px 20px">
<p style="margin:0 0 6px;font-size:18px;line-height:24px;font-weight:800;color:${C.navy}">${escapeHtml(p.name)}</p>
${p.tagline ? `<p style="margin:0 0 8px;font-size:14px;line-height:21px;color:${C.slate}">${escapeHtml(p.tagline)}</p>` : ""}
${p.description ? `<p style="margin:0;font-size:14px;line-height:22px;color:${C.slate}">${escapeHtml(p.description)}</p>` : ""}
${facts(pairs)}
</td></tr></table>`;
  const html = shell({
    base: i.siteUrl,
    subject: i.subject,
    preheader: `${p.name} se présente`,
    kicker: "Entreprise à découvrir",
    title: `Découvrez ${p.name}`,
    heroImage: sectorBannerUrl(i.siteUrl, p.sectorSlug),
    body:
      paragraph("Bonjour,") +
      paragraph(intro) +
      card +
      button("DÉCOUVRIR L'ENTREPRISE", p.url) +
      `<p style="margin:0 0 18px;clear:both;font-size:13px;line-height:19px;color:${C.muted}">Sa fiche présente ses services, ses références et un moyen de la contacter directement.</p>`,
    notes: footerNotes(i, "Ne plus recevoir de messages de LinkProB2B"),
    pixelUrl: i.pixelUrl,
  });
  const text = [
    "Bonjour,",
    "",
    intro,
    "",
    `• ${p.name}`,
    ...(p.tagline ? [`  ${p.tagline}`] : []),
    ...(p.description ? [`  ${p.description}`] : []),
    ...pairs.map(([k, v]) => `  ${k} : ${v}`),
    "",
    `DÉCOUVRIR L'ENTREPRISE : ${p.url}`,
    "",
    "L'équipe LinkProB2B",
    "",
    i.reason,
    i.dataSource,
    ...i.sender,
    `Ne plus recevoir de messages de LinkProB2B : ${i.unsubscribeUrl}`,
  ].join("\n");
  return { subject: i.subject, html, text };
}
