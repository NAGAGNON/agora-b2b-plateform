import { describe, expect, it } from "vitest";
import { emptyHistory, planSuivi, renderSuiviEmail, retourInterval, SUIVI_NEWS, type SuiviHistory, type SuiviMember } from "@/lib/veille/suivi";
import type { VeilleOpportunity } from "@/lib/veille/select";

const NOW = new Date("2026-11-10T07:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const member = (o: Partial<SuiviMember> = {}): SuiviMember => ({
  user_id: "u1",
  email: "marie@exemple.fr",
  full_name: "Marie Durand",
  frequency: "TWICE_WEEKLY",
  sectors: [],
  regions: [],
  types: [],
  keywords: [],
  company_name: "Durand Électricité",
  company_sectors: ["electricite-automatisme"],
  company_region: "Bretagne",
  consent: "compte",
  created_at: ago(40),
  last_seen_at: ago(10),
  has_company: true,
  has_logo: true,
  profile_complete: true,
  has_alert: true,
  veille_on: false,
  ...o,
});
const history = (o: Partial<SuiviHistory> = {}): SuiviHistory => ({ ...emptyHistory(), ...o });

describe("calendrier du suivi", () => {
  it("accueil : fiche à J1, alerte à J3, découverte à J6, une étape à la fois", () => {
    const fresh = member({ created_at: ago(1.2), last_seen_at: ago(1.2), has_logo: false, has_alert: false });
    expect(planSuivi(fresh, history(), NOW)?.step).toBe("PROFIL");
    expect(planSuivi(member({ created_at: ago(0.5), last_seen_at: null }), history(), NOW)).toBeNull();
    const day3 = member({ created_at: ago(3.1), last_seen_at: ago(3), has_alert: false });
    expect(planSuivi(day3, history({ steps: new Set(["PROFIL"]), lastSuivi: new Date(ago(2)) }), NOW)?.step).toBe("ALERTE");
    const day6 = member({ created_at: ago(6.2), last_seen_at: ago(0.5) });
    expect(planSuivi(day6, history({ steps: new Set(["PROFIL", "ALERTE"]), lastSuivi: new Date(ago(3)) }), NOW)?.step).toBe("DECOUVERTE");
    // Fiche complète, logo présent, alerte créée : pas d'étape inutile
    expect(planSuivi(member({ created_at: ago(3.5), last_seen_at: ago(0.2) }), history(), NOW)).toBeNull();
  });

  it("relance des absents : tous les 2 jours, puis 3, 7, 14 ; jamais une personne active", () => {
    expect(planSuivi(member({ last_seen_at: ago(1) }), history(), NOW)).toBeNull();
    expect(planSuivi(member({ last_seen_at: ago(5) }), history({ lastSuivi: new Date(ago(2)) }), NOW)?.step).toBe("RETOUR");
    expect(planSuivi(member({ last_seen_at: ago(5) }), history({ lastSuivi: new Date(ago(1)) }), NOW)).toBeNull();
    expect(planSuivi(member({ last_seen_at: ago(20) }), history({ lastSuivi: new Date(ago(2)) }), NOW)).toBeNull();
    expect(planSuivi(member({ last_seen_at: ago(20) }), history({ lastSuivi: new Date(ago(3)) }), NOW)?.step).toBe("RETOUR");
    expect([retourInterval(5, 0), retourInterval(20, 0), retourInterval(60, 0), retourInterval(200, 0)]).toEqual([2, 3, 7, 14]);
    // Messages jamais ouverts : on espace (réputation de l'adresse d'envoi)
    expect(retourInterval(5, 6)).toBe(14);
  });

  it("un seul e-mail par jour, veille comprise", () => {
    expect(planSuivi(member({ last_seen_at: ago(9) }), history({ lastAny: new Date(ago(0.3)) }), NOW)).toBeNull();
  });

  it("nouveautés : une seule fois chacune, et seulement si elle concerne la personne", () => {
    const noLogo = member({ has_logo: false });
    expect(planSuivi(noLogo, history(), NOW)?.news?.key).toBe("logo-2026-11");
    expect(planSuivi(member(), history(), NOW)?.news?.key).toBe("pages-metier-2026-11");
    expect(planSuivi(member(), history({ news: new Set(SUIVI_NEWS.map((n) => n.key)) }), NOW)?.news).toBeNull();
  });
});

describe("e-mail de suivi", () => {
  const opp: VeilleOpportunity = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Maintenance des installations électriques de la mairie",
    summary: "Contrat de maintenance préventive.",
    description: null,
    sector_slug: "electricite-automatisme",
    region: "Bretagne",
    department_code: "29",
    city: "Brest",
    type: "PUBLIC_TENDER",
    published_at: ago(1),
    response_deadline: ago(-20),
    origin: "EXTERNAL",
    external_buyer_name: "Ville de Brest",
    source: "BOAMP",
  };
  const base = { base: "https://www.linkprob2b.com", token: "11111111-1111-4111-8111-111111111111", now: NOW, sectorLabel: () => "Électricité", typeLabel: () => "Marché public" };

  it("relance : nombre réel de nouveautés, annonces, lien de désinscription, une seule fois le prénom", () => {
    const e = renderSuiviEmail({ ...base, step: "RETOUR", member: member(), items: [opp], news: SUIVI_NEWS[1], newSince: 12 });
    expect(e.html).toContain("12 nouvelles opportunités pour vous");
    expect(e.html).toContain("Maintenance des installations électriques");
    expect(e.html).toContain("/veille/desabonnement?jeton=");
    expect(e.html).toContain("Nouveau sur LinkProB2B");
    expect(e.text).toContain("Ne plus recevoir ces e-mails");
    expect(e.subject.length).toBeGreaterThan(10);
    expect(e.html).not.toMatch(/intelligence artificielle|\bIA\b/);
  });

  it("accueil : ce qui manque à la fiche, bouton vers la fiche ou le logo", () => {
    const e = renderSuiviEmail({ ...base, step: "PROFIL", member: member({ has_logo: false, profile_complete: false }), items: [], news: null, newSince: 0 });
    expect(e.subject).toBe("Marie, votre fiche Durand Électricité est presque prête");
    expect(e.html).toContain("ajouter votre logo");
    expect(e.html).toContain("p=entreprise");
    const noCompany = renderSuiviEmail({ ...base, step: "PROFIL", member: member({ has_company: false, company_name: null }), items: [], news: null, newSince: 0 });
    expect(noCompany.subject).toBe("Marie, créez la fiche de votre entreprise en 2 minutes");
  });

  it("sans nom ni secteur : formulations neutres", () => {
    const e = renderSuiviEmail({ ...base, step: "ALERTE", member: member({ full_name: "", company_sectors: [] }), items: [opp], news: null, newSince: 0 });
    expect(e.subject).toBe("Ne ratez plus les opportunités qui vous concernent");
    expect(e.html).toContain("Bonjour,");
  });
});
