import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/daily-report-email", () => ({ reportRecipients: async () => [] }));
import { renderFounderInterestNotice } from "@/lib/signup-notify";

describe("e-mail « intéressé par le tarif fondateur »", () => {
  it("donne le nom, l'entreprise, la vague, le total et le lien vers l'activité", () => {
    const m = renderFounderInterestNotice({
      name: "Jeanne <Test>",
      email: "jeanne@exemple.fr",
      userId: "u1",
      company: "Nettoyage Martin",
      wave: 1,
      total: 3,
      signedUpAt: new Date("2026-11-10T09:00:00Z"),
      visitDays: 4,
      at: new Date("2026-11-20T13:00:00Z"),
    });
    expect(m.subject).toBe("Tarif fondateur : Jeanne <Test> est intéressé (3 au total)");
    expect(m.text).toContain("Entreprise : Nettoyage Martin");
    expect(m.text).toContain("Personnes sur la liste : 3");
    expect(m.text).toContain("/admin/activite/u1");
    expect(m.html).toContain("Jeanne &lt;Test&gt;");
    expect(m.html).not.toContain("<Test>");
  });
});
