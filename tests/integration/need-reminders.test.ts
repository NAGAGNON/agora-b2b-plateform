/**
 * Rappels aux demandeurs : besoin sans réponse après 3 jours et date limite dans moins de 48 h,
 * un seul envoi par besoin et par type.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, days, RUN, user } from "./helpers";

let owner: Awaited<ReturnType<typeof user>>;
let coId = "";
const ids: Record<string, string> = {};

async function need(label: string, fields: { published_at: string; response_deadline: string }) {
  const { data, error } = await admin
    .from("opportunities")
    .insert({
      company_id: coId, type: "NEED", status: "PUBLISHED", title: `IT ${RUN} rappel ${label}`,
      description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest", ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  owner = await user("rappel");
  coId = await company(owner.client, "Rappels besoins");
  ids.silent = await need("sans réponse", { published_at: days(-4), response_deadline: days(20) });
  ids.fresh = await need("récent", { published_at: days(-1), response_deadline: days(20) });
  ids.soon = await need("échéance", { published_at: days(-1), response_deadline: days(1) });
});

afterAll(cleanup);

const notes = async (type: string) =>
  (await admin.from("notifications").select("link").eq("user_id", owner.id).eq("type", type)).data?.map((n) => n.link) ?? [];

describe("rappels des besoins", () => {
  it("envoie chaque rappel une seule fois, uniquement aux besoins concernés", async () => {
    expect((await admin.rpc("process_need_reminders", { p_limit: 500 })).error).toBeNull();
    expect(await notes("need_no_response")).toEqual([`/dashboard/opportunites/${ids.silent}`]);
    expect(await notes("need_deadline_soon")).toEqual([`/dashboard/opportunites/${ids.soon}?onglet=comparer`]);
    const { data: mails } = await admin.from("email_outbox").select("subject").eq("user_id", owner.id).in("payload->>type", ["need_no_response", "need_deadline_soon"]);
    expect(mails?.length).toBe(2);
    // Second passage : rien de plus
    await admin.rpc("process_need_reminders", { p_limit: 500 });
    expect((await notes("need_no_response")).length).toBe(1);
    expect((await notes("need_deadline_soon")).length).toBe(1);
  });

  it("table des rappels inaccessible aux utilisateurs", async () => {
    const { data } = await owner.client.from("need_reminders").select("opportunity_id");
    expect(data ?? []).toEqual([]);
  });
});
