/** IndexNow : les nouvelles pages fixes du site sont signalées une fois, au premier envoi qui suit leur mise en ligne. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin } from "./helpers";

const { submitChangedUrls } = await import("@/lib/indexnow");
const { STATIC_PATHS } = await import("@/lib/seo");

const BASE = "https://www.exemple-indexnow.test";
let saved: unknown = null;
const sent: string[][] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
  saved = (await admin.from("platform_settings").select("value").eq("key", "private.indexnow").maybeSingle()).data?.value ?? null;
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("SITE_URL", BASE);
  vi.stubEnv("INDEXNOW_KEY", "cle-de-test-indexnow");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith("https://api.indexnow.org/")) {
      sent.push(JSON.parse(String(init?.body)).urlList);
      return new Response(null, { status: 202 });
    }
    return realFetch(input, init);
  });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (saved) await admin.from("platform_settings").upsert({ key: "private.indexnow", value: saved as never, description: "Dernier envoi IndexNow" });
  else await admin.from("platform_settings").delete().eq("key", "private.indexnow");
});

describe("IndexNow : pages fixes", () => {
  it("signale une page fixe ajoutée depuis le dernier envoi, puis ne la renvoie plus", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString(); // aucune annonce modifiée « depuis »
    const known = STATIC_PATHS.filter((p) => p !== "/ingenieurs-affaires");
    await admin.from("platform_settings").upsert({ key: "private.indexnow", value: { last_at: future, static_paths: known }, description: "Dernier envoi IndexNow" });

    const first = await submitChangedUrls();
    expect(first).toMatchObject({ submitted: 1, status: 202 });
    expect(sent.at(-1)).toEqual([`${BASE}/ingenieurs-affaires`]);
    const state = (await admin.from("platform_settings").select("value").eq("key", "private.indexnow").single()).data?.value as { static_paths: string[] };
    expect(state.static_paths).toContain("/ingenieurs-affaires");

    await admin.from("platform_settings").upsert({ key: "private.indexnow", value: { ...state, last_at: future }, description: "Dernier envoi IndexNow" });
    const calls = sent.length;
    expect(await submitChangedUrls()).toEqual({ submitted: 0 });
    expect(sent.length).toBe(calls);
  });
});
