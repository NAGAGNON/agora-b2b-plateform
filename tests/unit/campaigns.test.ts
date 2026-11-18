import { describe, expect, it } from "vitest";
import { DAILY_OPTIONS, DURATION_OPTIONS, FEATURED_OPTIONS, FORMULAS, adIssues, boostPrice, campaignEstimate } from "@/lib/visibility";
import { WHOP_VISIBILITY_PLANS } from "@/lib/billing/whop";
import { renderCompanyPresentationEmail } from "@/lib/outreach/email";

describe("campagnes de visibilité", () => {
  it("les 3 formules sont des choix valides et gardent les prix annoncés (21, 42, 210 € HT)", () => {
    for (const f of FORMULAS) {
      expect(DAILY_OPTIONS).toContain(f.daily);
      expect(DURATION_OPTIONS).toContain(f.duration);
      expect(FEATURED_OPTIONS).toContain(f.featured);
      expect(WHOP_VISIBILITY_PLANS[f.key as keyof typeof WHOP_VISIBILITY_PLANS]).toMatch(/^plan_/);
    }
    expect(FORMULAS.map((f) => boostPrice(f.daily, f.featured, f.duration))).toEqual([21, 42, 210]);
  });

  it("annonce : pas de lien, de coordonnées, de majuscules ni de promesse invérifiable", () => {
    const ok = { title: "Maintenance de chaudières à Brest", points: ["Intervention sous 48 h", "Certifié RGE"], text: "Entreprise familiale depuis 2009." };
    expect(adIssues(ok)).toEqual([]);
    expect(adIssues({ ...ok, text: "Voir www.exemple.fr" })).toHaveLength(1);
    expect(adIssues({ ...ok, text: "Appelez le 06 12 34 56 78" })).toHaveLength(1);
    expect(adIssues({ ...ok, text: "contact@exemple.fr" }).join(" ")).toMatch(/adresse e-mail/);
    expect(adIssues({ ...ok, title: "LE MEILLEUR SERVICE DE TOUTE LA RÉGION" })).not.toEqual([]);
    expect(adIssues({ ...ok, points: ["Résultat garanti"] })).toHaveLength(1);
  });

  it("estimation : fourchette tirée des taux réels, rien sans données", () => {
    expect(campaignEstimate(140, null)).toBeNull();
    const e = campaignEstimate(140, { open: 0.49, click: 0.07 })!;
    expect(e.opens.low).toBeLessThanOrEqual(69);
    expect(e.opens.high).toBeGreaterThanOrEqual(69);
    expect(e.visits.low).toBeLessThanOrEqual(10);
    expect(e.visits.high).toBeGreaterThanOrEqual(10);
  });

  it("l'e-mail montre l'annonce validée (titre et points forts)", () => {
    const mail = renderCompanyPresentationEmail({
      companyName: "Acheteur SAS",
      subject: "Chauffage Breizh souhaite se présenter",
      presented: { name: "Chauffage Breizh", tagline: null, city: "Brest", activities: [], description: "Entreprise familiale.", url: "https://www.linkprob2b.com/entreprises/x", sectorSlug: null, headline: "Maintenance de chaudières à Brest", points: ["Intervention sous 48 h"] },
      unsubscribeUrl: "https://www.linkprob2b.com/u",
      siteUrl: "https://www.linkprob2b.com",
      reason: "r",
      dataSource: "d",
      sender: [],
    });
    expect(mail.html).toContain("Maintenance de chaudières à Brest");
    expect(mail.html).toContain("Intervention sous 48 h");
    expect(mail.text).toContain("- Intervention sous 48 h");
  });
});

describe("aide à la rédaction de l'annonce", () => {
  const fake = (text: string) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } }) as never;
  it("reprend la version proposée quand elle respecte les règles", async () => {
    const { improveAd } = await import("@/lib/campaign-ad-writer");
    const out = await improveAd({ title: "maintenance", points: [], text: "on fait de la maintenance de compresseurs" }, { company: "X", city: null, objective: "Trouver des clients" }, fake('{"title":"Maintenance de compresseurs","points":["Dépannage sur site"],"text":"Nous assurons la maintenance de vos compresseurs."}'));
    expect(out).toEqual({ title: "Maintenance de compresseurs", points: ["Dépannage sur site"], text: "Nous assurons la maintenance de vos compresseurs." });
  });
  it("refuse une version qui ajoute un lien ou une promesse", async () => {
    const { improveAd } = await import("@/lib/campaign-ad-writer");
    expect(await improveAd({ title: "Maintenance", points: [], text: "Compresseurs" }, { company: "X", city: null, objective: "" }, fake('{"title":"Maintenance garanti","points":[],"text":"Voir www.x.fr"}'))).toBeNull();
    expect(await improveAd({ title: "Maintenance", points: [], text: "Compresseurs" }, { company: "X", city: null, objective: "" }, fake("pas du json"))).toBeNull();
  });
});
