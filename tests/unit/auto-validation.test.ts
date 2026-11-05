import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { reviewNeed } from "@/lib/auto-moderation";
import { checkSiren, nameMatches } from "@/lib/company-verify";

const need = { id: "n", title: "Désamiantage et rénovation de toiture 750 m² à Nîmes", description: "Dépose de couverture amiantée, pose bac acier.", type: "NEED", status: "PENDING_REVIEW", origin: "INTERNAL", sector_slug: "sous-traitance-industrielle", city: "Nîmes", department_code: "30", budget_min: null, budget_max: 64900, company: { name: "GREEN MAINTENANCE" } };

describe("relecture automatique des besoins", () => {
  it("transmet le besoin et la liste des secteurs, renvoie la décision", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "end_turn", parsed_output: { decision: "APPROVE", reason: "Besoin clair.", better_sector: "travaux-btp" } });
    const r = await reviewNeed(need, [{ slug: "travaux-btp", label: "Travaux et BTP" }], { beta: { messages: { parse } } } as never);
    expect(r).toEqual({ decision: "APPROVE", reason: "Besoin clair.", better_sector: "travaux-btp" });
    const content = parse.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain("GREEN MAINTENANCE");
    expect(content).toContain("travaux-btp — Travaux et BTP");
  });

  it("refus du modèle : laissé à l'équipe", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    expect((await reviewNeed(need, [], { beta: { messages: { parse } } } as never)).decision).toBe("MANUAL");
  });
});

describe("vérification automatique des entreprises", () => {
  it("compare le nom saisi aux noms officiels", () => {
    expect(nameMatches("Green Maintenance", ["GREEN MAINTENANCE SAS"])).toBe(true);
    expect(nameMatches("Dupont Plomberie", ["SARL DUPONT ET FILS", "DUPONT PLOMBERIE"])).toBe(true);
    expect(nameMatches("Autre Société", ["GREEN MAINTENANCE"])).toBe(false);
  });

  it("SIREN actif et nom concordant : vérifiée ; entreprise fermée : non", async () => {
    const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    const r = await checkSiren("123456789", "Green Maintenance", ok({ results: [{ siren: "123456789", nom_complet: "GREEN MAINTENANCE", etat_administratif: "A" }] }));
    expect(r.ok).toBe(true);
    const closed = await checkSiren("123456789", "Green Maintenance", ok({ results: [{ siren: "123456789", nom_complet: "GREEN MAINTENANCE", etat_administratif: "C" }] }));
    expect(closed).toEqual({ ok: false, reason: "entreprise fermée dans l'annuaire" });
    expect((await checkSiren("12345", "X", ok({}))).ok).toBe(false);
  });
});
