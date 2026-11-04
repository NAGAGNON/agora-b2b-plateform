/**
 * Liens de recherche pour mieux connaître un inscrit (réservés aux administrateurs).
 * Rien n'est deviné ni collecté : ce sont des liens de recherche que l'administrateur ouvre
 * lui-même (LinkedIn, annuaire officiel de l'État, site de l'entreprise tiré de l'adresse e-mail).
 */

/** Messageries grand public : leur domaine ne dit rien de l'entreprise. */
const WEBMAILS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "live.com", "live.fr", "msn.com",
  "yahoo.com", "yahoo.fr", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "aol.fr", "orange.fr", "wanadoo.fr",
  "free.fr", "sfr.fr", "neuf.fr", "laposte.net", "bbox.fr", "numericable.fr", "gmx.fr", "gmx.com", "gmx.de", "proton.me",
  "protonmail.com", "yandex.com", "mail.com", "club-internet.fr", "voila.fr", "cegetel.net", "aliceadsl.fr", "skynet.be",
]);

/** Domaine professionnel de l'adresse e-mail (null pour une messagerie grand public). */
export function professionalDomain(email: string): string | null {
  const d = email.split("@")[1]?.trim().toLowerCase();
  if (!d || !d.includes(".") || WEBMAILS.has(d)) return null;
  return d;
}

export type SignupLink = { label: string; url: string };

/** Liens utiles pour un inscrit : LinkedIn (personne, entreprise), annuaire de l'État, site. */
export function signupLookupLinks(u: { name: string | null; email: string; company?: string | null }): SignupLink[] {
  const domain = professionalDomain(u.email);
  const name = (u.name ?? "").trim();
  const company = (u.company ?? "").trim() || (domain ? domain.split(".").slice(0, -1).join(" ") : "");
  const q = encodeURIComponent;
  const links: SignupLink[] = [];
  if (name) links.push({ label: "LinkedIn : chercher la personne", url: `https://www.linkedin.com/search/results/people/?keywords=${q([name, company].filter(Boolean).join(" "))}` });
  if (company) {
    links.push({ label: "LinkedIn : chercher l'entreprise", url: `https://www.linkedin.com/search/results/companies/?keywords=${q(company)}` });
    links.push({ label: "Annuaire des entreprises (État)", url: `https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${q(company)}` });
  }
  if (domain) links.push({ label: `Site internet (${domain})`, url: `https://${domain}` });
  return links;
}
