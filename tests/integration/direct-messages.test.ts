/** Messagerie directe depuis l'annuaire : une conversation par paire d'entreprises, règles vérifiées en base. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, user } from "./helpers";

type Client = Awaited<ReturnType<typeof user>>["client"];
let a: Client;
let b: Client;
let outsider: Client;
let companyA: string;
let companyB: string;
let hiddenCompany: string;

beforeAll(async () => {
  a = (await user("direct-a")).client;
  b = (await user("direct-b")).client;
  outsider = (await user("direct-c")).client;
  companyA = await company(a, "Direct A");
  companyB = await company(b, "Direct B");
  hiddenCompany = await company(outsider, "Direct cachée");
  await admin.from("company_profiles").update({ is_public: false }).eq("company_id", hiddenCompany);
});

afterAll(async () => {
  await cleanup();
});

describe("messagerie directe entre entreprises", () => {
  it("A écrit à B : conversation directe, message reçu, B notifiée", async () => {
    const { data: conv, error } = await a.rpc("contact_company", { p_target_company_id: companyB, p_company_id: companyA, p_body: "Bonjour, nous cherchons un partenaire en hydraulique." });
    expect(error).toBeNull();
    const { data: seen } = await b.from("conversations").select("id, direct, opportunity_id, service_offer_id").eq("id", conv!).single();
    expect(seen).toMatchObject({ direct: true, opportunity_id: null, service_offer_id: null });
    const { data: msgs } = await b.from("messages").select("body, sender_company_id").eq("conversation_id", conv!);
    expect(msgs).toHaveLength(1);
    expect(msgs![0].sender_company_id).toBe(companyA);
  });

  it("une seule conversation par paire, dans un sens comme dans l'autre", async () => {
    const { data: first } = await a.rpc("contact_company", { p_target_company_id: companyB, p_company_id: companyA, p_body: "Deuxième message de A vers B." });
    const { data: back } = await b.rpc("contact_company", { p_target_company_id: companyA, p_company_id: companyB, p_body: "Réponse de B en partant de la fiche de A." });
    expect(back).toBe(first);
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", first!);
    expect(count).toBe(3);
  });

  it("refusé : écrire au nom d'une autre entreprise, à soi-même, à une entreprise cachée, message trop court", async () => {
    const spoof = await outsider.rpc("contact_company", { p_target_company_id: companyB, p_company_id: companyA, p_body: "Usurpation de l'entreprise A." });
    expect(spoof.error?.message).toMatch(/non autorisée/);
    const self = await a.rpc("contact_company", { p_target_company_id: companyA, p_company_id: companyA, p_body: "Message à moi-même." });
    expect(self.error?.message).toMatch(/propre entreprise/);
    const hidden = await a.rpc("contact_company", { p_target_company_id: hiddenCompany, p_company_id: companyA, p_body: "Bonjour, entreprise non publiée." });
    expect(hidden.error?.message).toMatch(/introuvable/);
    const short = await a.rpc("contact_company", { p_target_company_id: companyB, p_company_id: companyA, p_body: "Salut" });
    expect(short.error?.message).toMatch(/trop court/);
  });

  it("une entreprise extérieure ne voit pas la conversation", async () => {
    const { data } = await outsider.from("conversations").select("id").eq("direct", true);
    expect(data ?? []).toHaveLength(0);
  });
});
