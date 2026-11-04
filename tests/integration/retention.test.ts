/**
 * Fidélisation : rappels de date limite (favori, 7 puis 2 jours avant, une fois chacun),
 * jours de visite et « visite précédente ».
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, RUN, user } from "./helpers";

afterAll(async () => {
  await cleanup();
});

const DAY = 86_400_000;
const offer = (title: string, inDays: number) =>
  admin
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `IT ${RUN} ${title}`, description: "Avis de test pour les rappels de date limite.", sector_slug: "travaux-btp", department_code: "29", region: "Bretagne", response_deadline: new Date(Date.now() + inDays * DAY).toISOString(), published_at: new Date().toISOString() })
    .select("id")
    .single();

describe("Rappels de date limite", () => {
  it("favori à 5 jours : un rappel ; à 1 jour : dernier rappel ; jamais deux fois", async () => {
    const u = await user("deadline");
    const soon = (await offer("Rappel 5 jours", 5)).data!;
    const last = (await offer("Rappel 1 jour", 1)).data!;
    const far = (await offer("Rappel 30 jours", 30)).data!;
    for (const o of [soon, last, far]) expect((await admin.from("favorites").insert({ user_id: u.id, opportunity_id: o.id })).error).toBeNull();

    expect((await admin.rpc("process_deadline_reminders", { p_limit: 1000 })).error).toBeNull();
    const { data: notes } = await admin.from("notifications").select("title, link").eq("user_id", u.id).eq("type", "deadline_soon").order("title");
    expect(notes).toHaveLength(2);
    expect(notes!.find((n) => n.link === `/opportunites/${last.id}`)?.title).toMatch(/^Dernier rappel : date limite dans moins de 48 h/);
    expect(notes!.find((n) => n.link === `/opportunites/${soon.id}`)?.title).toMatch(/^Date limite dans 5 jours/);

    await admin.rpc("process_deadline_reminders", { p_limit: 1000 });
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("type", "deadline_soon");
    expect(count).toBe(2);
  });
});

describe("Visites", () => {
  it("enregistre le jour de visite et garde la visite précédente après 30 minutes", async () => {
    const u = await user("visits");
    const old = new Date(Date.now() - 3 * DAY).toISOString();
    await admin.from("users").update({ last_seen_at: old }).eq("id", u.id);
    expect((await u.client.rpc("touch_visit")).error).toBeNull();
    const { data } = await admin.from("users").select("last_seen_at, previous_visit_at").eq("id", u.id).single();
    expect(new Date(data!.previous_visit_at!).getTime()).toBe(new Date(old).getTime());
    expect(Date.now() - new Date(data!.last_seen_at!).getTime()).toBeLessThan(60_000);
    const { count } = await admin.from("user_visits").select("day", { count: "exact", head: true }).eq("user_id", u.id);
    expect(count).toBeGreaterThanOrEqual(1);
    const { data: rr, error } = await admin.rpc("return_rates");
    expect(error).toBeNull();
    expect(rr).toHaveProperty("returned7");
  });
});
