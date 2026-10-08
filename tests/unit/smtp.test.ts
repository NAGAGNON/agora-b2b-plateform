import { describe, expect, it } from "vitest";
import { classifySmtpError } from "@/lib/email/smtp";

describe("erreurs SMTP", () => {
  it("adresse inexistante (5xx sur le destinataire) = rebond définitif", () => {
    expect(classifySmtpError({ responseCode: 550, code: "EENVELOPE", response: "550 5.1.1 User unknown", message: "Recipient rejected" })).toMatchObject({ permanent: true, retryable: false });
  });
  it("refus 5xx non lié à l'adresse (ex. politique anti-spam) : pas d'opposition automatique, pas de nouvelle tentative", () => {
    expect(classifySmtpError({ responseCode: 554, response: "554 5.7.1 Message rejected", message: "Message rejected" })).toMatchObject({ permanent: false, retryable: false });
  });
  it("4xx ou coupure réseau = temporaire (nouvelle tentative)", () => {
    expect(classifySmtpError({ responseCode: 421, message: "Try again later" })).toMatchObject({ permanent: false, retryable: true });
    expect(classifySmtpError({ code: "ETIMEDOUT", message: "Timeout" })).toMatchObject({ retryable: true });
  });
  it("identifiants refusés = configuration à corriger", () => {
    expect(classifySmtpError({ code: "EAUTH", responseCode: 535, message: "Invalid login" }).error).toMatch(/Authentification SMTP refusée/);
  });
});
