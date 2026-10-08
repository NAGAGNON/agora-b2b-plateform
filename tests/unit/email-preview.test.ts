import { describe, expect, it } from "vitest";
import { previewHtml } from "@/lib/email-preview";

describe("aperçu d'e-mail", () => {
  it("ouvre les liens dans un nouvel onglet (jamais dans le cadre de l'aperçu)", () => {
    expect(previewHtml('<html><head><meta charset="utf-8"></head><body><a href="https://x">x</a></body></html>')).toBe(
      '<html><head><base target="_blank"><meta charset="utf-8"></head><body><a href="https://x">x</a></body></html>',
    );
    expect(previewHtml("<p>sans en-tête</p>")).toBe('<base target="_blank"><p>sans en-tête</p>');
  });
});
