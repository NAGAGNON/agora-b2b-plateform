import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderContactNotice } from "@/lib/signup-notify";
import { contactSchema } from "@/lib/validation";

describe("message de contact envoyé à l'équipe", () => {
  it("contient l'expéditeur, la page et un bouton pour répondre ; le texte est échappé", () => {
    const m = renderContactNotice({ name: "Léa <b>", email: "lea@exemple.fr", company: "Atelier", subject: "Question", message: "Bonjour,\nune question", page: "/opportunites/abc" });
    expect(m.subject).toBe("Message de Léa <b> : Question");
    expect(m.html).toContain("Léa &lt;b&gt;");
    expect(m.html).toContain("mailto:lea%40exemple.fr");
    expect(m.text).toContain("/opportunites/abc");
  });
  it("n'accepte qu'un chemin interne comme page d'origine", () => {
    const base = { name: "Léa", email: "lea@exemple.fr", subject: "Question", message: "Une vraie question ici" };
    expect(contactSchema.safeParse({ ...base, page: "/dashboard" }).success).toBe(true);
    expect(contactSchema.safeParse({ ...base, page: "https://evil.example" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, page: "" }).success).toBe(true);
  });
});
