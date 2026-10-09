/**
 * Trafic : pages acheteurs publics (fonctions SQL), flux RSS des offres ouvertes,
 * message du jour prêt à publier. Données publiques et réelles uniquement (démo exclue).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, days, RUN } from "./helpers";
import { buyerSlug } from "@/lib/buyer-slug";
import { loadSocialPostFacts, renderSocialPost } from "@/lib/social-post";
import { GET as rss } from "@/app/flux/opportunites.xml/route";

const T = `IT ${RUN}`;
const BUYER = `Communauté d’agglomération de Saint-Étienne Œuvre ${RUN}`;
const LONG = `Syndicat intercommunal à vocation multiple pour l'aménagement et l'entretien des rivières et des berges ${RUN}`;
const CLOSED_ONLY = `Mairie de Lœuilly ${RUN}`;

beforeAll(async () => {
  const base = { type: "PUBLIC_TENDER" as const, origin: "EXTERNAL" as const, description: "Avis de marché de test suffisamment long.", city: "Brest", department_code: "29", region: "Bretagne", sector_slug: "travaux-btp", visibility: "PUBLIC" as "PUBLIC" | "MEMBERS_ONLY", is_demo: false };
  const { data, error } = await admin
    .from("opportunities")
    .insert([
      { ...base, title: `${T} Travaux de voirie <&>`, external_buyer_name: BUYER, status: "PUBLISHED", response_deadline: days(20), published_at: new Date().toISOString() },
      { ...base, title: `${T} Ancien marché clos`, external_buyer_name: BUYER, status: "EXPIRED", response_deadline: days(-10), published_at: days(-40) },
      { ...base, title: `${T} Entretien des berges`, external_buyer_name: LONG, status: "PUBLISHED", response_deadline: days(15), published_at: new Date().toISOString() },
      { ...base, title: `${T} Uniquement clos`, external_buyer_name: CLOSED_ONLY, status: "EXPIRED", response_deadline: days(-5), published_at: days(-30) },
      { ...base, title: `${T} Démo`, external_buyer_name: BUYER, status: "PUBLISHED", is_demo: true, response_deadline: days(20), published_at: new Date().toISOString() },
      { ...base, title: `${T} Réservée aux membres`, external_buyer_name: BUYER, status: "PUBLISHED", visibility: "MEMBERS_ONLY" as const, response_deadline: days(20), published_at: new Date().toISOString() },
    ])
    .select("id, title");
  if (error) throw error;
  const { data: boamp } = await admin.from("external_sources").select("id").eq("code", "boamp").single();
  const voirie = data.find((o) => o.title.includes("voirie"))!;
  const { error: srcError } = await admin.from("opportunity_sources").insert({ opportunity_id: voirie.id, source_id: boamp!.id, external_id: `it-${RUN}`, original_url: "https://www.boamp.fr/avis/detail/test", is_primary: true });
  if (srcError) throw srcError;
});

afterAll(cleanup);

describe("Pages acheteurs publics", () => {
  it("le lien calculé côté site correspond à celui de la base (accents, apostrophe typographique, noms longs)", async () => {
    for (const name of [BUYER, LONG, CLOSED_ONLY, "Ville d'Évry-Courcouronnes", "  CHU de Nîmes — Pôle « achats »  "]) {
      const { data } = await admin.rpc("buyer_slug", { p: name });
      expect(buyerSlug(name)).toBe(data);
    }
    expect(buyerSlug(BUYER)).toBe(`communaute-d-agglomeration-de-saint-etienne-oeuvre-${RUN.toLowerCase()}`);
    expect(buyerSlug(LONG)!.length).toBeLessThanOrEqual(80);
    expect(buyerSlug(LONG)).not.toMatch(/^-|-$/);
  });

  it("liste publique : uniquement les acheteurs avec une offre ouverte, réelle et publique", async () => {
    const { data, error } = await anon().rpc("public_buyers", { p_limit: 5000, p_offset: 0 });
    expect(error).toBeNull();
    const mine = (data ?? []).filter((b) => b.name.includes(RUN));
    expect(mine.map((b) => b.name).sort()).toEqual([BUYER, LONG].sort());
    const b = mine.find((x) => x.name === BUYER)!;
    // Démo et offre réservée aux membres non comptées ; l'offre close compte dans le total
    expect(b).toMatchObject({ slug: buyerSlug(BUYER), open_count: 1, total_count: 2, region: "Bretagne" });
  });

  it("offres d'un acheteur : ouvertes d'abord, puis passées ; rien de privé ni de fictif", async () => {
    const { data, error } = await anon().rpc("buyer_opportunities", { p_slug: buyerSlug(BUYER)!, p_limit: 100 });
    expect(error).toBeNull();
    expect(data!.map((o) => [o.title, o.is_open])).toEqual([
      [`${T} Travaux de voirie <&>`, true],
      [`${T} Ancien marché clos`, false],
    ]);
    expect(data![0].buyer_name).toBe(BUYER);
    expect((await anon().rpc("buyer_opportunities", { p_slug: "slug-inconnu-" + RUN.toLowerCase(), p_limit: 100 })).data).toEqual([]);
  });
});

describe("Flux RSS des offres", () => {
  it("offres ouvertes et publiques, source citée, contenu échappé", async () => {
    const res = await rss(new Request("http://localhost/flux/opportunites.xml?region=bretagne&secteur=travaux-btp"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain(`<title>${T} Travaux de voirie &lt;&amp;&gt;</title>`);
    expect(xml).toContain("Source : BOAMP");
    expect(xml).toContain(`Acheteur : ${BUYER.replace(/’/g, "’")}`);
    expect(xml).toContain(`${T} Entretien des berges`);
    for (const hidden of ["Ancien marché clos", "Uniquement clos", `${T} Démo`, "Réservée aux membres"]) expect(xml).not.toContain(hidden);
    expect(xml).toContain('rel="self"');
    expect(xml).toContain("region=bretagne");
  });

  it("filtre inconnu : 404 (pas de flux vide indexé)", async () => {
    expect((await rss(new Request("http://localhost/flux/opportunites.xml?region=atlantide"))).status).toBe(404);
    expect((await rss(new Request("http://localhost/flux/opportunites.xml?secteur=inconnu-xyz"))).status).toBe(404);
    expect((await rss(new Request("http://localhost/flux/opportunites.xml?secteur=%3Cscript%3E"))).status).toBe(404);
  });
});

describe("Message du jour prêt à publier", () => {
  it("compte les offres réelles publiées aujourd'hui (démo et privées exclues)", async () => {
    const f = await loadSocialPostFacts(admin);
    expect(f.period).toBe("today");
    // Nos 2 offres publiques du jour sont comptées, pas la démo ni la réservée aux membres
    const { count } = await admin
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .gte("published_at", new Date(Date.now() - 2 * 86_400_000).toISOString());
    expect(f.newCount).toBeGreaterThanOrEqual(2);
    expect(f.newCount).toBeLessThanOrEqual(count!);
    expect(f.regions.length).toBeGreaterThan(0);
    const text = renderSocialPost(f, "https://www.linkprob2b.com")!;
    expect(text).toContain("aujourd'hui en France sur LinkProB2B");
    expect(text).toContain("https://www.linkprob2b.com/opportunites");
    expect(text).not.toContain(`${T} Démo`);
  });
});
