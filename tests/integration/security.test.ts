/**
 * Tests d'intégration : base Supabase locale réelle (npm run db:start).
 * Vérifient que les permissions sont appliquées CÔTÉ BASE (RLS, triggers, RPC),
 * indépendamment de l'interface.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, company, days, user, RUN } from "./helpers";

type U = Awaited<ReturnType<typeof user>>;
let buyer: U, supplier: U, stranger: U, moderator: U, adminUser: U;
let buyerCo: string, supplierCo: string, strangerCo: string;
let oppId: string;

beforeAll(async () => {
  [buyer, supplier, stranger, moderator, adminUser] = await Promise.all([
    user("buyer"),
    user("supplier"),
    user("stranger"),
    user("moderator", "MODERATOR"),
    user("admin", "ADMIN"),
  ]);
  buyerCo = await company(buyer.client, "Acheteur", "BUYER");
  supplierCo = await company(supplier.client, "Fournisseur", "SUPPLIER");
  strangerCo = await company(stranger.client, "Tiers", "SUPPLIER");
});

afterAll(cleanup);

describe("comptes et rôles", () => {
  it("crée le profil utilisateur à l'inscription", async () => {
    const { data } = await buyer.client.from("users").select("id, platform_role, status").eq("id", buyer.id).single();
    expect(data).toMatchObject({ platform_role: "USER", status: "ACTIVE" });
  });

  it("interdit à un utilisateur de s'attribuer un rôle", async () => {
    const { error } = await buyer.client.from("users").update({ platform_role: "SUPER_ADMIN" } as never).eq("id", buyer.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("users").select("platform_role").eq("id", buyer.id).single();
    expect(data?.platform_role).toBe("USER");
  });

  it("n'expose pas les profils des autres utilisateurs", async () => {
    const { data } = await buyer.client.from("users").select("id").eq("id", supplier.id);
    expect(data).toEqual([]);
  });

  it("refuse les RPC d'administration aux non-administrateurs", async () => {
    const { error } = await buyer.client.rpc("admin_set_user_role", { p_user_id: buyer.id, p_role: "ADMIN" });
    expect(error?.code).toBe("42501");
    const { error: e2 } = await moderator.client.rpc("admin_set_user_role", { p_user_id: buyer.id, p_role: "ADMIN" });
    expect(e2?.code).toBe("42501");
  });

  it("rend l'entreprise créée administrée par son créateur", async () => {
    const { data } = await buyer.client.from("company_members").select("role").eq("company_id", buyerCo).eq("user_id", buyer.id).single();
    expect(data?.role).toBe("COMPANY_ADMIN");
  });

  it("interdit de modifier une autre entreprise", async () => {
    const { data } = await stranger.client.from("companies").update({ name: "Piratée" }).eq("id", buyerCo).select("id");
    expect(data ?? []).toEqual([]);
    const { data: c } = await admin.from("companies").select("name").eq("id", buyerCo).single();
    expect(c?.name).not.toBe("Piratée");
  });

  it("interdit de s'attribuer le badge vérifié", async () => {
    const { error } = await buyer.client.from("companies").update({ verified_at: new Date().toISOString() } as never).eq("id", buyerCo);
    expect(error).not.toBeNull();
  });
});

describe("cycle de vie d'une opportunité", () => {
  it("refuse une publication directe sans modération", async () => {
    const { error } = await buyer.client.from("opportunities").insert({
      company_id: buyerCo, type: "QUOTE_REQUEST", status: "PUBLISHED", title: `IT ${RUN} directe`, description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest",
    });
    expect(error).not.toBeNull();
  });

  it("refuse la création au nom d'une autre entreprise", async () => {
    const { error } = await stranger.client.from("opportunities").insert({
      company_id: buyerCo, type: "NEED", status: "DRAFT", title: `IT ${RUN} usurpée`, description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Brest",
    });
    expect(error).not.toBeNull();
  });

  it("crée un brouillon, géolocalisé à partir de la ville", async () => {
    const { data, error } = await buyer.client
      .from("opportunities")
      .insert({
        company_id: buyerCo, type: "PRIVATE_CONSULTATION", status: "DRAFT", title: `IT ${RUN} Maintenance compresseurs`,
        description: "Description de test suffisamment longue.", sector_slug: "maintenance-industrielle", city: "Quimper",
        response_deadline: days(20), skills: ["hydraulique"],
      })
      .select("id, department_code, lat, region")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ department_code: "29", region: "Bretagne" });
    expect(data?.lat).toBeCloseTo(47.996, 2);
    oppId = data!.id;
  });

  it("cache un brouillon au public et aux autres entreprises", async () => {
    expect((await anon().from("opportunities").select("id").eq("id", oppId)).data).toEqual([]);
    expect((await stranger.client.from("opportunities").select("id").eq("id", oppId)).data).toEqual([]);
  });

  it("empêche le demandeur de se publier lui-même", async () => {
    const { error } = await buyer.client.from("opportunities").update({ status: "PUBLISHED" }).eq("id", oppId);
    expect(error?.code).toBe("42501");
  });

  it("permet de soumettre à validation", async () => {
    const { error } = await buyer.client.from("opportunities").update({ status: "PENDING_REVIEW" }).eq("id", oppId);
    expect(error).toBeNull();
  });

  it("notifie la modération", async () => {
    const { data } = await moderator.client.from("notifications").select("type").eq("type", "moderation_pending");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("refuse la modération à un utilisateur standard", async () => {
    const { error } = await buyer.client.rpc("moderate_opportunity", { p_opportunity_id: oppId, p_action: "APPROVE", p_reason: "" });
    expect(error?.code).toBe("42501");
  });

  it("exige un motif pour refuser", async () => {
    const { error } = await moderator.client.rpc("moderate_opportunity", { p_opportunity_id: oppId, p_action: "REJECT", p_reason: "" });
    expect(error?.message).toMatch(/motif/i);
  });

  it("publie après approbation et journalise l'action", async () => {
    const { error } = await moderator.client.rpc("moderate_opportunity", { p_opportunity_id: oppId, p_action: "APPROVE", p_reason: "" });
    expect(error).toBeNull();
    const { data } = await anon().from("opportunities").select("status, published_at").eq("id", oppId).single();
    expect(data?.status).toBe("PUBLISHED");
    expect(data?.published_at).not.toBeNull();
    const { data: logs } = await admin.from("audit_logs").select("action").eq("entity_id", oppId);
    expect(logs?.map((l) => l.action)).toContain("moderation.approve");
    const { data: mod } = await admin.from("moderation_actions").select("action").eq("target_id", oppId);
    expect(mod?.map((m) => m.action)).toContain("APPROVE");
  });

  it("est trouvée par la recherche plein texte et par rayon", async () => {
    const { data } = await anon().rpc("search_opportunities", { p_q: "compresseurs", p_place: "brest", p_radius_km: 100, p_limit: 50 });
    expect(data?.map((r) => r.id)).toContain(oppId);
    const { data: far } = await anon().rpc("search_opportunities", { p_q: "compresseurs", p_place: "marseille", p_radius_km: 50, p_limit: 50 });
    expect(far?.map((r) => r.id)).not.toContain(oppId);
  });

  it("renvoie un contenu modifié en validation", async () => {
    await buyer.client.from("opportunities").update({ title: `IT ${RUN} Maintenance compresseurs (modifiée)` }).eq("id", oppId);
    const { data } = await admin.from("opportunities").select("status").eq("id", oppId).single();
    expect(data?.status).toBe("PENDING_REVIEW");
    await moderator.client.rpc("moderate_opportunity", { p_opportunity_id: oppId, p_action: "APPROVE", p_reason: "" });
  });
});

describe("intérêts, réponses et pipeline", () => {
  let proposalId: string;

  it("refuse de répondre à son propre besoin", async () => {
    const { error } = await buyer.client.rpc("express_interest", { p_opportunity_id: oppId, p_company_id: buyerCo });
    expect(error?.message).toMatch(/propre besoin/);
  });

  it("refuse d'agir au nom d'une entreprise dont on n'est pas membre", async () => {
    const { error } = await stranger.client.rpc("express_interest", { p_opportunity_id: oppId, p_company_id: supplierCo });
    expect(error?.code).toBe("42501");
  });

  it("enregistre l'intérêt, alimente le pipeline et notifie le demandeur", async () => {
    const { error } = await supplier.client.rpc("express_interest", { p_opportunity_id: oppId, p_company_id: supplierCo, p_message: "Intéressés" });
    expect(error).toBeNull();
    const { data: p } = await supplier.client.from("pipeline_items").select("stage").eq("opportunity_id", oppId).single();
    expect(p?.stage).toBe("INTERESTED");
    const { data: n } = await buyer.client.from("notifications").select("type").eq("type", "interest_received");
    expect((n ?? []).length).toBeGreaterThan(0);
  });

  it("dépose une réponse visible du seul demandeur", async () => {
    const { data, error } = await supplier.client.rpc("submit_proposal", {
      p_opportunity_id: oppId, p_company_id: supplierCo, p_message: "Notre proposition détaillée.", p_price_amount: 9000, p_lead_time: "3 semaines",
    });
    expect(error).toBeNull();
    proposalId = data as string;
    expect((await buyer.client.from("proposals").select("id").eq("id", proposalId)).data).toHaveLength(1);
    expect((await stranger.client.from("proposals").select("id").eq("id", proposalId)).data).toEqual([]);
    expect((await anon().from("proposals").select("id").eq("id", proposalId)).data).toEqual([]);
    expect((await stranger.client.from("interests").select("id").eq("opportunity_id", oppId)).data).toEqual([]);
  });

  it("garde l'évaluation du demandeur invisible pour le fournisseur", async () => {
    const { error } = await buyer.client.rpc("save_proposal_evaluation", { p_proposal_id: proposalId, p_score: 4, p_note: "Bon dossier" });
    expect(error).toBeNull();
    expect((await supplier.client.from("proposal_evaluations").select("note").eq("proposal_id", proposalId)).data).toEqual([]);
    expect((await buyer.client.from("proposal_evaluations").select("note").eq("proposal_id", proposalId)).data?.[0]?.note).toBe("Bon dossier");
  });

  it("réserve les décisions au demandeur", async () => {
    const { error } = await supplier.client.rpc("buyer_set_proposal_status", { p_proposal_id: proposalId, p_status: "SELECTED" });
    expect(error?.code).toBe("42501");
    const { error: ok } = await buyer.client.rpc("buyer_set_proposal_status", { p_proposal_id: proposalId, p_status: "SHORTLISTED", p_message: "" });
    expect(ok).toBeNull();
  });

  it("garde le pipeline privé (y compris vis-à-vis de l'administration)", async () => {
    expect((await buyer.client.from("pipeline_items").select("id").eq("company_id", supplierCo)).data).toEqual([]);
    expect((await adminUser.client.from("pipeline_items").select("id").eq("company_id", supplierCo)).data).toEqual([]);
    expect((await supplier.client.from("pipeline_items").select("id").eq("company_id", supplierCo)).data?.length).toBe(1);
  });

  it("encadre la messagerie", async () => {
    const { error: denied } = await stranger.client.rpc("start_conversation", { p_opportunity_id: oppId, p_supplier_company_id: strangerCo, p_body: "Bonjour" });
    expect(denied).not.toBeNull();
    const { data: conv, error } = await buyer.client.rpc("start_conversation", { p_opportunity_id: oppId, p_supplier_company_id: supplierCo, p_body: "Pouvez-vous préciser ?" });
    expect(error).toBeNull();
    const { error: reply } = await supplier.client.rpc("send_message", { p_conversation_id: conv as string, p_body: "Oui, bien sûr." });
    expect(reply).toBeNull();
    expect((await stranger.client.from("messages").select("id").eq("conversation_id", conv as string)).data).toEqual([]);
    expect((await adminUser.client.from("messages").select("id").eq("conversation_id", conv as string)).data).toEqual([]);
    const { error: inject } = await stranger.client.rpc("send_message", { p_conversation_id: conv as string, p_body: "Intrusion" });
    expect(inject?.code).toBe("42501");
  });

  it("clôture la consultation et informe les fournisseurs", async () => {
    const { error: denied } = await stranger.client.rpc("close_opportunity", { p_opportunity_id: oppId, p_outcome: "AWARDED", p_selected_proposal_id: proposalId });
    expect(denied?.code).toBe("42501");
    const { error } = await buyer.client.rpc("close_opportunity", { p_opportunity_id: oppId, p_outcome: "AWARDED", p_selected_proposal_id: proposalId, p_note: "" });
    expect(error).toBeNull();
    const { data } = await anon().from("opportunities").select("status, outcome").eq("id", oppId).single();
    expect(data).toMatchObject({ status: "CLOSED", outcome: "AWARDED" });
    const { data: p } = await supplier.client.from("proposals").select("status").eq("id", proposalId).single();
    expect(p?.status).toBe("SELECTED");
    const { data: n } = await supplier.client.from("notifications").select("type").eq("type", "opportunity_closed");
    expect((n ?? []).length).toBeGreaterThan(0);
  });

  it("n'accepte plus de réponse après clôture", async () => {
    const { error } = await stranger.client.rpc("express_interest", { p_opportunity_id: oppId, p_company_id: strangerCo });
    expect(error?.message).toMatch(/n'accepte plus/);
  });
});

describe("sources et opportunités externes", () => {
  it("refuse d'approuver une source sans validation juridique", async () => {
    const { error } = await adminUser.client.rpc("admin_upsert_external_source", {
      p_id: null as unknown as string, p_name: `IT ${RUN} Source`, p_base_url: "https://example.org", p_description: "", p_license: "", p_terms_url: "",
      p_status: "APPROVED", p_import_method: "MANUAL", p_notes: "", p_legal_validation_confirmed: false,
    });
    expect(error?.message).toMatch(/validation juridique/);
  });

  it("refuse le référencement depuis une source non approuvée", async () => {
    const { data: src } = await adminUser.client.rpc("admin_upsert_external_source", {
      p_id: null as unknown as string, p_name: `IT ${RUN} Source en revue`, p_base_url: "https://example.org", p_description: "", p_license: "", p_terms_url: "",
      p_status: "LEGAL_REVIEW", p_import_method: "MANUAL", p_notes: "", p_legal_validation_confirmed: false,
    });
    const { error } = await moderator.client.rpc("admin_create_external_opportunity", {
      p_source_id: src as string, p_type: "PUBLIC_TENDER", p_title: "Test externe", p_summary: "", p_description: "Résumé rédigé suffisamment long.",
      p_external_buyer_name: "", p_sector_slug: "maintenance-industrielle", p_city: "Brest", p_department_code: "29",
      p_response_deadline: days(10), p_original_url: "https://example.org/x", p_external_id: "X1", p_source_published_at: null as unknown as string,
    });
    expect(error?.message).toMatch(/approuvée/);
  });

  it("publie une opportunité externe toujours identifiée comme externe, sans réponse interne possible", async () => {
    const { data: src } = await adminUser.client.rpc("admin_upsert_external_source", {
      p_id: null as unknown as string, p_name: `IT ${RUN} Source validée`, p_base_url: "https://example.org", p_description: "", p_license: "Test", p_terms_url: "",
      p_status: "APPROVED", p_import_method: "MANUAL", p_notes: "", p_legal_validation_confirmed: true,
    });
    const { data: id, error } = await moderator.client.rpc("admin_create_external_opportunity", {
      p_source_id: src as string, p_type: "PUBLIC_TENDER", p_title: `IT ${RUN} Marché externe`, p_summary: "", p_description: "Résumé rédigé suffisamment long.",
      p_external_buyer_name: "Acheteur", p_sector_slug: "maintenance-industrielle", p_city: "Brest", p_department_code: "29",
      p_response_deadline: days(10), p_original_url: "https://example.org/x", p_external_id: `X-${RUN}`, p_source_published_at: null as unknown as string,
    });
    expect(error).toBeNull();
    const { data } = await anon().from("opportunities").select("origin, company_id, source:opportunity_sources(original_url)").eq("id", id as string).single();
    expect(data?.origin).toBe("EXTERNAL");
    expect(data?.company_id).toBeNull();
    const { error: e2 } = await supplier.client.rpc("express_interest", { p_opportunity_id: id as string, p_company_id: supplierCo });
    expect(e2?.message).toMatch(/site source/);
  });
});

describe("administration et confidentialité", () => {
  it("réserve le journal d'audit aux administrateurs", async () => {
    expect((await buyer.client.from("audit_logs").select("id").limit(1)).data).toEqual([]);
    expect((await moderator.client.from("audit_logs").select("id").limit(1)).data).toEqual([]);
    expect((await adminUser.client.from("audit_logs").select("id").limit(1)).data?.length).toBe(1);
  });

  it("n'autorise aucune écriture directe dans les tables sensibles", async () => {
    expect((await buyer.client.from("audit_logs").insert({ action: "x", entity_type: "x" })).error).not.toBeNull();
    expect((await buyer.client.from("notifications").insert({ user_id: buyer.id, type: "x", title: "x" })).error).not.toBeNull();
    expect((await buyer.client.from("interests").insert({ opportunity_id: oppId, company_id: buyerCo })).error).not.toBeNull();
    expect((await buyer.client.from("email_outbox").select("id")).error).not.toBeNull();
  });

  it("masque une entreprise suspendue et ses publications", async () => {
    const { error } = await moderator.client.rpc("admin_set_company_status", { p_company_id: buyerCo, p_status: "SUSPENDED", p_reason: "Test" });
    expect(error).toBeNull();
    expect((await anon().from("companies").select("id").eq("id", buyerCo)).data).toEqual([]);
    expect((await anon().from("opportunities").select("id").eq("id", oppId)).data).toEqual([]);
    await moderator.client.rpc("admin_set_company_status", { p_company_id: buyerCo, p_status: "ACTIVE", p_reason: "Fin du test" });
  });

  it("bloque un utilisateur suspendu", async () => {
    const { error } = await adminUser.client.rpc("admin_set_user_status", { p_user_id: stranger.id, p_status: "SUSPENDED", p_reason: "Test" });
    expect(error).toBeNull();
    const { error: blocked } = await stranger.client.rpc("create_company", { p_name: "Interdit", p_kind: "BOTH" });
    expect(blocked?.message).toMatch(/suspendu/);
  });

  it("exporte les données personnelles de l'utilisateur", async () => {
    const { data, error } = await supplier.client.rpc("export_my_data");
    expect(error).toBeNull();
    const d = data as { user: { email: string }; proposals: unknown[] };
    expect(d.user.email).toBe(supplier.email);
    expect(d.proposals.length).toBe(1);
  });

  it("protège la mesure d'audience : aucune lecture ni écriture publique, statistiques réservées à l'équipe", async () => {
    const sid = "00000000-0000-4000-8000-" + RUN.padStart(12, "0");
    expect((await anon().from("page_views").insert({ session_id: sid, path: "/" })).error).not.toBeNull();
    expect((await buyer.client.from("page_views").insert({ session_id: sid, path: "/" })).error).not.toBeNull();
    await admin.from("page_views").insert([
      { session_id: sid, path: "/", duration_ms: 30000, referrer_host: "google.com", device: "mobile" },
      { session_id: sid, path: "/opportunites", duration_ms: 60000, device: "mobile" },
    ]);
    expect((await anon().from("page_views").select("id")).data ?? []).toEqual([]);
    expect((await buyer.client.from("page_views").select("id")).data ?? []).toEqual([]);
    expect((await buyer.client.rpc("admin_audience_stats", { p_days: 30 })).error).not.toBeNull();
    expect((await anon().rpc("admin_audience_stats", { p_days: 30 })).error).not.toBeNull();
    const { data, error } = await moderator.client.rpc("admin_audience_stats", { p_days: 7 });
    expect(error).toBeNull();
    const a = data as { visits: number; page_views: number; daily: unknown[]; referrers: { source: string }[] };
    expect(a.visits).toBeGreaterThanOrEqual(1);
    expect(a.page_views).toBeGreaterThanOrEqual(2);
    expect(a.daily.length).toBeGreaterThanOrEqual(7);
    expect(a.referrers.some((r) => r.source === "google.com")).toBe(true);
    expect((await buyer.client.rpc("purge_page_views")).error).not.toBeNull();
    await admin.from("page_views").delete().eq("session_id", sid);
  });

  it("expire automatiquement les opportunités dépassées", async () => {
    const { data: o } = await admin
      .from("opportunities")
      .insert({ company_id: supplierCo, type: "NEED", status: "PUBLISHED", title: `IT ${RUN} expirée`, description: "Description de test suffisamment longue.", sector_slug: "informatique", city: "Brest", response_deadline: days(-1), published_at: days(-10) })
      .select("id")
      .single();
    const { error } = await admin.rpc("expire_opportunities");
    expect(error).toBeNull();
    const { data } = await admin.from("opportunities").select("status").eq("id", o!.id).single();
    expect(data?.status).toBe("EXPIRED");
    expect((await buyer.client.rpc("expire_opportunities")).error).not.toBeNull();
  });
});

describe("stockage de fichiers", () => {
  it("interdit de déposer un fichier dans le dossier d'une autre entreprise", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const { error } = await supplier.client.storage.from("opportunity-documents").upload(`${oppId}/intrus.pdf`, pdf, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
    const { error: logo } = await supplier.client.storage.from("company-logos").upload(`${buyerCo}/logo.png`, pdf, { contentType: "image/png" });
    expect(logo).not.toBeNull();
  });

  it("refuse une URL d'envoi signée hors de ses droits", async () => {
    const { error } = await supplier.client.storage.from("opportunity-documents").createSignedUploadUrl(`${oppId}/intrus.pdf`);
    expect(error).not.toBeNull();
    const { data, error: ok } = await buyer.client.storage.from("opportunity-documents").createSignedUploadUrl(`${oppId}/cahier.pdf`);
    expect(ok).toBeNull();
    expect(data?.token).toBeTruthy();
  });

  it("refuse les types de fichiers non autorisés", async () => {
    const { error } = await supplier.client.storage.from("company-logos").upload(`${supplierCo}/x.html`, new Uint8Array([60, 104]), { contentType: "text/html" });
    expect(error).not.toBeNull();
  });
});
