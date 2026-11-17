import { describe, expect, it } from "vitest";
import { availabilityLabel, contactInfoIn, offerState, serviceOfferSchema, zoneLabel } from "@/lib/service-offers-core";

const base = { title: "Plombier disponible pour vos chantiers", description: "Installation et dépannage de plomberie, équipe de deux personnes.", department_code: "29" };

describe("disponibilités : formulaire", () => {
  it("accepte une disponibilité simple (dès maintenant, sans date de fin)", () => {
    const r = serviceOfferSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.available_from).toBeNull();
      expect(r.data.nationwide).toBe(false);
    }
  });

  it("refuse les coordonnées dans le texte (les échanges passent par la messagerie)", () => {
    expect(contactInfoIn("Appelez le 06 12 34 56 78")).toBe("phone");
    expect(contactInfoIn("contact : jean.dupont@exemple.fr")).toBe("email");
    expect(contactInfoIn("Disponible du 3 au 20 décembre, 2 équipes")).toBeNull();
    const r = serviceOfferSchema.safeParse({ ...base, description: "Écrivez-moi à contact@plomberie.fr pour un devis rapide." });
    expect(r.success).toBe(false);
  });

  it("une zone est obligatoire : un département ou toute la France", () => {
    expect(serviceOfferSchema.safeParse({ ...base, department_code: "" }).success).toBe(false);
    expect(serviceOfferSchema.safeParse({ ...base, department_code: "", nationwide: "on" }).success).toBe(true);
  });

  it("dates : la fin après le début, jamais dans le passé", () => {
    expect(serviceOfferSchema.safeParse({ ...base, available_from: "2099-03-10", available_until: "2099-03-01" }).success).toBe(false);
    expect(serviceOfferSchema.safeParse({ ...base, available_until: "2001-01-01" }).success).toBe(false);
    expect(serviceOfferSchema.safeParse({ ...base, available_from: "2099-03-01", available_until: "2099-03-10" }).success).toBe(true);
  });
});

describe("disponibilités : libellés", () => {
  it("période en mots simples", () => {
    expect(availabilityLabel(null, null, "2026-11-16")).toBe("Disponible dès maintenant");
    expect(availabilityLabel("2026-11-10", null, "2026-11-16")).toBe("Disponible dès maintenant");
    expect(availabilityLabel("2026-12-03", null, "2026-11-16")).toBe("Disponible à partir du 3 décembre");
    expect(availabilityLabel(null, "2027-01-20", "2026-11-16")).toBe("Disponible dès maintenant, jusqu'au 20 janvier 2027");
  });

  it("zone", () => {
    expect(zoneLabel({ nationwide: true, department_code: null, city: null })).toBe("Toute la France");
    expect(zoneLabel({ nationwide: false, department_code: "29", city: "Brest" }, "Finistère")).toBe("Finistère (29) · Brest");
  });

  it("état pour l'entreprise : en ligne, expirée, retirée", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    expect(offerState({ status: "PUBLISHED", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("online");
    expect(offerState({ status: "PUBLISHED", expires_at: "2026-11-01T00:00:00Z" }, now)).toBe("expired");
    expect(offerState({ status: "ARCHIVED", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("archived");
    expect(offerState({ status: "REMOVED", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("removed");
  });
});
