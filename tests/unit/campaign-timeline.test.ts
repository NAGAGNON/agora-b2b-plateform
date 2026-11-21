import { describe, expect, it } from "vitest";
import { campaignNextStep, campaignTimeline } from "@/lib/campaign-timeline";

describe("suivi d'une campagne, étape par étape", () => {
  const boost = { created_at: "2026-11-21T12:23:00Z", starts_at: "2026-11-21T12:23:01Z", ends_at: "2026-12-05T12:23:00Z", status: "ACTIVE" };

  it("création, démarrage, annonce à corriger avec le message, notification lue ou non, correction, validation", () => {
    const steps = campaignTimeline({
      boost,
      logs: [
        { action: "visibility.started_auto", created_at: "2026-11-21T12:23:01Z", metadata: { boost_id: "b" } },
        { action: "visibility.ad_rejected", created_at: "2026-11-21T13:10:00Z", metadata: { note: "Texte coupé.", auto: true } },
        { action: "visibility.ad_updated", created_at: "2026-11-22T09:00:00Z", metadata: null },
        { action: "visibility.ad_approved", created_at: "2026-11-22T10:00:00Z", metadata: { auto: true } },
      ],
      notifications: [{ created_at: "2026-11-21T13:10:01Z", read_at: null, type: "visibility_ad_rejected" }],
      firstPresentation: "2026-11-22T11:00:00Z",
      now: new Date("2026-11-23T00:00:00Z"),
    });
    expect(steps.map((s) => s.title)).toEqual([
      "Campagne créée par l'entreprise",
      "Campagne démarrée automatiquement",
      "Annonce à corriger : message envoyé à l'entreprise",
      "Notification « annonce à corriger » envoyée sur le site",
      "Annonce corrigée par l'entreprise, renvoyée en relecture",
      "Annonce validée : les présentations par e-mail peuvent partir",
      "Première présentation de l'entreprise",
      "Fin prévue de la campagne",
    ]);
    expect(steps[2].detail).toBe("Texte coupé.");
    expect(steps[3].detail).toBe("Pas encore lue");
  });

  it("prochaine étape en une phrase", () => {
    expect(campaignNextStep({ status: "ACTIVE", ad_status: "REJECTED", ad_title: "x" })).toContain("correction");
    expect(campaignNextStep({ status: "ACTIVE", ad_status: "APPROVED", ad_title: "x" })).toContain("validée");
    expect(campaignNextStep({ status: "CANCELLED", ad_status: "APPROVED", ad_title: "x" })).toContain("arrêtée");
  });
});
