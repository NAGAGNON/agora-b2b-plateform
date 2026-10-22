import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { findCompanyLogo, logoCandidates, normalizeLogo } from "@/lib/company-logos";

const png = (w: number, h: number, colors = true) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 15, g: 45, b: 74, alpha: 1 } } })
    .composite(colors ? [{ input: { create: { width: Math.max(1, Math.floor(w / 2)), height: Math.max(1, Math.floor(h / 2)), channels: 4, background: { r: 20, g: 184, b: 166, alpha: 1 } } }, top: 0, left: 0 }] : [])
    .png()
    .toBuffer();

describe("repérage du logo dans la page d'accueil", () => {
  it("ordre : logo déclaré, image « logo », icône haute définition ; jamais d'image de contenu", () => {
    const html = `<html><head>
      <link rel="icon" href="/favicon.ico">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
      <meta property="og:image" content="/banniere-chantier.jpg">
      <script type="application/ld+json">{"@type":"Organization","logo":"https:\\/\\/exemple.fr\\/img\\/logo-ld.png"}</script>
      </head><body><header><a class="site-logo" href="/"><img src="/img/entete.png" alt="Accueil"></a></header>
      <img src="/photos/equipe.jpg" alt="Notre équipe"><img src="/img/Logo-Dupont.webp" alt="Dupont"></body></html>`;
    const c = logoCandidates(html, "https://exemple.fr/");
    expect(c[0]).toBe("https://exemple.fr/img/logo-ld.png");
    expect(c).toContain("https://exemple.fr/img/Logo-Dupont.webp");
    expect(c).toContain("https://exemple.fr/img/entete.png");
    expect(c).toContain("https://exemple.fr/apple-touch-icon.png");
    expect(c.join(" ")).not.toMatch(/equipe|banniere|favicon\.ico/);
  });
});

describe("contrôle et conversion de l'image", () => {
  it("logo correct : converti en PNG, 512 px au plus", async () => {
    const out = await normalizeLogo(await png(1200, 400));
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(512);
  });

  it("refusés : trop petit, bannière très allongée, image uniforme, fichier qui n'est pas une image", async () => {
    expect(await normalizeLogo(await png(32, 32))).toBeNull();
    expect(await normalizeLogo(await png(2000, 150))).toBeNull();
    expect(await normalizeLogo(await png(300, 300, false))).toBeNull();
    expect(await normalizeLogo(Buffer.from("<html>pas une image</html>"))).toBeNull();
  });

  it("SVG converti en PNG (aucun code du site conservé)", async () => {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0F2D4A"/><circle cx="20" cy="20" r="12" fill="#14B8A6"/><script>alert(1)</script></svg>`);
    const out = await normalizeLogo(svg);
    expect(out).not.toBeNull();
    expect((await sharp(out!).metadata()).format).toBe("png");
  });
});

describe("recherche sur le site (réseau simulé)", () => {
  const SITE = "https://93.184.215.14";
  const respond = (body: BodyInit, type: string, status = 200) => new Response(body, { status, headers: { "content-type": type } });

  it("trouve le logo de la page d'accueil quand robots.txt l'autorise", async () => {
    const logo = await png(400, 200);
    const seen: string[] = [];
    const fetchImpl = (async (url: string) => {
      seen.push(url);
      if (url.endsWith("/robots.txt")) return respond("User-agent: *\nAllow: /", "text/plain");
      if (url.endsWith("/img/logo.png")) return respond(new Uint8Array(logo), "image/png");
      return respond(`<html><body><img class="logo" src="/img/logo.png"></body></html>`, "text/html");
    }) as unknown as typeof fetch;
    const r = await findCompanyLogo({ name: "Dupont", website: SITE, siren: null, city: null }, fetchImpl);
    expect(r.status).toBe("FOUND");
    expect(r.source).toBe(`${SITE}/img/logo.png`);
    expect(seen[0]).toBe(`${SITE}/robots.txt`);
  });

  it("exploration refusée par robots.txt : rien n'est lu", async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: string) => {
      seen.push(url);
      return url.endsWith("/robots.txt") ? respond("User-agent: *\nDisallow: /", "text/plain") : respond("<img class=logo src=/l.png>", "text/html");
    }) as unknown as typeof fetch;
    const r = await findCompanyLogo({ name: "Dupont", website: SITE, siren: null, city: null }, fetchImpl);
    expect(r.status).toBe("BLOCKED");
    expect(seen).toEqual([`${SITE}/robots.txt`]);
  });

  it("aucun site ni SIREN : aucune requête", async () => {
    const fetchImpl = (() => Promise.reject(new Error("ne doit pas être appelé"))) as unknown as typeof fetch;
    expect((await findCompanyLogo({ name: "Dupont", website: null, siren: null, city: null }, fetchImpl)).status).toBe("NO_SITE");
  });

  it("adresse du réseau interne refusée", async () => {
    const fetchImpl = (() => Promise.reject(new Error("ne doit pas être appelé"))) as unknown as typeof fetch;
    expect((await findCompanyLogo({ name: "X", website: "http://127.0.0.1", siren: null, city: null }, fetchImpl)).status).toBe("BLOCKED");
  });
});
