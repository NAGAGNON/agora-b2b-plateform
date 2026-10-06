import { describe, expect, it } from "vitest";
import { matchesSignature, sanitizeFileName, storagePath, validateUpload } from "@/lib/files";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe("fichiers", () => {
  it("vérifie la signature binaire", () => {
    expect(matchesSignature("application/pdf", pdf)).toBe(true);
    expect(matchesSignature("application/pdf", png)).toBe(false);
    expect(matchesSignature("image/png", png)).toBe(true);
    expect(matchesSignature("application/x-msdownload", new Uint8Array([0x4d, 0x5a]))).toBe(false);
  });

  it("nettoie les noms de fichiers", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("Cahier des charges été 2026.pdf")).toBe("Cahier-des-charges-ete-2026.pdf");
    expect(sanitizeFileName("...")).toBe("fichier");
  });

  it("construit un chemin préfixé par l'identifiant parent", () => {
    expect(storagePath("abc", "doc.pdf")).toMatch(/^abc\/[0-9a-f-]{36}-doc\.pdf$/);
  });

  it("refuse un type usurpé ou un fichier trop lourd", async () => {
    const fake = new File([png], "x.pdf", { type: "application/pdf" });
    expect((await validateUpload(fake)).ok).toBe(false);
    const exe = new File([new Uint8Array([0x4d, 0x5a])], "x.exe", { type: "application/x-msdownload" });
    expect((await validateUpload(exe)).ok).toBe(false);
    const big = new File([pdf], "x.pdf", { type: "application/pdf" });
    expect((await validateUpload(big, { maxBytes: 3 })).ok).toBe(false);
    const good = new File([pdf], "devis.pdf", { type: "application/pdf" });
    const r = await validateUpload(good);
    expect(r.ok).toBe(true);
  });
});
