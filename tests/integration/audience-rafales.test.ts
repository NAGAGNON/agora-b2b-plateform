import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin } from "./helpers";

// Robots des messageries : rafales de visites d'une seule page, sur ordinateur, dans la même minute (après l'envoi de la veille)
describe("audience : rafales de robots écartées", () => {
  it("écarte une rafale de visites d'une page, garde un vrai visiteur de la même minute et une visite seule", async () => {
    const minute = new Date(Date.now() - 3 * 3_600_000);
    minute.setUTCSeconds(0, 0);
    const at = (s: number) => new Date(minute.getTime() + s * 1000).toISOString();
    const bots = [randomUUID(), randomUUID(), randomUUID()];
    const human = randomUUID();
    const alone = randomUUID();
    const lone = new Date(minute.getTime() - 3_600_000).toISOString();
    const { error } = await admin.from("page_views").insert([
      ...bots.map((s, i) => ({ session_id: s, path: "/alertes/desabonnement", device: "desktop", duration_ms: 25_000, created_at: at(5 + i) })),
      { session_id: human, path: "/opportunites", device: "desktop", duration_ms: 40_000, created_at: at(10) },
      { session_id: human, path: "/inscription", device: "desktop", duration_ms: 30_000, created_at: at(50) },
      { session_id: alone, path: "/", device: "desktop", duration_ms: 20_000, created_at: lone },
    ]);
    expect(error).toBeNull();
    const { data } = await admin.from("page_views_human").select("session_id").in("session_id", [...bots, human, alone]);
    const kept = new Set((data ?? []).map((d) => d.session_id));
    expect(bots.some((b) => kept.has(b))).toBe(false);
    expect(kept.has(human)).toBe(true);
    expect(kept.has(alone)).toBe(true);
    await admin.from("page_views").delete().in("session_id", [...bots, human, alone]);
  });
});
