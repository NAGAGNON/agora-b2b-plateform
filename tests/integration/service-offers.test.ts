/** Disponibilités : règles d'accès, contact par la messagerie, recatégorisation d'un besoin qui présente des services. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, RUN, user } from "./helpers";

type Client = Awaited<ReturnType<typeof user>>["client"];
let seller: Client;
let buyer: Client;
let sellerCompany: string;
let buyerCompany: string;
let offerId: string;

beforeAll(async () => {
  const a = await user("dispo-a");
  const b = await user("dispo-b");
  seller = a.client;
  buyer = b.client;
  sellerCompany = await company(seller, "Dispo vendeur");
  buyerCompany = await company(buyer, "Dispo acheteur");
  const { data, error } = await seller
    .from("service_offers")
    .insert({ company_id: sellerCompany, title: `IT ${RUN} Équipe de maintenance disponible`, description: "Maintenance préventive et dépannage hydraulique, deux techniciens.", department_code: "29" })
    .select("id, status, expires_at")
    .single();
  if (error) throw error;
  offerId = data.id;
});

afterAll(async () => {
  await cleanup();
});

describe("disponibilités", () => {
  it("publiée tout de suite, visible sans compte, en ligne 60 jours", async () => {
    const { data } = await anon().from("service_offers").select("id, status, expires_at").eq("id", offerId).single();
    expect(data?.status).toBe("PUBLISHED");
    const days = (new Date(data!.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(59);
    expect(days).toBeLessThan(61);
  });

  it("une autre entreprise ne peut ni modifier ni publier au nom de l'entreprise", async () => {
    const { data: updated } = await buyer.from("service_offers").update({ title: "Piraté" }).eq("id", offerId).select("id");
    expect(updated ?? []).toHaveLength(0);
    const { error } = await buyer.from("service_offers").insert({ company_id: sellerCompany, title: "Usurpation de titre", description: "Texte publié au nom d'une autre entreprise." });
    expect(error).not.toBeNull();
  });

  it("l'entreprise ne peut pas se retirer elle-même « par la modération »", async () => {
    const { error } = await seller.from("service_offers").update({ status: "REMOVED" }).eq("id", offerId);
    expect(error?.message).toMatch(/non autorisée/);
  });

  it("contacter : une conversation liée à la disponibilité, réutilisée ensuite", async () => {
    const { data: conv, error } = await buyer.rpc("contact_service_offer", { p_offer_id: offerId, p_company_id: buyerCompany, p_body: "Bonjour, pouvez-vous intervenir à Brest en décembre ?" });
    expect(error).toBeNull();
    const { data: again } = await buyer.rpc("contact_service_offer", { p_offer_id: offerId, p_company_id: buyerCompany, p_body: "Deuxième message pour la même disponibilité." });
    expect(again).toBe(conv);
    const { data: seen } = await seller.from("conversations").select("id, service_offer_id, opportunity_id").eq("id", conv!).single();
    expect(seen?.service_offer_id).toBe(offerId);
    expect(seen?.opportunity_id).toBeNull();
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv!);
    expect(count).toBe(2);
    // Sa propre disponibilité : refusé
    const { error: own } = await seller.rpc("contact_service_offer", { p_offer_id: offerId, p_company_id: sellerCompany, p_body: "Message à ma propre entreprise." });
    expect(own).not.toBeNull();
  });

  it("un besoin qui présente des services est recatégorisé : texte repris, besoin archivé, rien supprimé", async () => {
    const { data: need, error } = await seller
      .from("opportunities")
      .insert({ type: "NEED", status: "PENDING_REVIEW", visibility: "PUBLIC", title: `IT ${RUN} Nous proposons nos services de nettoyage`, description: "Entreprise de nettoyage, nous cherchons des chantiers et des marchés.", company_id: sellerCompany, department_code: "29" })
      .select("id")
      .single();
    if (error) throw error;
    const { data: offer, error: e2 } = await admin.rpc("convert_need_to_service_offer", { p_opportunity_id: need.id });
    expect(e2).toBeNull();
    const { data: o } = await admin.from("opportunities").select("status, moderation_note").eq("id", need.id).single();
    expect(o?.status).toBe("ARCHIVED");
    const { data: s } = await admin.from("service_offers").select("title, description, status, from_opportunity_id, company_id").eq("id", offer!).single();
    expect(s).toMatchObject({ status: "PUBLISHED", from_opportunity_id: need.id, company_id: sellerCompany, title: `IT ${RUN} Nous proposons nos services de nettoyage` });
    // Deuxième appel : la même disponibilité, pas de doublon
    const { data: again } = await admin.rpc("convert_need_to_service_offer", { p_opportunity_id: need.id });
    expect(again).toBe(offer);
    // Réservé à l'équipe (tâches automatiques)
    const { error: denied } = await seller.rpc("convert_need_to_service_offer", { p_opportunity_id: need.id });
    expect(denied).not.toBeNull();
  });
});
