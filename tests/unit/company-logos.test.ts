import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { findCompanyLogo, logoCandidates, normalizeLogo } from "@/lib/company-logos";

const png = (w: number, h: number, colors = true) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 15, g: 45, b: 74, alpha: 1 } } })
    .composite(colors ? [{ input: { create: { width: Math.max(1, Math.floor(w / 2)), height: Math.max(1, Math.floor(h / 2)), channels: 4, background: { r: 20, g: 184, b: 166, alpha: 1 } } }, top: 0, left: 0 }] : [])
    .png()
    .toBuffer();

describe("repérage du logo dans la page d'accueil", () => {
  it("ordre : logo de l'en-tête (lien d'accueil), logo déclaré, image « logo », icône ; jamais d'image de contenu", () => {
    const html = `<html><head>
      <link rel="icon" href="/favicon.ico">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
      <meta property="og:image" content="/banniere-chantier.jpg">
      <script type="application/ld+json">{"@type":"Organization","logo":"https:\\/\\/exemple.fr\\/img\\/logo-ld.png"}</script>
      </head><body><header><a class="site-logo" href="/"><img src="/img/entete.png" alt="Accueil"></a></header>
      <img src="/photos/equipe.jpg" alt="Notre équipe"><img src="/img/Logo-Dupont.webp" alt="Dupont"></body></html>`;
    const c = logoCandidates(html, "https://exemple.fr/");
    expect(c[0]).toBe("https://exemple.fr/img/entete.png");
    expect(c[1]).toBe("https://exemple.fr/img/logo-ld.png");
    expect(c).toContain("https://exemple.fr/img/Logo-Dupont.webp");
    expect(c.indexOf("https://exemple.fr/apple-touch-icon.png")).toBeGreaterThan(c.indexOf("https://exemple.fr/img/Logo-Dupont.webp"));
    expect(c.join(" ")).not.toMatch(/equipe|banniere|favicon\.ico/);
  });

  it("visuel de campagne et logos de partenaires écartés au profit du vrai logo de l'en-tête", () => {
    const html = `<html><head><meta property="og:image" content="/uploads/campagne-octobre-rose-logo.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","logo":"/uploads/logo-salon-2025.png"}</script></head>
      <body><header><nav><a href="https://www.groupe-sinai.fr/" class="navbar-brand"><img src="/assets/sinai.svg" alt="Groupe Sinaï"></a></nav></header>
      <section class="slider"><img src="/uploads/logo-campagne-noel.png" alt="Logo campagne Noël"></section>
      <footer><img src="/partenaires/logo-qualibat.png" alt="Qualibat"><img src="/img/logo-linkedin.png" alt="LinkedIn"></footer></body></html>`;
    const c = logoCandidates(html, "https://www.groupe-sinai.fr/", "Groupe Sinaï");
    expect(c[0]).toBe("https://www.groupe-sinai.fr/assets/sinai.svg");
    expect(c.join(" ")).not.toMatch(/campagne|noel|salon|qualibat|linkedin/i);
  });

  it("logo dessiné dans la page (SVG du lien d'accueil) : repris en image", () => {
    const html = `<body><header><a href="/" class="logo" aria-label="Accueil"><svg viewBox="0 0 100 30"><rect width="100" height="30" fill="#0F2D4A"/></svg></a></header></body>`;
    const c = logoCandidates(html, "https://exemple.fr/");
    expect(c[0]).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(Buffer.from(c[0].split(",")[1], "base64").toString()).toContain('xmlns="http://www.w3.org/2000/svg"');
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
