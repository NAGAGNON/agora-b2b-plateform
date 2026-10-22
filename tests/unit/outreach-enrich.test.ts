import { describe, expect, it } from "vitest";
import { contactLinks, enrichCompany, extractEmails, isGenericCompanyEmail, pickWebsite, robotsAllows, type WebsiteSearch } from "@/lib/outreach/enrich";

describe("outreach — site officiel", () => {
  it("écarte annuaires et réseaux sociaux, retient le domaine qui porte le nom", () => {
    const results = [
      { url: "https://www.societe.com/societe/elec-ouest-123456789.html", title: "ELEC OUEST (Brest) Chiffre d'affaires" },
      { url: "https://www.linkedin.com/company/elec-ouest", title: "Elec Ouest | LinkedIn" },
      { url: "https://www.elec-ouest.fr/", title: "Elec Ouest — électricité générale à Brest" },
      { url: "https://www.autre-site.fr/", title: "Électriciens à Brest" },
    ];
    expect(pickWebsite(results, "SARL ELEC OUEST")).toBe("https://www.elec-ouest.fr");
  });

  it("aucun résultat crédible : pas de site inventé", () => {
    expect(pickWebsite([{ url: "https://www.pagesjaunes.fr/x", title: "Elec Ouest" }, { url: "https://www.autre.fr", title: "Autre" }], "Elec Ouest")).toBeNull();
  });
});

describe("outreach — adresses génériques uniquement", () => {
  it("garde contact@, info@… du domaine de l'entreprise, refuse les adresses nominatives", () => {
    expect(isGenericCompanyEmail("contact@elec-ouest.fr", "elec-ouest.fr")).toBe(true);
    expect(isGenericCompanyEmail("info@elec-ouest.fr", "elec-ouest.fr")).toBe(true);
    expect(isGenericCompanyEmail("contact.brest@elec-ouest.fr", "elec-ouest.fr")).toBe(true);
    expect(isGenericCompanyEmail("jean.dupont@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("commercial.jean.dupont@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("contact-jean.dupont@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("jdupont@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("noreply@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("rgpd@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("contact@autre-domaine.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("elec.ouest@orange.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("contact@orange.fr", "elec-ouest.fr")).toBe(true);
  });

  it("boîte au nom de l'entreprise (raison sociale) acceptée, jamais un prénom ou un nom absent de la raison sociale", () => {
    const name = "SARL Dupont Plomberie";
    expect(isGenericCompanyEmail("sarl.dupont-plomberie@orange.fr", null, name)).toBe(true);
    expect(isGenericCompanyEmail("dupontplomberie@wanadoo.fr", null, name)).toBe(true);
    expect(isGenericCompanyEmail("dupont.plomberie@dupont-plomberie.fr", "dupont-plomberie.fr", name)).toBe(true);
    expect(isGenericCompanyEmail("contact.dupont@dupont-plomberie.fr", "dupont-plomberie.fr", name)).toBe(true);
    expect(isGenericCompanyEmail("jean.dupont@orange.fr", null, name)).toBe(false);
    expect(isGenericCompanyEmail("jdupont@orange.fr", null, name)).toBe(false);
    expect(isGenericCompanyEmail("dupont.plomberie@autre-domaine.fr", "dupont-plomberie.fr", name)).toBe(false);
    expect(isGenericCompanyEmail("noreply@dupont-plomberie.fr", "dupont-plomberie.fr", name)).toBe(false);
    // Sans raison sociale fournie : règle stricte inchangée
    expect(isGenericCompanyEmail("dupontplomberie@wanadoo.fr", null)).toBe(false);
  });

  it("extrait les adresses (mailto, texte, [at]) sans les images", () => {
    const html = `<a href="mailto:contact@elec-ouest.fr?subject=x">Écrire</a> info [at] elec-ouest.fr <img src="logo@2x.png">`;
    expect(extractEmails(html).sort()).toEqual(["contact@elec-ouest.fr", "info@elec-ouest.fr"]);
  });

  it("liens Contact et mentions légales du même site uniquement", () => {
    const html = `<a href="/contact">Nous contacter</a><a href="https://facebook.com/contact">FB</a><a href="/mentions-legales">Mentions légales</a><a href="/produits">Produits</a>`;
    expect(contactLinks(html, "https://www.elec-ouest.fr")).toEqual(["https://www.elec-ouest.fr/contact", "https://www.elec-ouest.fr/mentions-legales"]);
  });

  it("respecte robots.txt", () => {
    const robots = "User-agent: *\nDisallow: /contact\nAllow: /contact/public\n\nUser-agent: Googlebot\nDisallow: /";
    expect(robotsAllows(robots, "/")).toBe(true);
    expect(robotsAllows(robots, "/contact")).toBe(false);
    expect(robotsAllows(robots, "/contact/public")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /", "/")).toBe(false);
    expect(robotsAllows("User-agent: LinkProB2B\nDisallow: /", "/")).toBe(false);
    expect(robotsAllows("", "/contact")).toBe(true);
    // Le groupe qui nomme notre agent remplace celui de « * »
    const own = "User-agent: *\nDisallow: /\n\nUser-agent: LinkProB2B\nAllow: /";
    expect(robotsAllows(own, "/contact")).toBe(true);
    expect(robotsAllows("User-agent: Googlebot\nUser-agent: *\nDisallow: /contact", "/contact")).toBe(false);
  });

  it("robots.txt en erreur serveur (5xx) : aucune page explorée", async () => {
    let fetched = 0;
    const fetchImpl = (async (url: string | URL) => {
      if (String(url).endsWith("/robots.txt")) return new Response("indisponible", { status: 503, headers: { "content-type": "text/plain" } });
      fetched++;
      return new Response("<p>contact@orange.fr</p>", { headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    const r = await enrichCompany({ name: "Elec Ouest", city: "Brest", siren: null, website: null }, [async () => ({ website: "https://93.184.216.34", provider: "Test" })], fetchImpl);
    expect(r.status).toBe("BLOCKED");
    expect(fetched).toBe(0);
  });
});

describe("outreach — recherche complète (réseau simulé)", () => {
  const site = "https://93.184.216.34"; // adresse publique littérale (aucune résolution DNS en test)
  const page = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });
  const search = (website: string | null): WebsiteSearch => async () => ({ website, provider: "Test" });

  it("site trouvé → page Contact → adresse générique avec son origine", async () => {
    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/robots.txt")) return page("User-agent: *\nDisallow: /admin", 200);
      if (u.endsWith("/contact")) return page(`<p>Écrivez-nous : contact@orange.fr — Jean Dupont : jean.dupont@orange.fr</p>`);
      return page(`<a href="/contact">Contact</a>`);
    }) as typeof fetch;
    const r = await enrichCompany({ name: "Elec Ouest", city: "Brest", siren: null, website: null }, [search(site)], fetchImpl);
    expect(r).toMatchObject({ status: "FOUND", email: "contact@orange.fr", website: site });
    expect(r.source).toContain(`${site}/contact`);
  });

  it("robots.txt interdit : abandon, rien n'est lu", async () => {
    let fetched = 0;
    const fetchImpl = (async (url: string | URL) => {
      fetched++;
      return String(url).endsWith("/robots.txt") ? page("User-agent: *\nDisallow: /") : page("contact@orange.fr");
    }) as typeof fetch;
    const r = await enrichCompany({ name: "Elec Ouest", city: null, siren: null, website: site }, [], fetchImpl);
    expect(r.status).toBe("BLOCKED");
    expect(fetched).toBe(1);
  });

  it("site protégé (403) : abandon sans contournement", async () => {
    const fetchImpl = (async (url: string | URL) => (String(url).endsWith("/robots.txt") ? page("", 404) : page("", 403))) as typeof fetch;
    expect((await enrichCompany({ name: "X", city: null, siren: null, website: site }, [], fetchImpl)).status).toBe("BLOCKED");
  });

  it("adresse interne refusée (protection du réseau privé)", async () => {
    const fetchImpl = (async () => page("contact@orange.fr")) as typeof fetch;
    const r = await enrichCompany({ name: "X", city: null, siren: null, website: "http://127.0.0.1" }, [], fetchImpl);
    expect(r.email).toBeNull();
  });

  it("aucun site : NO_WEBSITE", async () => {
    expect((await enrichCompany({ name: "X", city: null, siren: null, website: null }, [search(null)])).status).toBe("NO_WEBSITE");
  });
});

describe("recherche gratuite du site officiel", () => {
  it("domaines déduits du nom (sans forme juridique)", async () => {
    const { domainCandidates } = await import("@/lib/outreach/enrich");
    expect(domainCandidates("OCR RHONE ALPES")).toEqual(["ocr-rhone-alpes.fr", "ocr-rhone-alpes.com", "ocrrhonealpes.fr", "ocrrhonealpes.com", "ocr-rhone.fr", "ocr-rhone.com", "ocrrhone.fr", "ocrrhone.com", "ocr-rhone-alpes.net", "ocr-rhone-alpes.eu", "ocr-rhone-alpes.bzh", "ocrrhonealpes.net", "ocrrhonealpes.eu", "ocrrhonealpes.bzh"]);
    expect(domainCandidates("SARL Électricité Dupont")).toEqual(["electricite-dupont.fr", "electricite-dupont.com", "electricitedupont.fr", "electricitedupont.com", "electricite-dupont.net", "electricite-dupont.eu", "electricite-dupont.bzh", "electricitedupont.net", "electricitedupont.eu", "electricitedupont.bzh"]);
    // Avec la ville : nom-ville.fr en plus
    expect(domainCandidates("Dupont Plomberie", "Brest")).toContain("dupont-plomberie-brest.fr");
    expect(domainCandidates("SAS")).toEqual([]);
    // Sans les articles : « Les Menuiseries du Léon » → menuiseries-leon.fr
    expect(domainCandidates("Les Menuiseries du Léon")).toContain("menuiseries-leon.fr");
    expect(domainCandidates("Les Menuiseries du Léon").length).toBeLessThanOrEqual(16);
  });

  it("autres noms : sigle, enseignes, nom commercial, nom entre parenthèses", async () => {
    const { altNames } = await import("@/lib/outreach/discovery");
    const names = altNames(
      { siren: "123456789", nom_complet: "SOCIETE BRETONNE DE MENUISERIE (SBM BOIS)", sigle: "SBM", siege: { liste_enseignes: ["MENUISERIE DU PORT"], nom_commercial: "Atelier Bois" } } as never,
      "SOCIETE BRETONNE DE MENUISERIE",
    );
    expect(names).toEqual(["SBM", "MENUISERIE DU PORT", "Atelier Bois", "SBM BOIS"]);
    expect(altNames({ siren: "1", nom_complet: "X", sigle: "x" } as never, "X")).toEqual([]);
  });

  it("adresse écrite en \\u0040 dans la page", async () => {
    const { extractEmails } = await import("@/lib/outreach/enrich");
    expect(extractEmails('<script>var m = "contact\\u0040menuiserie-leon.fr";</script>')).toContain("contact@menuiserie-leon.fr");
  });

  it("site retenu seulement si le SIREN y figure (même espacé)", async () => {
    const { sirenOnPage } = await import("@/lib/outreach/enrich");
    expect(sirenOnPage("<p>RCS Lyon 123 456 789</p>", "123456789")).toBe(true);
    expect(sirenOnPage("<p>SIRET : 12345678900012</p>", "123456789")).toBe(true);
    expect(sirenOnPage("<p>SIREN 987654321</p>", "123456789")).toBe(false);
    expect(sirenOnPage("<p>tél 0123456789</p>", "123456789")).toBe(false);
    // Numéro de TVA intracommunautaire
    expect(sirenOnPage("<p>TVA : FR 12 123 456 789</p>", "123456789")).toBe(true);
    expect(sirenOnPage("<p>TVA FR12123456789</p>", "123456789")).toBe(true);
  });

  it("aucun SIREN connu : aucune hypothèse de site", async () => {
    const { freeWebsiteSearch } = await import("@/lib/outreach/enrich");
    const fetchImpl = (() => Promise.reject(new Error("ne doit pas être appelé"))) as unknown as typeof fetch;
    expect(await freeWebsiteSearch(fetchImpl)({ name: "Dupont", city: null, siren: null })).toBeNull();
  });
});

describe("TED : avis au titre trop court", () => {
  it("titre complet, puis intitulé factuel (nature + acheteur) plutôt que de rejeter l'avis", async () => {
    const { mapTedNotice } = await import("@/lib/collect/connectors");
    const base = { "publication-number": "123-2026", "place-of-performance": ["FRK26"], "buyer-name": { fra: "Ville de Lyon" }, "contract-nature": ["services"] };
    const a = mapTedNotice({ ...base, "notice-title": { fra: "France – Services – Lot" } }, []);
    expect(a.ok && a.item.title).toBe("France – Services – Lot");
    const b = mapTedNotice({ ...base, "notice-title": { fra: "" } }, []);
    expect(b.ok && b.item.title).toBe("Avis de marché (services) — Ville de Lyon");
    expect(mapTedNotice({ "publication-number": "9-2026", "notice-title": { fra: "" } }, []).ok).toBe(false);
  });
});
