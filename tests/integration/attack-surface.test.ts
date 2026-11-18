/**
 * Essais d'attaque d'un membre connecté contre la plateforme et contre une autre entreprise :
 * chaque tentative doit être refusée (droits d'administration, abonnement gratuit, données d'autrui,
 * e-mails, stockage, prix de la visibilité calculé par la base).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, RUN, user } from "./helpers";

type U = Awaited<ReturnType<typeof user>>;
let victim: U;
let attacker: U;
let vc: string;
let ac: string;
let need: string;
const setFreeLaunch = (on: boolean) =>
  admin.from("platform_settings").upsert({ key: "billing.free_launch", value: on, description: "Phase de lancement" }, { onConflict: "key" });

beforeAll(async () => {
  victim = await user("victime");
  attacker = await user("attaquant");
  vc = await company(victim.client, "Victime");
  ac = await company(attacker.client, "Attaquant");
  const { data } = await victim.client
    .from("opportunities")
    .insert({ type: "NEED", status: "PENDING_REVIEW", visibility: "PUBLIC", title: `IT ${RUN} Besoin de la victime`, description: "Description du besoin de la victime, assez longue.", company_id: vc, department_code: "29" })
    .select("id")
    .single();
  need = data!.id;
});

afterAll(async () => {
  await setFreeLaunch(true);
  await admin.from("visibility_boosts").delete().eq("company_id", ac);
  await cleanup();
});

describe("un membre connecté ne peut pas", () => {
  it("se donner des droits d'administration", async () => {
    const A = attacker.client;
    expect((await A.from("users").update({ platform_role: "SUPER_ADMIN" } as never).eq("id", attacker.id)).error).not.toBeNull();
    expect((await A.rpc("admin_set_user_role", { p_user_id: attacker.id, p_role: "SUPER_ADMIN" })).error).not.toBeNull();
    expect((await A.rpc("admin_update_setting", { p_key: "security", p_value: { admin_mfa_required: false } })).error).not.toBeNull();
    expect((await A.rpc("admin_stats")).error).not.toBeNull();
    expect((await A.from("platform_settings").update({ value: {} } as never).eq("key", "security")).error).not.toBeNull();
  });

  it("s'offrir un abonnement", async () => {
    const A = attacker.client;
    expect((await A.from("companies").update({ plan_code: "BUSINESS" } as never).eq("id", ac)).error).not.toBeNull();
    expect((await A.from("subscriptions").insert({ company_id: ac, status: "active" } as never)).error).not.toBeNull();
    expect((await A.rpc("start_pro_trial", { p_company_id: vc })).error).not.toBeNull();
  });

  it("toucher à une autre entreprise", async () => {
    const A = attacker.client;
    expect((await A.from("companies").update({ name: "Piraté" }).eq("id", vc).select("id")).data ?? []).toHaveLength(0);
    expect((await A.from("company_members").insert({ company_id: vc, user_id: attacker.id, role: "COMPANY_ADMIN" } as never)).error).not.toBeNull();
    expect((await A.from("opportunities").update({ title: "Piraté" }).eq("id", need).select("id")).data ?? []).toHaveLength(0);
    expect((await A.from("opportunities").insert({ type: "NEED", status: "PENDING_REVIEW", visibility: "PUBLIC", title: `IT ${RUN} Usurpation`, description: "Publication au nom d'une autre entreprise.", company_id: vc } as never)).error).not.toBeNull();
    expect((await A.rpc("moderate_opportunity", { p_opportunity_id: need, p_action: "REJECT" as never, p_reason: "x" })).error).not.toBeNull();
    expect((await A.rpc("company_usage", { p_company_id: vc })).error).not.toBeNull();
  });

  it("lire les données privées des autres ni envoyer d'e-mails ou de notifications", async () => {
    const A = attacker.client;
    expect((await A.from("users").select("email").eq("id", victim.id)).data ?? []).toHaveLength(0);
    expect((await A.from("opportunities").select("id").eq("id", need)).data ?? []).toHaveLength(0);
    expect((await A.from("email_outbox").insert({ to_email: "x@example.com", template: "notification", subject: "phishing", payload: {} } as never)).error).not.toBeNull();
    expect((await A.from("notifications").insert({ user_id: victim.id, type: "x", title: "Phishing", body: "cliquez" } as never)).error).not.toBeNull();
    expect((await A.from("board_decisions").update({ status: "VALIDEE" } as never).neq("id", "00000000-0000-0000-0000-000000000000")).error).not.toBeNull();
  });

  it("déposer un fichier chez une autre entreprise, ni une page web déguisée", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect((await attacker.client.storage.from("company-logos").upload(`${vc}/pwn.png`, png, { contentType: "image/png" })).error).not.toBeNull();
    expect((await attacker.client.storage.from("user-avatars").upload(`${victim.id}/pwn.png`, png, { contentType: "image/png" })).error).not.toBeNull();
    expect((await attacker.client.storage.from("company-logos").upload(`${ac}/x.html`, new TextEncoder().encode("<script>alert(1)</script>"), { contentType: "text/html" })).error).not.toBeNull();
  });

  it("choisir le prix de sa visibilité : la base le calcule", async () => {
    await setFreeLaunch(false);
    const { data: id, error } = await attacker.client.rpc("request_visibility_boost", {
      p_company_id: ac, p_target: "COMPANY", p_opportunity_id: null as never, p_daily: 20, p_featured_days: 7, p_duration_days: 14, p_price_ht: 0, p_targeting: {},
    });
    expect(error).toBeNull();
    const { data: b } = await admin.from("visibility_boosts").select("price_ht, status").eq("id", id!).single();
    // 20 présentations/jour = 4 € HT/jour × 14 jours + 7 jours « À la une » à 1 € = 63 € HT (offre Gratuite, rien d'inclus)
    expect(Number(b!.price_ht)).toBe(63);
    expect(b!.status).toBe("PENDING");
    await admin.from("visibility_boosts").delete().eq("id", id!);
  });

  it("(non-régression) une demande de visibilité avec ciblage aboutit", async () => {
    await setFreeLaunch(true);
    const { data: id, error } = await attacker.client.rpc("request_visibility_boost", {
      p_company_id: ac, p_target: "COMPANY", p_opportunity_id: null as never, p_daily: 10, p_featured_days: 0, p_duration_days: 7, p_price_ht: 999,
      p_targeting: { sectors: ["maintenance-industrielle"], regions: ["Bretagne"], sizes: ["PME", "PIRATE"], kinds: ["SUPPLIER"] },
    });
    expect(error).toBeNull();
    const { data: b } = await admin.from("visibility_boosts").select("price_ht, status, targeting").eq("id", id!).single();
    expect(Number(b!.price_ht)).toBe(0);
    expect(b!.status).toBe("ACTIVE");
    expect(b!.targeting).toMatchObject({ sizes: ["PME"], kinds: ["SUPPLIER"] });
  });
});

describe("un visiteur sans compte ne peut pas", () => {
  it("lire les données privées ni écrire", async () => {
    const X = anon();
    for (const t of ["users", "messages", "conversations", "subscriptions", "pipeline_items", "notifications", "board_decisions"]) {
      expect((await X.from(t as never).select("*").limit(5)).data ?? [], t).toHaveLength(0);
    }
    expect((await X.rpc("export_my_data")).error).not.toBeNull();
    expect((await X.from("opportunities").insert({ type: "NEED", title: "spam", description: "spam anonyme assez long", status: "PUBLISHED" } as never)).error).not.toBeNull();
  });
});
