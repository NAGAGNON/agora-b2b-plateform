/** Alertes par e-mail sans compte : double confirmation, sélection hebdomadaire, désinscription, comptages métier × département. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, days, RUN } from "./helpers";
import { confirmLead, LEAD_DIGEST_INTERVAL_MS, processLeadDigests, subscribeLead, unsubscribeLead } from "@/lib/alert-leads";

const EMAIL = `lead-${RUN}@example.test`;
const SECTOR = "electricite-automatisme";
const DEP = "29";
let oppId: string;

const lead = async () => (await admin.from("alert_leads").select("*").eq("email", EMAIL).eq("sector_slug", SECTOR).eq("department_code", DEP).single()).data!;
const outbox = async (template: string) => (await admin.from("email_outbox").select("subject, payload").eq("to_email", EMAIL).eq("template", template)).data ?? [];

beforeAll(async () => {
  const { data, error } = await admin
    .from("opportunities")
    .insert({
      type: "PUBLIC_TENDER",
      origin: "EXTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      title: `IT ${RUN} Rénovation de l'éclairage du gymnase`,
      description: "Remplacement de l'éclairage et des tableaux électriques.",
      sector_slug: SECTOR,
      department_code: DEP,
      region: "Bretagne",
      response_deadline: days(20),
      published_at: new Date().toISOString(),
      external_buyer_name: `Commune IT ${RUN}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  oppId = data.id;
});

afterAll(async () => {
  await admin.from("alert_leads").delete().eq("email", EMAIL);
  await admin.from("email_outbox").delete().eq("to_email", EMAIL);
  await cleanup();
});

describe("alertes par e-mail sans compte", () => {
  it("inscription : en attente de confirmation, e-mail de confirmation en file, aucune sélection avant confirmation", async () => {
    const r = await subscribeLead({ email: EMAIL.toUpperCase(), criteria: { sector: SECTOR, department: DEP, region: "Bretagne" }, opportunityId: oppId, path: `/opportunites/${oppId}`, criteriaLabel: "Électricité — Finistère (29)" });
    expect(r.state).toBe("sent");
    const l = await lead();
    expect(l.status).toBe("PENDING");
    expect(l.email).toBe(EMAIL);
    expect(l.consent_text).toContain("Désinscription en un clic");
    const mails = await outbox("lead_confirm");
    expect(mails).toHaveLength(1);
    expect((mails[0].payload as { link: string }).link).toBe(`/alertes/confirmer?jeton=${l.token}`);
    // Pas de sélection pour une adresse non confirmée
    await processLeadDigests({ now: Date.now() + 10 * 86_400_000 });
    expect(await outbox("lead_digest")).toHaveLength(0);
  });

  it("nouvelle demande immédiate : pas de second e-mail de confirmation", async () => {
    const r = await subscribeLead({ email: EMAIL, criteria: { sector: SECTOR, department: DEP, region: "Bretagne" }, criteriaLabel: "x" });
    expect(r.state).toBe("pending");
    expect(await outbox("lead_confirm")).toHaveLength(1);
  });

  it("confirmation par le lien, puis sélection hebdomadaire avec les nouveaux marchés et un lien de désinscription", async () => {
    const l = await lead();
    const confirmed = await confirmLead(l.token);
    expect(confirmed?.status).toBe("CONFIRMED");
    expect((await subscribeLead({ email: EMAIL, criteria: { sector: SECTOR, department: DEP, region: "Bretagne" }, criteriaLabel: "x" })).state).toBe("already");
    // Moins d'un jour après la confirmation : rien
    await processLeadDigests();
    expect(await outbox("lead_digest")).toHaveLength(0);
    // Deux jours plus tard : l'opportunité publiée cette semaine est envoyée
    const r = await processLeadDigests({ now: Date.now() + 2 * 86_400_000 });
    expect(r.emails).toBeGreaterThanOrEqual(1);
    const mails = await outbox("lead_digest");
    expect(mails).toHaveLength(1);
    const p = mails[0].payload as { items: { url: string }[]; unsubscribe: string; link: string };
    expect(p.items.some((i) => i.url === `/opportunites/${oppId}`)).toBe(true);
    expect(p.unsubscribe).toBe(`/alertes/arreter?jeton=${l.token}`);
    expect(p.link).toContain("/inscription?email=");
    // Pas de second envoi avant une semaine
    await processLeadDigests({ now: Date.now() + 4 * 86_400_000 });
    expect(await outbox("lead_digest")).toHaveLength(1);
    expect((await lead()).emails_sent).toBe(1);
    expect(LEAD_DIGEST_INTERVAL_MS).toBe(7 * 86_400_000);
  });

  it("désinscription : plus aucun envoi", async () => {
    const l = await lead();
    expect(await unsubscribeLead(l.token)).not.toBeNull();
    expect((await lead()).status).toBe("UNSUBSCRIBED");
    await processLeadDigests({ now: Date.now() + 30 * 86_400_000 });
    expect(await outbox("lead_digest")).toHaveLength(1);
    expect(await confirmLead("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("données réservées au serveur (aucun accès anonyme)", async () => {
    const { anon } = await import("./helpers");
    const { data } = await anon().from("alert_leads").select("email").eq("email", EMAIL);
    expect(data ?? []).toHaveLength(0);
  });

  it("comptage métier × département pour les pages d'atterrissage", async () => {
    const { data } = await admin.rpc("open_opportunity_counts");
    const row = (data ?? []).find((r) => r.dimension === "department_sector" && r.key === `${DEP}|${SECTOR}`);
    expect(Number(row?.n ?? 0)).toBeGreaterThanOrEqual(1);
  });
});
