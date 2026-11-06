/**
 * Preuve sociale : les compteurs sont des totaux réels, et seules les entreprises affichées dans
 * l'annuaire public (choix de l'entreprise) apparaissent par leur nom.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, RUN, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

describe("compteurs et entreprises membres", () => {
  it("noms : uniquement l'annuaire public ; totaux : inscrits et entreprises", async () => {
    const u1 = await user("proof-public");
    const u2 = await user("proof-hidden");
    const visible = await company(u1.client, "Preuve Visible");
    const hidden = await company(u2.client, "Preuve Masquee");
    await admin.from("company_profiles").update({ is_public: true }).eq("company_id", visible);
    await admin.from("company_profiles").update({ is_public: false }).eq("company_id", hidden);
    // Les plus grandes entreprises d'abord : la visible est en tête de liste, même avec d'autres données de test
    await admin.from("companies").update({ size: "GE" }).in("id", [visible, hidden]);
    const { data: names } = await anon().rpc("public_member_companies", { p_limit: 24 });
    const list = (names ?? []).map((c) => c.name);
    expect(list).toContain(`IT ${RUN} Preuve Visible`);
    expect(list).not.toContain(`IT ${RUN} Preuve Masquee`);
    const { data: stats } = await anon().rpc("public_platform_stats");
    const s = stats as Record<string, number>;
    expect(s.registered_companies).toBeGreaterThanOrEqual(2);
    expect(s.members).toBeGreaterThanOrEqual(2);
    expect(s.members_7d).toBeGreaterThanOrEqual(2);
  });
});
