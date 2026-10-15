import { describe, expect, it } from "vitest";
import { deadlineIcs, icsEscape, icsFold } from "@/lib/ics";

describe("agenda (.ics) des échéances", () => {
  it("échappe les caractères spéciaux", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("plie les lignes longues à 75 octets sans couper un caractère accentué", () => {
    const folded = icsFold("SUMMARY:" + "é".repeat(80));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(Buffer.byteLength(p)).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe("SUMMARY:" + "é".repeat(80));
  });

  it("produit un évènement à l'échéance avec rappels 7 jours et 2 jours avant", () => {
    const ics = deadlineIcs(
      { id: "11111111-2222-3333-4444-555555555555", title: "Maintenance CVC, lot 2", deadline: "2026-11-20T11:00:00Z", url: "https://www.linkprob2b.com/opportunites/x", location: "Rennes, Bretagne" },
      new Date("2026-10-15T08:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTEND:20261120T110000Z");
    expect(ics).toContain("DTSTART:20261120T103000Z");
    expect(ics).toContain("SUMMARY:Échéance : Maintenance CVC\\, lot 2");
    expect(ics).toContain("LOCATION:Rennes\\, Bretagne");
    expect(ics).toContain("TRIGGER:-P7D");
    expect(ics).toContain("TRIGGER:-P2D");
    expect(ics).toContain("UID:echeance-11111111-2222-3333-4444-555555555555@linkprob2b");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
