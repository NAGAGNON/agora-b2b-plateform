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
    expect(isGenericCompanyEmail("jdupont@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("noreply@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("rgpd@elec-ouest.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("contact@autre-domaine.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("elec.ouest@orange.fr", "elec-ouest.fr")).toBe(false);
    expect(isGenericCompanyEmail("contact@orange.fr", "elec-ouest.fr")).toBe(true);
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
