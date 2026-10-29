import { escapeHtml } from "@/lib/email/escape";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/**
 * Habillage commun de tous les e-mails LinkProB2B : en-tête avec logo, photo d'illustration,
 * contenu en carte blanche, signature et pied de page aux couleurs de la marque.
 * Tableaux et styles en ligne (Gmail, Outlook, Apple Mail, mobile). Images en JPEG
 * (public/email, lisibles partout, y compris Outlook qui ignore le WebP).
 * Les aplats sombres et les boutons sont doublés d'un dégradé uni : l'application Gmail en mode
 * sombre inverse les couleurs de fond mais pas les dégradés, le logo blanc reste donc lisible.
 */

export const C = {
  navy: "#0F2D4A",
  teal: "#14B8A6",
  tealDark: "#0F766E",
  sky: "#EEF4F9",
  slate: "#334155",
  muted: "#64748B",
  border: "#E2E8F0",
  soft: "#F8FAFC",
};

const FONT = "Inter,Segoe UI,Helvetica,Arial,sans-serif";
const solid = (c: string) => `background-color:${c};background-image:linear-gradient(${c},${c})`;

/** Photos d'en-tête disponibles (public/email/hero-*.jpg). */
export type Hero = "meridiens" | "accord" | "bureau" | "equipe" | "gratte-ciel" | "ordinateurs" | "plans" | "reunion" | "tableau-de-bord";

export const heroUrl = (base: string, hero: Hero) => `${base}/email/hero-${hero}.jpg`;

/** Famille de métiers d'un secteur (slug), pour choisir la photo du secteur. */
export function familyOf(sectorSlug: string | null | undefined): string {
  return (sectorSlug && SECTOR_FAMILIES.find((f) => f.sectors.includes(sectorSlug) || f.slug === sectorSlug)?.slug) || "autres";
}
export const sectorBannerUrl = (base: string, sectorSlug: string | null | undefined) => `${base}/email/secteur-${familyOf(sectorSlug)}.jpg`;
export const sectorThumbUrl = (base: string, sectorSlug: string | null | undefined) => `${base}/email/vignette-${familyOf(sectorSlug)}.jpg`;

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${C.slate}">${escapeHtml(text)}</p>`;
}

/** Bouton principal (compatible Outlook : cellule colorée + lien). */
export function button(label: string, url: string, { align = "left" }: { align?: "left" | "center" } = {}): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td align="${align}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;${solid(C.tealDark)}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(label)}&nbsp;&nbsp;→</a>
</td></tr></table></td></tr></table>`;
}

/** Liste d'étapes numérotées (pastilles). */
export function steps(items: string[]): string {
  if (!items.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${items
    .map(
      (t, n) => `<tr><td width="34" valign="top" style="padding:0 0 10px"><div style="width:24px;height:24px;border-radius:12px;${solid("#CCFBF1")};color:${C.tealDark};font-size:13px;line-height:24px;font-weight:700;text-align:center">${n + 1}</div></td>
<td valign="top" style="padding:2px 0 10px;font-size:15px;line-height:22px;color:${C.slate}">${escapeHtml(t)}</td></tr>`,
    )
    .join("")}</table>`;
}

/** Tableau de faits clés (libellé / valeur). */
export function facts(pairs: [string, string][]): string {
  if (!pairs.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;border-top:1px solid ${C.border}">${pairs
    .map(
      ([k, v]) => `<tr><td style="padding:8px 12px 0 0;font-size:13px;line-height:19px;color:${C.muted};white-space:nowrap" valign="top">${escapeHtml(k)}</td>
<td style="padding:8px 0 0;font-size:13px;line-height:19px;color:${C.navy};font-weight:600" valign="top">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

export type CardInput = {
  kicker?: string | null;
  title: string;
  url: string;
  /** Lien d'action affiché en bas de carte (texte exact, une fois par carte). */
  action?: string;
  subtitle?: string | null;
  summary?: string | null;
  meta?: string[];
  deadline?: string | null;
  image?: string | null;
};

/** Carte d'opportunité : vignette photo du secteur, type, titre, acheteur, résumé, échéance. */
export function card(o: CardInput): string {
  const text = `${o.kicker ? `<p style="margin:0 0 4px;font-size:11px;line-height:16px;color:${C.tealDark};font-weight:700;text-transform:uppercase;letter-spacing:.5px">${escapeHtml(o.kicker)}</p>` : ""}
<a href="${escapeHtml(o.url)}" style="font-size:16px;line-height:22px;font-weight:700;color:${C.navy};text-decoration:none">${escapeHtml(o.title)}</a>
${o.subtitle ? `<p style="margin:4px 0 0;font-size:13px;line-height:19px;color:${C.slate}">${escapeHtml(o.subtitle)}</p>` : ""}
${o.summary ? `<p style="margin:8px 0 0;font-size:14px;line-height:21px;color:#475569">${escapeHtml(o.summary)}</p>` : ""}
${o.meta?.length ? `<p style="margin:10px 0 0;font-size:12px;line-height:18px;color:${C.muted}">${o.meta.map(escapeHtml).join(" &nbsp;·&nbsp; ")}</p>` : ""}
${o.deadline ? `<p style="margin:12px 0 0"><span style="display:inline-block;padding:4px 10px;border-radius:999px;${solid("#FEF3C7")};color:#92400E;font-size:12px;line-height:16px;font-weight:700;white-space:nowrap">Réponse avant le ${escapeHtml(o.deadline)}</span></p>` : ""}
<p style="margin:12px 0 0"><a href="${escapeHtml(o.url)}" style="font-size:14px;font-weight:700;color:${C.tealDark};text-decoration:none">${escapeHtml(o.action ?? "Voir l'opportunité")} →</a></p>`;
  return `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:14px;background:#ffffff"><tr>
${o.image ? `<td width="84" valign="top" style="padding:16px 0 16px 16px"><a href="${escapeHtml(o.url)}"><img src="${escapeHtml(o.image)}" width="68" height="68" alt="" style="display:block;border:0;width:68px;height:68px;border-radius:12px"></a></td>` : ""}
<td valign="top" style="padding:16px 18px 16px ${o.image ? "14px" : "18px"}">${text}</td>
</tr></table></td></tr>`;
}

export const cards = (items: CardInput[]) => (items.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${items.map(card).join("")}</table>` : "");

/** Encadré sombre de mise en avant (titre, texte, lien). */
export function callout(i: { kicker?: string; title: string; text: string; cta?: { label: string; url: string } }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;border-radius:14px;${solid(C.navy)}"><tr><td style="padding:22px 24px">
${i.kicker ? `<p style="margin:0 0 6px;font-size:11px;line-height:16px;color:#5EEAD4;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${escapeHtml(i.kicker)}</p>` : ""}
<p style="margin:0 0 8px;font-size:18px;line-height:24px;font-weight:700;color:#ffffff">${escapeHtml(i.title)}</p>
<p style="margin:0 0 ${i.cta ? "16px" : "0"};font-size:14px;line-height:21px;color:#DBEAFE">${escapeHtml(i.text)}</p>
${i.cta ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;${solid(C.teal)}"><a href="${escapeHtml(i.cta.url)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:700;color:${C.navy};text-decoration:none;border-radius:10px">${escapeHtml(i.cta.label)}</a></td></tr></table>` : ""}
</td></tr></table>`;
}

export type ShellInput = {
  base: string;
  subject: string;
  preheader: string;
  /** Petite ligne au-dessus du titre (catégorie de l'e-mail). */
  kicker?: string;
  title?: string;
  /** Photo d'en-tête (URL absolue). */
  heroImage?: string | null;
  heroAlt?: string;
  /** Contenu HTML (déjà échappé). */
  body: string;
  signature?: boolean;
  /** Mentions de bas de page (HTML déjà échappé). */
  notes: string;
  pixelUrl?: string | null;
};

/** Document HTML complet. */
export function shell(i: ShellInput): string {
  const link = (path: string, label: string) => `<a href="${escapeHtml(i.base + path)}" style="color:#E2E8F0;text-decoration:none">${label}</a>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(i.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky};font-family:${FONT};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(i.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="border-radius:16px 16px 0 0;${solid(C.navy)};padding:20px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><a href="${escapeHtml(i.base)}" style="text-decoration:none"><img src="${escapeHtml(i.base)}/brand/logo-white.png" width="160" height="32" alt="LinkProB2B" style="display:block;border:0;width:160px;height:32px;color:#ffffff;font-size:20px;font-weight:700"></a></td>
<td align="right" style="font-size:12px;line-height:16px;color:#CBD5E1">Opportunités B2B<br>partout en France</td>
</tr></table></td></tr>
${i.heroImage ? `<tr><td style="background:#ffffff;line-height:0;font-size:0"><img src="${escapeHtml(i.heroImage)}" width="600" alt="${escapeHtml(i.heroAlt ?? "")}" style="display:block;border:0;width:100%;max-width:600px;height:auto"></td></tr>` : ""}
<tr><td style="background:#ffffff;padding:30px 28px 10px;${i.heroImage ? "" : `border-top:4px solid ${C.teal};`}">
${i.kicker ? `<p style="margin:0 0 8px;font-size:12px;line-height:16px;color:${C.tealDark};font-weight:700;text-transform:uppercase;letter-spacing:.6px">${escapeHtml(i.kicker)}</p>` : ""}
${i.title ? `<h1 style="margin:0 0 18px;font-size:24px;line-height:31px;font-weight:800;color:${C.navy}">${escapeHtml(i.title).replace(/(\d) (h|€|%)/g, "$1&nbsp;$2")}</h1>` : ""}
${i.body}
${
  i.signature === false
    ? ""
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr>
<td valign="middle" style="padding-right:12px"><img src="${escapeHtml(i.base)}/brand/logo-mark.png" width="38" height="28" alt="" style="display:block;border:0;width:38px;height:28px"></td>
<td valign="middle" style="font-size:14px;line-height:20px;color:${C.slate}">À bientôt,<br><strong style="color:${C.navy}">L'équipe LinkProB2B</strong></td></tr></table>`
}
</td></tr>
<tr><td style="border-radius:0 0 16px 16px;${solid(C.navy)};padding:22px 28px">
<p style="margin:0 0 6px;font-size:14px;line-height:20px;font-weight:700;color:#ffffff">Marchés publics et besoins d'entreprises, au même endroit.</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#E2E8F0">${link("/opportunites", "Opportunités")} &nbsp;·&nbsp; ${link("/publier", "Publier un besoin")} &nbsp;·&nbsp; ${link("/dashboard", "Mon espace")}</p>
</td></tr>
<tr><td style="padding:18px 28px 8px;font-size:12px;line-height:18px;color:${C.muted}">${i.notes}
${i.notes.includes("linkprob2b.com") ? "" : `<p style="margin:8px 0 0">LinkProB2B — <a href="${escapeHtml(i.base)}" style="color:${C.muted}">www.linkprob2b.com</a></p>`}</td></tr>
</table></td></tr></table>
${i.pixelUrl ? `<img src="${escapeHtml(i.pixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : ""}
</body></html>`;
}

export const note = (html: string) => `<p style="margin:0 0 8px">${html}</p>`;
export const noteLink = (label: string, url: string) => `<a href="${escapeHtml(url)}" style="color:${C.muted}">${escapeHtml(label)}</a>`;
