import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderSignupNotice } from "@/lib/signup-notify";

describe("E-mail « nouvel inscrit »", () => {
  it("nom, e-mail, provenance, alerte ; contenu échappé", () => {
    const m = renderSignupNotice({ name: "Jean <b>Dupont</b>", email: "jean@exemple.fr", origin: "Google (recherche)", alertName: "BTP — Rhône", at: new Date("2026-11-04T10:00:00Z") });
    expect(m.subject).toContain("Jean <b>Dupont</b>");
    expect(m.html).toContain("Jean &lt;b&gt;Dupont&lt;/b&gt;");
    expect(m.html).not.toContain("<b>Dupont</b>");
    expect(m.text).toContain("Provenance : Google (recherche)");
    expect(m.text).toContain("Alerte créée : BTP — Rhône");
  });
  it("provenance inconnue indiquée telle quelle, sans invention", () => {
    const m = renderSignupNotice({ name: "", email: "a@b.fr", origin: null, alertName: null, at: new Date() });
    expect(m.subject).toContain("a@b.fr");
    expect(m.text).toContain("Inconnue (visite non mesurée)");
  });
});
