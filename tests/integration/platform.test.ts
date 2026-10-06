/**
 * Fonctions de plateforme : alertes étendues, séparation démo / réel,
 * confidentialité des réponses côté administration, premier administrateur,
 * référentiel des secteurs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, days, user, RUN } from "./helpers";

type U = Awaited<ReturnType<typeof user>>;
let buyer: U, supplier: U, moderator: U, adminUser: U;
let buyerCo: string, supplierCo: string;
const ids: Record<string, string> = {};
const SECTOR = `it-${RUN.toLowerCase()}`;

async function opp(key: string, fields: Record<string, unknown>) {
  const { data, error } = await admin
    .from("opportunities")
    .insert({
      type: "QUOTE_REQUEST",
      status: "PUBLISHED",
      published_at: new Date().toISOString(),
      title: `IT ${RUN} ${key}`,
      description: "Opportunité de test d'intégration, maintenance hydraulique de pompes.",
      sector_slug: "maintenance-industrielle",
      response_deadline: days(20),
      company_id: buyerCo,
      ...fields,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  ids[key] = data.id;
}

beforeAll(async () => {
  [buyer, supplier, moderator, adminUser] = await Promise.all([user("pbuyer"), user("psupplier"), user("pmod", "MODERATOR"), user("padmin", "ADMIN")]);
  buyerCo = await company(buyer.client, "P Acheteur", "BUYER");
  supplierCo = await company(supplier.client, "P Fournisseur", "SUPPLIER");
  await opp("brest", { city: "Brest", skills: ["hydraulique"] });
  await opp("rennes", { city: "Rennes", skills: ["peinture"], sector_slug: "batiment-technique", description: "Opportunité de test d'intégration, travaux de peinture industrielle." });
  await opp("demo", { city: "Brest", skills: ["hydraulique"], is_demo: true });
  await opp("externe", { origin: "EXTERNAL", type: "PUBLIC_TENDER", company_id: null, city: "Brest", external_buyer_name: "Acheteur public IT", skills: ["hydraulique"] });
});

afterAll(async () => {
  await admin.from("sectors").delete().eq("slug", SECTOR);
  await cleanup();
});

describe("alertes étendues", () => {
  async function alert(fields: Record<string, unknown>) {
    const { data, error } = await supplier.client
      .from("alerts")
      .insert({ user_id: supplier.id, name: `IT ${RUN} alerte`, frequency: "DAILY", ...fields } as never)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
  const matches = async (alertId: string, key: string) => (await admin.rpc("opportunity_matches_alert", { p_opportunity_id: ids[key], p_alert_id: alertId })).data;

  it("filtre par ville et rayon", async () => {
    const a = await alert({ place_slug: "brest", radius_km: 30 });
    expect(await matches(a, "brest")).toBe(true);
    expect(await matches(a, "rennes")).toBe(false);
  });

  it("filtre par compétences", async () => {
    const a = await alert({ skills: ["hydraulique"] });
    expect(await matches(a, "brest")).toBe(true);
    expect(await matches(a, "rennes")).toBe(false);
  });

  it("exclut les opportunités externes sur demande", async () => {
    const withExt = await alert({ include_external: true });
    const withoutExt = await alert({ include_external: false });
    expect(await matches(withExt, "externe")).toBe(true);
    expect(await matches(withoutExt, "externe")).toBe(false);
    expect(await matches(withoutExt, "brest")).toBe(true);
  });

  it("n'alerte jamais sur une donnée de démonstration", async () => {
    const a = await alert({});
    expect(await matches(a, "demo")).toBe(false);
  });
});

describe("séparation démonstration / réel", () => {
  it("exclut la démo de la recherche d'opportunités quand demandé", async () => {
    const search = async (include: boolean) =>
      ((await anon().rpc("search_opportunities", { p_q: `IT ${RUN}`, p_limit: 50, p_include_demo: include })).data ?? []).map((r) => r.id);
    expect(await search(true)).toContain(ids.demo);
    const real = await search(false);
    expect(real).not.toContain(ids.demo);
    expect(real).toContain(ids.brest);
  });

  it("exclut les entreprises de démonstration de l'annuaire quand demandé", async () => {
    await admin.from("companies").update({ is_demo: true }).eq("id", supplierCo);
    const list = async (include: boolean) =>
      ((await anon().rpc("search_companies", { p_q: `IT ${RUN}`, p_limit: 50, p_include_demo: include })).data ?? []).map((r) => r.id);
    expect(await list(true)).toContain(supplierCo);
    expect(await list(false)).not.toContain(supplierCo);
    await admin.from("companies").update({ is_demo: false }).eq("id", supplierCo);
  });

  it("recommande sans démo quand demandé", async () => {
    const reco = async (include: boolean) =>
      ((await supplier.client.rpc("recommended_opportunities", { p_company_id: supplierCo, p_limit: 30, p_include_demo: include })).data ?? []).map((r) => r.id);
    expect(await reco(false)).not.toContain(ids.demo);
    const withReasons = (await supplier.client.rpc("recommended_opportunities", { p_company_id: supplierCo, p_limit: 30, p_include_demo: false })).data ?? [];
    const brest = withReasons.find((r) => r.id === ids.brest);
    expect(brest?.score).toBeGreaterThan(0);
    expect(brest?.reasons).toContain("Votre secteur");
  });
});

describe("réponses : confidentialité vis-à-vis de l'administration", () => {
  beforeAll(async () => {
    const { error } = await admin.from("proposals").insert({
      opportunity_id: ids.brest,
      company_id: supplierCo,
      submitted_by: supplier.id,
      message: "Réponse confidentielle de test, prix et conditions.",
      price_amount: 12345,
    });
    if (error) throw error;
  });

  it("donne au personnel les métadonnées, sans le contenu", async () => {
    const { data, error } = await moderator.client.rpc("admin_proposals_overview", { p_limit: 500 });
    expect(error).toBeNull();
    const row = data?.find((r) => r.opportunity_id === ids.brest);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty("message");
    expect(row).not.toHaveProperty("price_amount");
    const direct = await moderator.client.from("proposals").select("message").eq("opportunity_id", ids.brest);
    expect(direct.data ?? []).toHaveLength(0);
  });

  it("ne renvoie rien à un utilisateur ordinaire", async () => {
    const { data } = await buyer.client.rpc("admin_proposals_overview", { p_limit: 500 });
    expect(data ?? []).toHaveLength(0);
  });
});

describe("premier super-administrateur", () => {
  it("n'est pas appelable par un utilisateur", async () => {
    const { error } = await buyer.client.rpc("bootstrap_super_admin", { p_email: buyer.email });
    expect(error).not.toBeNull();
  });

  it("ne promeut que s'il n'existe aucun super-administrateur réel", async () => {
    const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("platform_role", "SUPER_ADMIN").eq("is_demo", false).eq("status", "ACTIVE");
    const first = await admin.rpc("bootstrap_super_admin", { p_email: buyer.email });
    expect(first.data).toBe((count ?? 0) === 0);
    const second = await admin.rpc("bootstrap_super_admin", { p_email: supplier.email });
    expect(second.data).toBe(false);
    await admin.from("users").update({ platform_role: "USER" }).eq("id", buyer.id);
  });
});

describe("référentiel des secteurs", () => {
  it("refuse l'écriture à un utilisateur ordinaire", async () => {
    const { error } = await buyer.client.from("sectors").insert({ slug: SECTOR, label: "Test" });
    expect(error).not.toBeNull();
  });

  it("permet à un administrateur d'ajouter puis de désactiver un secteur", async () => {
    expect((await adminUser.client.from("sectors").insert({ slug: SECTOR, label: "Secteur de test" })).error).toBeNull();
    expect((await adminUser.client.from("sectors").update({ is_active: false }).eq("slug", SECTOR)).error).toBeNull();
    const { data } = await anon().from("sectors").select("is_active").eq("slug", SECTOR).single();
    expect(data?.is_active).toBe(false);
  });
});
