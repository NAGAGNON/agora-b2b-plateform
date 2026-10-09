import { describe, expect, it } from "vitest";
import { buyerSlug } from "@/lib/buyer-slug";
import { renderRss } from "@/lib/rss";
import { renderSocialPost, type SocialPostFacts } from "@/lib/social-post";

describe("buyerSlug", () => {
  it("adresse lisible : accents, apostrophes, ligatures, espaces", () => {
    expect(buyerSlug("Ville d’Évry-Courcouronnes")).toBe("ville-d-evry-courcouronnes");
    expect(buyerSlug("  CHU de Nîmes — Pôle « achats »  ")).toBe("chu-de-nimes-pole-achats");
    expect(buyerSlug("Œuvre sociale de Lœuilly")).toBe("oeuvre-sociale-de-loeuilly");
  });
  it("80 caractères au plus, sans tiret au bord ; vide → null", () => {
    const s = buyerSlug(`${"Syndicat intercommunal ".repeat(6)}de la Vallée`)!;
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s).not.toMatch(/^-|-$/);
    expect(buyerSlug("  — ")).toBeNull();
    expect(buyerSlug(null)).toBeNull();
  });
});

describe("renderRss", () => {
  const xml = renderRss({
    base: "https://www.linkprob2b.com",
    title: "Flux & test",
    description: "Desc",
    selfPath: "/flux/opportunites.xml?region=bretagne&secteur=travaux-btp",
    now: new Date("2026-10-09T10:00:00Z"),
    items: [
      { id: "abc", title: "Travaux <voirie> & \"réseaux\"\u0001", summary: null, buyer: "Mairie d'Arles", place: "Arles (13)", sector: "Travaux BTP", deadline: "2026-11-12T12:00:00Z", publishedAt: "2026-10-09T08:00:00Z", source: "BOAMP" },
    ],
  });
  it("XML valide et échappé (aucune balise injectée, caractères interdits retirés)", () => {
    expect(xml).toContain("<title>Travaux &lt;voirie&gt; &amp; &quot;réseaux&quot;</title>");
    expect(xml).not.toContain("\u0001");
    expect(xml).toContain("<title>Flux &amp; test</title>");
    expect(xml).toContain('href="https://www.linkprob2b.com/flux/opportunites.xml?region=bretagne&amp;secteur=travaux-btp"');
    expect(xml).toContain('<guid isPermaLink="true">https://www.linkprob2b.com/opportunites/abc</guid>');
    expect(xml).toContain("<pubDate>Fri, 09 Oct 2026 08:00:00 GMT</pubDate>");
  });
  it("chaque offre cite son acheteur, sa date limite et sa source", () => {
    expect(xml).toContain("Acheteur : Mairie d&apos;Arles");
    expect(xml).toContain("Date limite de réponse : 12 novembre 2026");
    expect(xml).toContain("Source : BOAMP");
  });
});

describe("renderSocialPost", () => {
  const facts: SocialPostFacts = {
    period: "today",
    newCount: 12,
    openTotal: 1234,
    sectors: [{ label: "Travaux BTP", n: 5 }, { label: "Informatique", n: 3 }],
    regions: [{ label: "Bretagne", n: 4 }],
    highlight: { title: "Réfection de toiture", buyer: "Mairie de Brest", deadline: "2026-11-12T12:00:00Z" },
  };
  it("uniquement les chiffres réels fournis", () => {
    const t = renderSocialPost(facts, "https://www.linkprob2b.com")!;
    expect(t).toContain("12 nouvelles opportunités B2B publiées aujourd'hui");
    expect(t).toContain("• Travaux BTP : 5");
    expect(t).toContain("• Bretagne : 4");
    expect(t).toContain("À la une : « Réfection de toiture » (Mairie de Brest), réponse avant le 12 novembre.");
    expect(t).toContain("1 234 opportunités sont ouvertes");
    expect(t).toContain("https://www.linkprob2b.com/opportunites");
    const numbers = (t.replace(/https?:\/\/\S+/g, "").replace(/B2B/g, "").replace(/(\d) (\d)/g, "$1$2").match(/\d+/g) ?? []).map(Number);
    expect(numbers.every((n) => [12, 5, 3, 4, 1234].includes(n))).toBe(true);
  });
  it("semaine au singulier ; aucune offre → pas de message", () => {
    const t = renderSocialPost({ ...facts, period: "week", newCount: 1, openTotal: 1, sectors: [], regions: [], highlight: null })!;
    expect(t).toContain("1 nouvelle opportunité B2B publiée ces 7 derniers jours");
    expect(t).toContain("1 opportunité est ouverte");
    expect(renderSocialPost({ ...facts, newCount: 0 })).toBeNull();
  });
});
