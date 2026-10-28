/**
 * Besoins en pause : le demandeur masque temporairement un besoin publié puis le reprend
 * sans nouvelle validation ; un besoin modifié pendant la pause repasse en validation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, days, RUN, user } from "./helpers";

let owner: Awaited<ReturnType<typeof user>>;
let coId = "";
let needId = "";

beforeAll(async () => {
  owner = await user("pause");
  coId = await company(owner.client, "Besoin en pause");
  const { data, error } = await admin
    .from("opportunities")
    .insert({
      company_id: coId, type: "NEED", status: "PUBLISHED", title: `IT ${RUN} besoin à mettre en pause`,
      description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest",
      response_deadline: days(20), published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  needId = data.id;
});

afterAll(cleanup);

const visible = async () => (await anon().from("opportunities").select("id").eq("id", needId).maybeSingle()).data?.id === needId;
const status = async () => (await admin.from("opportunities").select("status").eq("id", needId).single()).data?.status;

describe("besoin en pause", () => {
  it("publié → en pause : masqué au public", async () => {
    expect(await visible()).toBe(true);
    expect((await owner.client.from("opportunities").update({ status: "PAUSED" }).eq("id", needId)).error).toBeNull();
    expect(await status()).toBe("PAUSED");
    expect(await visible()).toBe(false);
  });

  it("reprise sans modification : republié directement", async () => {
    expect((await owner.client.from("opportunities").update({ status: "PUBLISHED" }).eq("id", needId)).error).toBeNull();
    expect(await status()).toBe("PUBLISHED");
    expect(await visible()).toBe(true);
  });

  it("modifié pendant la pause : repasse en validation", async () => {
    await owner.client.from("opportunities").update({ status: "PAUSED" }).eq("id", needId);
    expect((await owner.client.from("opportunities").update({ title: `IT ${RUN} besoin modifié pendant la pause` }).eq("id", needId)).error).toBeNull();
    expect(await status()).toBe("PENDING_REVIEW");
  });

  it("un autre utilisateur ne peut pas mettre le besoin en pause", async () => {
    const other = await user("pause-autre");
    await admin.from("opportunities").update({ status: "PUBLISHED" }).eq("id", needId);
    await other.client.from("opportunities").update({ status: "PAUSED" }).eq("id", needId);
    expect(await status()).toBe("PUBLISHED");
  });
});
