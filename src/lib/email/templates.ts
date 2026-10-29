import { escapeHtml } from "@/lib/email/escape";
import { button, cards, heroUrl, note, paragraph, shell, type Hero } from "@/lib/email/design";
import { siteUrl } from "@/lib/seo";

export { escapeHtml };

type Layout = {
  title: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer?: string;
  list?: { label: string; url: string }[];
  /** Ligne au-dessus du titre (catégorie). */
  kicker?: string;
  /** Photo d'en-tête (public/email/hero-*.jpg). */
  hero?: Hero;
};

/** Gabarit des e-mails de compte et de notification : en-tête, photo, titre, texte, bouton. */
export function renderEmail({ title, paragraphs, cta, footer, list, kicker, hero = "meridiens" }: Layout): { html: string; text: string } {
  const base = siteUrl();
  const items = list?.length ? cards(list.map((i) => ({ title: i.label, url: i.url, action: "Voir" }))) : "";
  const html = shell({
    base,
    subject: title,
    preheader: paragraphs[0] ?? title,
    kicker,
    title,
    heroImage: heroUrl(base, hero),
    body: `${paragraphs.map(paragraph).join("")}${items}${cta ? button(cta.label, cta.url) : ""}`,
    notes: note(escapeHtml(footer ?? "Vous recevez cet e-mail car vous avez un compte LinkProB2B. Gérez vos préférences dans votre espace, rubrique Paramètres.")),
  });
  const text = [title, "", ...paragraphs, ...(list?.map((i) => `- ${i.label} : ${i.url}`) ?? []), cta ? `${cta.label} : ${cta.url}` : "", "", "L'équipe LinkProB2B", "", footer ?? ""].join("\n");
  return { html, text };
}
