/** Pipeline : rappel le jour de la relance prévue, une seule fois par date ; rien pour une opportunité gagnée. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, days, RUN, user } from "./helpers";

let owner: Awaited<ReturnType<typeof user>>;
let coId = "";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

beforeAll(async () => {
  owner = await user("relance");
  coId = await company(owner.client, "Relances pipeline");
  // Opportunités publiées par une autre entreprise (suivies dans le pipeline de coId)
  const buyer = await user("relance-acheteur");
  const buyerCo = await company(buyer.client, "Acheteur relances");
  const opp = async (label: string) => {
    const { data, error } = await admin
      .from("opportunities")
      .insert({
        company_id: buyerCo, type: "NEED", status: "PUBLISHED", title: `IT ${RUN} pipeline ${label}`,
        description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest",
        response_deadline: days(20), published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  const due = await opp("à relancer");
  const won = await opp("gagnée");
  const { error } = await admin.from("pipeline_items").insert([
    { company_id: coId, opportunity_id: due, stage: "DISCUSSION", next_action: "Rappeler l'acheteur", next_action_at: today },
    { company_id: coId, opportunity_id: won, stage: "WON", next_action: "Rien", next_action_at: today },
  ]);
  if (error) throw error;
});

afterAll(cleanup);

describe("rappels du pipeline", () => {
  it("un rappel le jour prévu, pas de doublon, rien pour une opportunité gagnée", async () => {
    expect((await admin.rpc("process_pipeline_reminders", { p_limit: 500 })).error).toBeNull();
    await admin.rpc("process_pipeline_reminders", { p_limit: 500 });
    const { data } = await admin.from("notifications").select("title").eq("user_id", owner.id).eq("type", "pipeline_due");
    expect(data?.map((n) => n.title)).toEqual(["Relance prévue aujourd'hui : Rappeler l'acheteur"]);
  });
});
