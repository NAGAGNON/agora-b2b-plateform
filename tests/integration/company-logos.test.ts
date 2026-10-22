/** Logo récupéré sur le site de l'entreprise : enregistrement, logo déposé jamais remplacé, pas de nouvel essai après retrait. */
import { afterAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { admin, cleanup, company, RUN, user } from "./helpers";
import { autoLogoFor, processMissingLogos } from "@/lib/company-logos";

const SITE = "https://93.184.215.14";
let calls = 0;
const fetchImpl = (async (url: string) => {
  calls++;
  if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
  if (url.endsWith("/logo.png")) {
    const img = await sharp({ create: { width: 300, height: 120, channels: 4, background: "#0F2D4A" } })
      .composite([{ input: { create: { width: 100, height: 60, channels: 4, background: "#14B8A6" } }, top: 10, left: 10 }])
      .png()
      .toBuffer();
    return new Response(new Uint8Array(img), { headers: { "content-type": "image/png" } });
  }
  return new Response(`<html><body><img id="logo" src="/logo.png"></body></html>`, { headers: { "content-type": "text/html" } });
}) as unknown as typeof fetch;

afterAll(cleanup);

async function setup(label: string, website: string | null) {
  const u = await user(label);
  const id = await company(u.client, `IT ${RUN} ${label}`);
  await admin.from("companies").update({ website }).eq("id", id);
  return id;
}

describe("Logo repris du site de l'entreprise", () => {
  it("logo trouvé : enregistré en PNG, marqué « repris du site », servi publiquement", async () => {
    const id = await setup("logo-auto", SITE);
    const r = await autoLogoFor(admin, id, fetchImpl);
    expect(r?.status).toBe("FOUND");
    const { data: c } = await admin.from("companies").select("logo_path, logo_source, logo_auto_checked_at").eq("id", id).single();
    expect(c?.logo_source).toBe("AUTO");
    expect(c?.logo_path).toMatch(new RegExp(`^${id}/.+-logo-site\\.png$`));
    const { data: file } = await admin.storage.from("company-logos").download(c!.logo_path!);
    expect((await sharp(Buffer.from(await file!.arrayBuffer())).metadata()).format).toBe("png");
    // Déjà traité : aucune nouvelle requête
    calls = 0;
    expect(await autoLogoFor(admin, id, fetchImpl)).toBeNull();
    expect(calls).toBe(0);
  });

  it("logo déposé par l'entreprise : jamais remplacé", async () => {
    const id = await setup("logo-manuel", SITE);
    await admin.from("companies").update({ logo_path: `${id}/manuel.png` }).eq("id", id);
    calls = 0;
    expect(await autoLogoFor(admin, id, fetchImpl)).toBeNull();
    expect(calls).toBe(0);
    expect((await admin.from("companies").select("logo_path").eq("id", id).single()).data?.logo_path).toBe(`${id}/manuel.png`);
  });

  it("logo retiré par l'entreprise : pas de nouvel essai, sauf si elle change l'adresse de son site", async () => {
    const id = await setup("logo-retire", SITE);
    await admin.from("companies").update({ logo_auto_checked_at: new Date().toISOString(), logo_auto_site: SITE }).eq("id", id);
    expect(await autoLogoFor(admin, id, fetchImpl)).toBeNull();
    await admin.from("companies").update({ website: `${SITE}/nouveau` }).eq("id", id);
    expect((await autoLogoFor(admin, id, fetchImpl))?.status).toBe("FOUND");
  });

  it("traitement par lots : entreprises sans site notées, sans nouvel essai", async () => {
    const id = await setup("logo-sans-site", null);
    const r = await processMissingLogos(admin, { limit: 200, fetchImpl });
    expect(r.checked).toBeGreaterThanOrEqual(1);
    const { data: c } = await admin.from("companies").select("logo_path, logo_auto_checked_at, logo_auto_note").eq("id", id).single();
    expect(c?.logo_path).toBeNull();
    expect(c?.logo_auto_checked_at).not.toBeNull();
    expect(c?.logo_auto_note).toBe("Aucun site connu");
  });
});
