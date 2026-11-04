/**
 * Photos : photo de profil (titulaire du compte uniquement) et photos des prestations
 * (administrateurs de l'entreprise uniquement, 8 au maximum, lecture publique).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, user } from "./helpers";

// PNG 1×1 valide
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

let owner: Awaited<ReturnType<typeof user>>;
let other: Awaited<ReturnType<typeof user>>;
let co: string;
const files: { bucket: string; path: string }[] = [];

beforeAll(async () => {
  owner = await user("photo-owner");
  other = await user("photo-other");
  co = await company(owner.client, "Photos");
});

afterAll(async () => {
  for (const f of files) await admin.storage.from(f.bucket).remove([f.path]);
  await cleanup();
});

describe("Photo de profil", () => {
  it("le titulaire envoie sa photo et l'enregistre ; un autre compte ne peut ni l'écrire ni la remplacer", async () => {
    const path = `${owner.id}/avatar.png`;
    const { error } = await owner.client.storage.from("user-avatars").upload(path, PNG, { contentType: "image/png" });
    expect(error).toBeNull();
    files.push({ bucket: "user-avatars", path });
    expect((await owner.client.from("users").update({ avatar_path: path }).eq("id", owner.id)).error).toBeNull();
    expect((await admin.from("users").select("avatar_path").eq("id", owner.id).single()).data?.avatar_path).toBe(path);

    const intrus = await other.client.storage.from("user-avatars").upload(`${owner.id}/intrus.png`, PNG, { contentType: "image/png" });
    expect(intrus.error).not.toBeNull();
    await other.client.from("users").update({ avatar_path: "x/y.png" }).eq("id", owner.id);
    expect((await admin.from("users").select("avatar_path").eq("id", owner.id).single()).data?.avatar_path).toBe(path);
    // Type de fichier refusé
    const html = await owner.client.storage.from("user-avatars").upload(`${owner.id}/x.html`, new Uint8Array([60, 104]), { contentType: "text/html" });
    expect(html.error).not.toBeNull();
  });
});

describe("Photos des prestations", () => {
  it("l'administrateur ajoute des photos visibles de tous ; un autre compte ne peut ni en ajouter ni en retirer ; 8 au maximum", async () => {
    const path = `${co}/realisation.png`;
    expect((await owner.client.storage.from("company-photos").upload(path, PNG, { contentType: "image/png" })).error).toBeNull();
    files.push({ bucket: "company-photos", path });
    const { data: row, error } = await owner.client.from("company_photos").insert({ company_id: co, storage_path: path, caption: "Chantier test" }).select("id").single();
    expect(error).toBeNull();

    // Lecture publique (fiche entreprise)
    expect((await anon().from("company_photos").select("caption").eq("company_id", co)).data).toEqual([{ caption: "Chantier test" }]);

    // Autre compte : ni envoi, ni ajout, ni retrait
    expect((await other.client.storage.from("company-photos").upload(`${co}/intrus.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
    expect((await other.client.from("company_photos").insert({ company_id: co, storage_path: `${co}/intrus.png` })).error).not.toBeNull();
    await other.client.from("company_photos").delete().eq("id", row!.id);
    expect((await admin.from("company_photos").select("id").eq("id", row!.id)).data).toHaveLength(1);

    // 8 au maximum
    const more = Array.from({ length: 7 }, (_, i) => ({ company_id: co, storage_path: `${co}/p${i}.png` }));
    expect((await owner.client.from("company_photos").insert(more)).error).toBeNull();
    expect((await owner.client.from("company_photos").insert({ company_id: co, storage_path: `${co}/p9.png` })).error).not.toBeNull();

    // Suppression de l'entreprise : photos supprimées avec elle
    await admin.from("companies").delete().eq("id", co);
    expect((await admin.from("company_photos").select("id").eq("company_id", co)).data).toEqual([]);
  });
});
