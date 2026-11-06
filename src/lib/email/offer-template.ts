import { escapeHtml } from "@/lib/email/escape";
import { C, note, shell } from "@/lib/email/design";

/**
 * E-mails de l'offre de lancement : courts et modernes. Un bloc sombre (titre, prix en grand), ce que
 * l'abonné gagne, un bouton. Compatible Outlook, Gmail, Apple Mail (tableaux, styles en ligne).
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
const VIOLET = "#7C6CFF";
const NAVY = "#0A1A33";

function hero(e: OfferEmail): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-radius:18px;background-color:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,#12305a 55%,#2a2470 100%)"><tr><td style="padding:28px 26px">
<p style="margin:0 0 10px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#5EEAD4">${escapeHtml(e.kicker)}</p>
<p style="margin:0 0 10px;font-size:26px;line-height:32px;font-weight:800;color:#ffffff">${escapeHtml(e.title)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:22px;color:#CBD5E1">${escapeHtml(e.intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-radius:14px;${solid("#13294b")};border:1px solid #2DD4BF"><tr><td style="padding:14px 18px">
<p style="margin:0;font-size:11px;line-height:15px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#A5B4FC">Pro · tarif fondateur</p>
<p style="margin:4px 0 0;font-size:30px;line-height:36px;font-weight:800;color:#2DD4BF">${escapeHtml(e.price.now)}</p>
<p style="margin:2px 0 0;font-size:13px;line-height:18px;color:#94A3B8"><span style="text-decoration:line-through">${escapeHtml(e.price.before)}</span> · ${escapeHtml(e.price.detail)}</p>
</td></tr></table>
</td></tr></table>`;
}

function wins(items: string[]): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:18px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${C.tealDark}">Ce que vous gagnez</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px">${items
    .map(
      (t) => `<tr><td width="38" valign="top" style="padding:0 0 12px"><div style="width:28px;height:28px;border-radius:9px;background-color:#14C2AD;background-image:linear-gradient(135deg,#14C2AD,${VIOLET});color:#ffffff;font-size:15px;line-height:28px;font-weight:800;text-align:center">✓</div></td>
<td valign="middle" style="padding:0 0 12px;font-size:16px;line-height:22px;color:${C.navy};font-weight:600">${escapeHtml(t)}</td></tr>`,
    )
    .join("")}</table>`;
}

function cta(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:12px;background-color:#14C2AD;background-image:linear-gradient(90deg,#14C2AD,#22D3EE)"><a href="${escapeHtml(url)}" style="display:block;padding:15px 24px;font-size:16px;font-weight:800;color:${NAVY};text-decoration:none;border-radius:12px">${escapeHtml(label)} →</a></td></tr></table>`;
}

export function renderOfferEmail(e: OfferEmail, base: string, url: string): { html: string; text: string } {
  const html = shell({
    base,
    subject: e.subject,
    preheader: e.intro,
    body: `${hero(e)}${wins(e.benefits)}${cta(e.cta, url)}<p style="margin:12px 0 0;text-align:center;font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(e.foot)}</p>`,
    notes: note(escapeHtml("Vous recevez cet e-mail car vous avez un compte LinkProB2B. Gérez vos préférences dans votre espace, rubrique Paramètres.")),
  });
  const text = [e.title, "", e.intro, "", `Tarif fondateur : ${e.price.now} (au lieu de ${e.price.before}, ${e.price.detail})`, "", "Ce que vous gagnez :", ...e.benefits.map((b) => `- ${b}`), "", `${e.cta} : ${url}`, "", e.foot, "", "L'équipe LinkProB2B"].join("\n");
  return { html, text };
}
