import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const notify = vi.fn();
vi.mock("@/lib/signup-notify", () => ({ notifyAdminsOfNeedToReview: (...a: unknown[]) => notify(...a) }));
vi.mock("@/lib/needs", () => ({ runNeedCampaign: vi.fn() }));
vi.mock("@/lib/email/outbox", () => ({ processEmailOutbox: vi.fn() }));
vi.mock("@/lib/errors", () => ({ logServerError: vi.fn() }));
import Anthropic from "@anthropic-ai/sdk";
import { autoModerateNeed, reviewUnavailableReason } from "@/lib/auto-moderation";

const need = { id: "n1", title: "Rénovation de toiture", description: "x", type: "NEED", status: "PENDING_REVIEW", origin: "INTERNAL", sector_slug: "travaux-btp", city: "Nîmes", department_code: "30", budget_min: null, budget_max: null, company: [{ name: "GREEN MAINTENANCE" }] };

function fakeDb() {
  const inserts: unknown[] = [];
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: need });
    q.then = (r: (v: unknown) => unknown) => r({ data: table === "sectors" ? [] : null });
    q.insert = async (row: unknown) => {
      inserts.push({ table, row });
      return { error: null };
    };
    return q;
  };
  return { db: { from: chain } as never, inserts };
}

describe("relecture automatique indisponible", () => {
  it("crédit épuisé : besoin laissé à l'équipe et administrateurs prévenus", async () => {
    const { db, inserts } = fakeDb();
    const err = new Anthropic.APIError(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low" } }, "400 Your credit balance is too low to access the Anthropic API.", new Headers());
    const parse = vi.fn().mockRejectedValue(err);
    const r = await autoModerateNeed(db, "n1", { client: { beta: { messages: { parse } } } as never });
    expect(r.decision).toBe("MANUAL");
    expect(r.note).toBe("crédit du service de relecture épuisé");
    expect(inserts).toEqual([{ table: "audit_logs", row: expect.objectContaining({ action: "moderation.auto.manual", entity_id: "n1" }) }]);
    expect(notify).toHaveBeenCalledWith("n1", { title: "Rénovation de toiture", company: "GREEN MAINTENANCE", reason: "crédit du service de relecture épuisé" });
  });

  it("raisons lisibles", () => {
    expect(reviewUnavailableReason({ status: 401 })).toBe("accès au service de relecture refusé");
    expect(reviewUnavailableReason({ status: 529 })).toBe("service de relecture surchargé ou en panne");
    expect(reviewUnavailableReason({ status: 400, message: "bad" })).toBe("service de relecture indisponible");
  });
});
