import { escapeHtml } from "@/lib/email/escape";
import { button, C, note, paragraph, shell } from "@/lib/email/design";

/**
 * E-mails de l'offre de lancement : courts et visuels. Un titre, deux lignes, le prix en grand,
 * trois avantages, un bouton. Rien d'autre.
 */
export type OfferEmail = {
  subject: string;
  kicker: string;
  title: string;
  intro: string;
  benefits: string[];
  price: { now: string; before: string; detail: string };
  cta: string;
  foot: string;
};

const solid = (c: string) => `background-color:${c};background-image:linear-gradient(${c},${c})`;

function priceBox(p: OfferEmail["price"]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border-radius:14px;${solid("#FFFBEB")};border:1px solid #FCD34D"><tr><td align="center" style="padding:20px 16px">
<p style="margin:0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#92400E">Tarif fondateur</p>
<p style="margin:6px 0 0;font-size:34px;line-height:40px;font-weight:800;color:${C.navy}">${escapeHtml(p.now)}</p>
<p style="margin:4px 0 0;font-size:14px;line-height:20px;color:${C.muted}"><span style="text-decoration:line-through">${escapeHtml(p.before)}</span> · ${escapeHtml(p.detail)}</p>
</td></tr></table>`;
}

function checks(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${items
    .map(
      (t) => `<tr><td width="30" valign="top" style="padding:0 0 10px"><div style="width:22px;height:22px;border-radius:11px;${solid("#CCFBF1")};color:${C.tealDark};font-size:13px;line-height:22px;font-weight:700;text-align:center">✓</div></td>
<td valign="top" style="padding:1px 0 10px;font-size:15px;line-height:21px;color:${C.slate}">${escapeHtml(t)}</td></tr>`,
    )
    .join("")}</table>`;
}

export function renderOfferEmail(e: OfferEmail, base: string, url: string): { html: string; text: string } {
  const html = shell({
    base,
    subject: e.subject,
    preheader: e.intro,
    kicker: e.kicker,
    title: e.title,
    body: `${paragraph(e.intro)}${checks(e.benefits)}${priceBox(e.price)}${button(e.cta, url)}<p style="margin:14px 0 0;font-size:13px;line-height:19px;color:${C.muted}">${escapeHtml(e.foot)}</p>`,
    notes: note(escapeHtml("Vous recevez cet e-mail car vous avez un compte LinkProB2B. Gérez vos préférences dans votre espace, rubrique Paramètres.")),
  });
  const text = [e.title, "", e.intro, "", ...e.benefits.map((b) => `- ${b}`), "", `Tarif fondateur : ${e.price.now} (au lieu de ${e.price.before}, ${e.price.detail})`, "", `${e.cta} : ${url}`, "", e.foot, "", "L'équipe LinkProB2B"].join("\n");
  return { html, text };
}
