/** Fiche de candidature : notes par étape et collègues ajoutés au suivi du dossier. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RUN, admin, cleanup, company, user } from "./helpers";

type U = Awaited<ReturnType<typeof user>>;
let a: U;
let b: U;
let outsider: U;
let companyA: string;
let opp: string;

beforeAll(async () => {
  a = await user("team-a");
  b = await user("team-b");
  outsider = await user("team-c");
  companyA = await company(a.client, "Equipe A");
  await company(outsider.client, "Equipe C");
  await admin.from("company_members").insert({ company_id: companyA, user_id: b.id });
  const { data, error } = await admin
    .from("opportunities")
    .insert({
      type: "EXTERNAL_OPPORTUNITY", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", is_demo: false,
      title: `IT ${RUN} Nettoyage des locaux`, summary: "Nettoyage des locaux.", description: "Marché de nettoyage des locaux administratifs de la commune.",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  opp = data.id;
});

afterAll(async () => {
  await cleanup();
});

describe("notes par étape", () => {
  it("une note rattachée à l'étape 1 est visible par un collègue ; étape hors parcours refusée", async () => {
    const { error } = await a.client.from("application_journal").insert({ company_id: companyA, opportunity_id: opp, user_id: a.id, kind: "NOTE", body: "Attestation demandée à l'assureur", step: 0 });
    expect(error).toBeNull();
    const { data } = await b.client.from("application_journal").select("body, step").eq("opportunity_id", opp);
    expect(data).toEqual([{ body: "Attestation demandée à l'assureur", step: 0 }]);
    const bad = await a.client.from("application_journal").insert({ company_id: companyA, opportunity_id: opp, user_id: a.id, kind: "NOTE", body: "Étape inconnue", step: 9 });
    expect(bad.error).not.toBeNull();
    const { data: none } = await outsider.client.from("application_journal").select("id").eq("opportunity_id", opp);
    expect(none ?? []).toHaveLength(0);
  });
});

describe("équipe sur le dossier", () => {
  it("A ajoute B au suivi : B le voit et reçoit une notification", async () => {
    const { data, error } = await a.client.rpc("add_application_follower", { p_company_id: companyA, p_opportunity_id: opp, p_user_id: b.id });
    expect(error).toBeNull();
    expect(data).toBe(true);
    const again = await a.client.rpc("add_application_follower", { p_company_id: companyA, p_opportunity_id: opp, p_user_id: b.id });
    expect(again.data).toBe(false);
    const { data: seen } = await b.client.from("application_followers").select("user_id").eq("opportunity_id", opp);
    expect(seen).toEqual([{ user_id: b.id }]);
    const { data: notif } = await admin.from("notifications").select("type, link").eq("user_id", b.id);
    expect(notif).toEqual([{ type: "application_follower", link: `/dashboard/candidatures/${opp}` }]);
  });

  it("refusé : ajouter une personne hors de l'équipe, ou agir pour une autre entreprise", async () => {
    const stranger = await a.client.rpc("add_application_follower", { p_company_id: companyA, p_opportunity_id: opp, p_user_id: outsider.id });
    expect(stranger.error?.message).toMatch(/ne fait pas partie de votre équipe/);
    const spoof = await outsider.client.rpc("add_application_follower", { p_company_id: companyA, p_opportunity_id: opp, p_user_id: outsider.id });
    expect(spoof.error?.message).toMatch(/non autorisée/);
    const { data } = await outsider.client.from("application_followers").select("user_id").eq("opportunity_id", opp);
    expect(data ?? []).toHaveLength(0);
  });

  it("retirer un collègue du suivi", async () => {
    const { error } = await a.client.rpc("remove_application_follower", { p_company_id: companyA, p_opportunity_id: opp, p_user_id: b.id });
    expect(error).toBeNull();
    const { count } = await admin.from("application_followers").select("user_id", { count: "exact", head: true }).eq("opportunity_id", opp);
    expect(count).toBe(0);
  });
});
