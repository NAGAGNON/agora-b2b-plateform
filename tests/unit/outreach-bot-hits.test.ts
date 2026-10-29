import { describe, expect, it } from "vitest";
import { isAutomatedHit, isAutomatedVisit } from "@/lib/outreach/tracking";

const req = (ua: string | null, method = "GET") => new Request("https://www.linkprob2b.com/api/outreach/c/x", { method, headers: ua ? { "user-agent": ua } : {} });
const browser = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const now = Date.parse("2026-10-15T09:00:00Z");

describe("clics automatiques des messageries", () => {
  it("vérifications de liens (robots, HEAD, sans navigateur, quelques secondes après l'envoi) : non comptées", () => {
    expect(isAutomatedHit(req("Mozilla/5.0 (compatible; Proofpoint URL Defense)"), null, now)).toBe(true);
    expect(isAutomatedHit(req("python-requests/2.31"), null, now)).toBe(true);
    expect(isAutomatedHit(req(null), null, now)).toBe(true);
    expect(isAutomatedHit(req(browser, "HEAD"), null, now)).toBe(true);
    expect(isAutomatedHit(req(browser), new Date(now - 5_000).toISOString(), now)).toBe(true);
    // Antivirus des messageries avec un navigateur complet : 20 s à 2 min après l'envoi
    expect(isAutomatedHit(req(browser), new Date(now - 45_000).toISOString(), now)).toBe(true);
    expect(isAutomatedHit(req(browser), new Date(now - 110_000).toISOString(), now)).toBe(true);
    expect(isAutomatedVisit(new Headers({ "user-agent": browser }), new Date(now - 60_000).toISOString(), now)).toBe(true);
  });

  it("vrai visiteur (navigateur, après l'envoi) et proxy d'images de Gmail : comptés", () => {
    expect(isAutomatedHit(req(browser), new Date(now - 3_600_000).toISOString(), now)).toBe(false);
    expect(isAutomatedHit(req("Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)"), null, now)).toBe(false);
  });
});
