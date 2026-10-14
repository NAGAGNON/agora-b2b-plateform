/**
 * Détail des inscriptions (tableau de bord) : identité, chemin d'arrivée (prospection ou direct),
 * confirmation de l'adresse, entreprise renseignée et activité qui a suivi.
 */
import { afterAll, describe, expect, it } from "vitest";
import { admin, cleanup, company, RUN, user } from "./helpers";
import { loadSignups } from "@/lib/admin-signups";

const campaigns: string[] = [];
afterAll(async () => {
  for (const id of campaigns) await admin.from("outreach_campaigns").delete().eq("id", id);
  await admin.from("outreach_prospects").delete().like("name", `IT ${RUN}%`);
  await cleanup();
});

describe("Détail des inscriptions", () => {
  it("inscrit direct avec entreprise et alerte, inscrit venu d'un e-mail de prospection", async () => {
    const direct = await user("insc-direct");
    await admin.from("users").update({ job_title: "Gérant", phone: "0600000000" }).eq("id", direct.id);
    await company(direct.client, "Inscrit SARL");
    await admin.from("alerts").insert({ user_id: direct.id, name: "Mon alerte" });

    const viaMail = await user("insc-outreach");
    const { data: p } = await admin.from("outreach_prospects").insert({ name: `IT ${RUN} Prospect`, siren: "123456789", source: "Test" }).select("id").single();
    const { data: c } = await admin.from("outreach_campaigns").insert({ campaign_date: "2091-01-02", kind: "MANUAL", status: "VALIDATED", dry_run: true, min_score: 70, subject_template: "s", intro_template: "Introduction de test assez longue." }).select("id").single();
    campaigns.push(c!.id);
    await admin.from("outreach_recipients").insert({ campaign_id: c!.id, prospect_id: p!.id, email: viaMail.email, score: 80, reasons: [], status: "SENT", signed_up_at: new Date().toISOString() });

    const { rows, count } = await loadSignups(admin, { page: 1, per: 50 });
    expect(count).toBeGreaterThanOrEqual(2);
    const d = rows.find((r) => r.id === direct.id)!;
    expect(d).toMatchObject({ jobTitle: "Gérant", phone: "0600000000", origin: { kind: "direct" } });
    expect(d.emailConfirmedAt).toBeTruthy();
    expect(d.company?.name).toBe(`IT ${RUN} Inscrit SARL`);
    expect(d.company?.sectors).toContain("maintenance-industrielle");
    expect(d.activity.alerts).toBe(1);
    expect(d.activity.subscription).toBeNull();

    const o = rows.find((r) => r.id === viaMail.id)!;
    expect(o.origin).toMatchObject({ kind: "outreach", campaignDate: "2091-01-02", prospectName: `IT ${RUN} Prospect` });
    expect(o.company).toBeNull();
  });
});
