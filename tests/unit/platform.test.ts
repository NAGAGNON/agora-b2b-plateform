import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/templates";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("environnement applicatif", () => {
  it("APP_ENV prime sur Vercel", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(env.appEnv).toBe("staging");
    expect(env.isProduction).toBe(false);
  });

  it("déduit production / staging de VERCEL_ENV", () => {
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(env.appEnv).toBe("production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(env.appEnv).toBe("staging");
    vi.stubEnv("VERCEL_ENV", "");
    expect(env.appEnv).toBe("development");
  });

  it("déduit l'URL du site sur Vercel", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "linkprob2b-git-test.vercel.app");
    expect(env.siteUrl).toBe("https://linkprob2b-git-test.vercel.app");
  });

  it("utilise le domaine de production Vercel pour le SEO (canonical, sitemap) sans SITE_URL", async () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "linkprob2b.fr");
    const { siteUrl } = await import("@/lib/seo");
    expect(siteUrl()).toBe("https://linkprob2b.fr");
    expect(env.siteUrl).toBe("https://linkprob2b.fr");
  });

  it("normalise l'adresse du premier administrateur", () => {
    vi.stubEnv("INITIAL_ADMIN_EMAIL", "  Moi@Entreprise.FR ");
    expect(env.initialAdminEmail).toBe("moi@entreprise.fr");
  });
});

describe("envoi d'e-mails", () => {
  const msg = { to: "a@b.fr", subject: "S", html: "<p>x</p>", text: "x", idempotencyKey: "k1" };

  it("n'envoie rien sans fournisseur", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await sendEmail(msg)).status).toBe("SKIPPED");
  });

  it("transmet la clé d'idempotence et réussit", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendEmail(msg)).status).toBe("SENT");
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
  });

  it("distingue erreurs temporaires et définitives", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate", { status: 429 })));
    expect(await sendEmail(msg)).toMatchObject({ status: "FAILED", retryable: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid", { status: 422 })));
    expect(await sendEmail(msg)).toMatchObject({ status: "FAILED", retryable: false });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    expect(await sendEmail(msg)).toMatchObject({ status: "FAILED", retryable: true });
  });

  it("envoie dans la boîte de test Mailpit hors production, jamais en production", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAILPIT_URL", "http://127.0.0.1:54324");
    vi.stubEnv("APP_ENV", "staging");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendEmail(msg)).status).toBe("SENT");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(JSON.parse(String(init.body))).toMatchObject({ To: [{ Email: "a@b.fr" }], Subject: "S" });
    vi.stubEnv("APP_ENV", "production");
    expect(env.emailTransport).toBeNull();
    expect((await sendEmail(msg)).status).toBe("SKIPPED");
  });

  it("produit une version HTML échappée et une version texte", () => {
    const { html, text } = renderEmail({ title: "<script>", paragraphs: ["a & b"], cta: { label: "Voir", url: "https://x.fr/?a=1&b=2" } });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b");
    expect(text).toContain("Voir : https://x.fr/?a=1&b=2");
  });
});

describe("limitation de débit : IP du client", () => {
  it("préfère les en-têtes de l'infrastructure à X-Forwarded-For (falsifiable)", async () => {
    const { clientIp } = await import("@/lib/rate-limit");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1", "cf-connecting-ip": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1", "x-vercel-forwarded-for": "3.3.3.3", "cf-connecting-ip": "2.2.2.2" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers({ "x-forwarded-for": "4.4.4.4, 10.0.0.1" }))).toBe("4.4.4.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
