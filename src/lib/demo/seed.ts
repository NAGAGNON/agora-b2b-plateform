/**
 * Jeu de DONNÉES DE DÉMONSTRATION, partagé par `npm run seed:demo` et par
 * l'administration (environnement de prévisualisation uniquement).
 *
 * Toutes les entreprises, opportunités et comptes créés ici sont FICTIFS et
 * marqués is_demo = true. Les noms commencent par « Démo » et les e-mails
 * utilisent le domaine réservé demo.linkprob2b.test. Jamais en production.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

type Db = SupabaseClient<Database>;
export const DEMO_DOMAIN = "demo.linkprob2b.test";
export type DemoCredential = { label: string; email: string; password: string };

function randomPassword(): string {
  return `Demo-${randomBytes(6).toString("base64url")}-A7k`;
}

function must<R extends { data: unknown; error: { message: string } | null }>(res: R, ctx: string): NonNullable<R["data"]> {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  return res.data as NonNullable<R["data"]>;
}

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

export async function wipeDemo(db: Db): Promise<void> {
  // Ordre : opportunités démo (cascade sur intérêts, réponses…), entreprises démo, utilisateurs démo, source démo.
  await db.from("opportunities").delete().eq("is_demo", true);
  await db.from("companies").delete().eq("is_demo", true);
  await db.from("external_sources").delete().eq("is_demo", true);
  const demoUsers: string[] = [];
  let page = 1;
  for (;;) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) if (u.email?.endsWith(`@${DEMO_DOMAIN}`)) demoUsers.push(u.id);
    if (users.length < 200) break;
    page++;
  }
  // Signalements créés par les comptes de démonstration (pas de clé étrangère vers la cible)
  if (demoUsers.length) await db.from("reports").delete().in("reporter_user_id", demoUsers);
  for (const id of demoUsers) await db.auth.admin.deleteUser(id);
}

type DemoUser = { key: string; email: string; name: string; role: Database["public"]["Enums"]["platform_role"]; label: string };
const USERS: DemoUser[] = [
  { key: "admin", email: `admin@${DEMO_DOMAIN}`, name: "Alex Démo (super admin)", role: "SUPER_ADMIN", label: "Super administrateur" },
  { key: "moderateur", email: `moderateur@${DEMO_DOMAIN}`, name: "Camille Démo (modération)", role: "MODERATOR", label: "Modérateur" },
  { key: "acheteur", email: `acheteur@${DEMO_DOMAIN}`, name: "Morgan Démo", role: "USER", label: "Demandeur — Démo Conserverie de l'Odet" },
  { key: "acheteur2", email: `acheteur2@${DEMO_DOMAIN}`, name: "Sasha Démo", role: "USER", label: "Demandeur — Démo Agroalimentaire du Léon" },
  { key: "fournisseur", email: `fournisseur@${DEMO_DOMAIN}`, name: "Jordan Démo", role: "USER", label: "Fournisseur — Démo Iroise Maintenance" },
  { key: "fournisseur2", email: `fournisseur2@${DEMO_DOMAIN}`, name: "Charlie Démo", role: "USER", label: "Fournisseur — Démo Cyber Armor" },
  { key: "fournisseur3", email: `fournisseur3@${DEMO_DOMAIN}`, name: "Lou Démo", role: "USER", label: "Fournisseur — Démo Usinage de Cornouaille" },
];

type DemoCompany = {
  key: string;
  owner: string;
  name: string;
  kind: Database["public"]["Enums"]["company_kind"];
  size: Database["public"]["Enums"]["company_size"];
  city: string;
  tagline: string;
  description: string;
  sectors: string[];
  skills: string[];
  zone: string;
  radius: number;
  certifications?: string[];
  verified?: boolean;
};

const COMPANIES: DemoCompany[] = [
  {
    key: "conserverie", owner: "acheteur", name: "Démo Conserverie de l'Odet", kind: "BUYER", size: "PME", city: "Quimper",
    tagline: "Entreprise fictive de démonstration — transformation de produits de la mer.",
    description: "Entreprise FICTIVE créée pour la démonstration de LinkProB2B. Elle illustre un industriel agroalimentaire qui recherche des prestataires de maintenance et de services techniques.",
    sectors: ["maintenance-industrielle", "services-aux-entreprises"], skills: [], zone: "Finistère", radius: 0, verified: true,
  },
  {
    key: "leon", owner: "acheteur2", name: "Démo Agroalimentaire du Léon", kind: "BOTH", size: "ETI", city: "Landivisiau",
    tagline: "Entreprise fictive de démonstration — légumes transformés.",
    description: "Entreprise FICTIVE de démonstration : site de production qui publie des consultations et propose aussi de la logistique frigorifique.",
    sectors: ["transport-logistique", "maintenance-industrielle"], skills: ["logistique frigorifique", "stockage"], zone: "Nord-Finistère", radius: 60,
  },
  {
    key: "iroise", owner: "fournisseur", name: "Démo Iroise Maintenance", kind: "SUPPLIER", size: "TPE", city: "Brest",
    tagline: "Entreprise fictive — maintenance préventive et curative d'équipements industriels.",
    description: "Entreprise FICTIVE de démonstration. Maintenance mécanique, hydraulique et pneumatique, dépannage sur site, contrats de maintenance préventive.",
    sectors: ["maintenance-industrielle"], skills: ["maintenance préventive", "hydraulique", "pneumatique", "compresseurs", "dépannage"], zone: "Finistère", radius: 80,
    certifications: ["(démo) Habilitation électrique B1V"],
  },
  {
    key: "cyber", owner: "fournisseur2", name: "Démo Cyber Armor", kind: "SUPPLIER", size: "TPE", city: "Lannion",
    tagline: "Entreprise fictive — audit et sécurisation des systèmes d'information.",
    description: "Entreprise FICTIVE de démonstration : audit de sécurité, sensibilisation des équipes, sécurisation des réseaux industriels (OT).",
    sectors: ["cybersecurite", "informatique"], skills: ["audit de sécurité", "sensibilisation", "réseaux industriels", "sauvegarde"], zone: "Bretagne", radius: 250,
  },
  {
    key: "usinage", owner: "fournisseur3", name: "Démo Usinage de Cornouaille", kind: "SUPPLIER", size: "PME", city: "Concarneau",
    tagline: "Entreprise fictive — usinage, chaudronnerie et soudure.",
    description: "Entreprise FICTIVE de démonstration : usinage CN, chaudronnerie inox, soudure TIG, fabrication de pièces unitaires et petites séries.",
    sectors: ["sous-traitance-industrielle", "maintenance-industrielle"], skills: ["usinage CN", "chaudronnerie inox", "soudure TIG", "pièces de rechange"], zone: "Sud-Finistère", radius: 70,
  },
  {
    key: "fournitures", owner: "fournisseur3", name: "Démo Fournitures Techniques Morlaix", kind: "SUPPLIER", size: "TPE", city: "Morlaix",
    tagline: "Entreprise fictive — consommables et pièces techniques.",
    description: "Entreprise FICTIVE de démonstration : roulements, courroies, EPI, consommables de maintenance.",
    sectors: ["fournitures-industrielles"], skills: ["roulements", "transmission", "EPI", "consommables"], zone: "Finistère", radius: 100,
  },
  {
    key: "transport", owner: "fournisseur", name: "Démo Transports de l'Aulne", kind: "SUPPLIER", size: "PME", city: "Châteaulin",
    tagline: "Entreprise fictive — transport et manutention.",
    description: "Entreprise FICTIVE de démonstration : transport régional, levage, manutention de machines.",
    sectors: ["transport-logistique"], skills: ["transport régional", "levage", "manutention de machines"], zone: "Bretagne", radius: 200,
  },
  {
    key: "services", owner: "fournisseur2", name: "Démo Services Pro Rennes", kind: "SUPPLIER", size: "PME", city: "Rennes",
    tagline: "Entreprise fictive — services aux entreprises.",
    description: "Entreprise FICTIVE de démonstration : nettoyage industriel, formation sécurité, accompagnement RH.",
    sectors: ["services-aux-entreprises"], skills: ["nettoyage industriel", "formation sécurité", "SST"], zone: "Bretagne", radius: 250,
  },
];

type Opp = {
  company: string;
  type: Database["public"]["Enums"]["opportunity_type"];
  status: Database["public"]["Enums"]["opportunity_status"];
  title: string;
  summary: string;
  sector: string;
  city: string;
  deadlineDays: number | null;
  publishedDaysAgo: number;
  budget?: [number | null, number | null];
  skills: string[];
  criteria?: string;
  maxSuppliers?: number;
  visibility?: "PUBLIC" | "MEMBERS_ONLY";
};

const T = "[DÉMO] ";
const OPPS: Opp[] = [
  { company: "conserverie", type: "QUOTE_REQUEST", status: "PUBLISHED", title: `${T}Maintenance préventive de 3 compresseurs d'air`, summary: "Contrat annuel de maintenance préventive pour trois compresseurs à vis sur un site de production.", sector: "maintenance-industrielle", city: "Quimper", deadlineDays: 21, publishedDaysAgo: 2, budget: [6000, 12000], skills: ["compresseurs", "maintenance préventive"], criteria: "Prix 40 %, réactivité 30 %, références 30 %", maxSuppliers: 3 },
  { company: "conserverie", type: "PRIVATE_CONSULTATION", status: "PUBLISHED", title: `${T}Consultation : remplacement d'un convoyeur à bande`, summary: "Dépose, fourniture et pose d'un convoyeur inox de 12 m en zone alimentaire.", sector: "sous-traitance-industrielle", city: "Quimper", deadlineDays: 30, publishedDaysAgo: 5, budget: [25000, 40000], skills: ["chaudronnerie inox", "convoyeurs"], criteria: "Conformité alimentaire, délai, prix", maxSuppliers: 4 },
  { company: "conserverie", type: "NEED", status: "PUBLISHED", title: `${T}Recherche prestataire de nettoyage industriel de nuit`, summary: "Nettoyage des lignes de production cinq nuits par semaine.", sector: "services-aux-entreprises", city: "Quimper", deadlineDays: 14, publishedDaysAgo: 8, skills: ["nettoyage industriel"] },
  { company: "conserverie", type: "PRIVATE_TENDER", status: "PUBLISHED", title: `${T}Appel d'offres privé : audit de cybersécurité OT`, summary: "Audit de sécurité des automates et du réseau industriel, avec plan de remédiation.", sector: "cybersecurite", city: "Quimper", deadlineDays: 45, publishedDaysAgo: 1, budget: [8000, 15000], skills: ["audit de sécurité", "réseaux industriels"], criteria: "Méthodologie 50 %, prix 30 %, références 20 %", maxSuppliers: 3 },
  { company: "conserverie", type: "QUOTE_REQUEST", status: "PENDING_REVIEW", title: `${T}Fourniture d'EPI pour 80 salariés`, summary: "Gants, chaussures de sécurité et vêtements de travail adaptés au froid.", sector: "fournitures-industrielles", city: "Quimper", deadlineDays: 20, publishedDaysAgo: 0, skills: ["EPI"] },
  { company: "conserverie", type: "NEED", status: "DRAFT", title: `${T}Brouillon : formation habilitation électrique`, summary: "Formation de 6 techniciens.", sector: "services-aux-entreprises", city: "Quimper", deadlineDays: 40, publishedDaysAgo: 0, skills: ["formation"] },
  { company: "conserverie", type: "QUOTE_REQUEST", status: "CLOSED", title: `${T}Réparation d'une pompe de relevage`, summary: "Consultation clôturée : réparation réalisée.", sector: "maintenance-industrielle", city: "Quimper", deadlineDays: -10, publishedDaysAgo: 40, skills: ["pompes"] },
  { company: "leon", type: "PRIVATE_CONSULTATION", status: "PUBLISHED", title: `${T}Transport frigorifique Landivisiau – Rennes`, summary: "Trois rotations hebdomadaires de palettes sous température dirigée.", sector: "transport-logistique", city: "Landivisiau", deadlineDays: 18, publishedDaysAgo: 3, budget: [null, 50000], skills: ["transport frigorifique"], maxSuppliers: 2 },
  { company: "leon", type: "QUOTE_REQUEST", status: "PUBLISHED", title: `${T}Révision d'une chambre froide positive`, summary: "Contrôle d'étanchéité, révision des groupes froids et contrat d'entretien.", sector: "maintenance-industrielle", city: "Landivisiau", deadlineDays: 10, publishedDaysAgo: 6, skills: ["froid industriel", "maintenance préventive"] },
  { company: "leon", type: "NEED", status: "PUBLISHED", title: `${T}Infogérance du parc informatique (40 postes)`, summary: "Recherche prestataire pour l'infogérance et le support utilisateur.", sector: "informatique", city: "Landivisiau", deadlineDays: 25, publishedDaysAgo: 9, skills: ["infogérance", "support"] },
  { company: "leon", type: "QUOTE_REQUEST", status: "PUBLISHED", title: `${T}Usinage de 50 pièces de rechange en inox`, summary: "Petite série d'arbres et de bagues selon plans fournis.", sector: "sous-traitance-industrielle", city: "Landivisiau", deadlineDays: 12, publishedDaysAgo: 4, budget: [3000, 6000], skills: ["usinage CN", "pièces de rechange"] },
  { company: "leon", type: "NEED", status: "PUBLISHED", title: `${T}Levage et déplacement d'une ligne d'ensachage`, summary: "Manutention de machines lors d'un réaménagement d'atelier.", sector: "transport-logistique", city: "Landivisiau", deadlineDays: 16, publishedDaysAgo: 11, skills: ["levage", "manutention de machines"], visibility: "MEMBERS_ONLY" },
  { company: "leon", type: "QUOTE_REQUEST", status: "EXPIRED", title: `${T}Fourniture de roulements (commande annuelle)`, summary: "Opportunité expirée conservée pour l'historique.", sector: "fournitures-industrielles", city: "Landivisiau", deadlineDays: -3, publishedDaysAgo: 30, skills: ["roulements"] },
  { company: "conserverie", type: "NEED", status: "PUBLISHED", title: `${T}Sensibilisation des équipes au hameçonnage`, summary: "Deux sessions pour 60 salariés de bureau.", sector: "cybersecurite", city: "Quimper", deadlineDays: 28, publishedDaysAgo: 12, skills: ["sensibilisation"] },
  { company: "leon", type: "NEED", status: "PUBLISHED", title: `${T}Maintenance des portes sectionnelles du quai`, summary: "Contrat de maintenance pour 8 portes de quai.", sector: "maintenance-industrielle", city: "Morlaix", deadlineDays: 33, publishedDaysAgo: 14, skills: ["portes industrielles", "maintenance préventive"] },
  { company: "conserverie", type: "QUOTE_REQUEST", status: "PUBLISHED", title: `${T}Contrat de maintenance des chariots élévateurs`, summary: "Parc de 6 chariots électriques.", sector: "maintenance-industrielle", city: "Douarnenez", deadlineDays: 20, publishedDaysAgo: 16, skills: ["chariots élévateurs"] },
  { company: "leon", type: "PRIVATE_CONSULTATION", status: "PUBLISHED", title: `${T}Mise en place d'une sauvegarde externalisée`, summary: "Sauvegarde des serveurs de production et plan de reprise.", sector: "informatique", city: "Brest", deadlineDays: 22, publishedDaysAgo: 18, skills: ["sauvegarde"] },
  { company: "conserverie", type: "NEED", status: "PUBLISHED", title: `${T}Soudure inox sur tuyauteries de process`, summary: "Interventions ponctuelles sur réseau inox alimentaire.", sector: "sous-traitance-industrielle", city: "Concarneau", deadlineDays: 26, publishedDaysAgo: 20, skills: ["soudure TIG", "chaudronnerie inox"] },
];

const EXTERNAL = [
  { type: "PUBLIC_TENDER" as const, title: `${T}Exemple de marché public fictif — maintenance d'équipements portuaires`, summary: "Exemple FICTIF illustrant l'affichage d'un marché public référencé avec sa source.", buyer: "Acheteur public fictif (démo)", sector: "maintenance-industrielle", city: "Brest", dept: "29", deadline: 24, ext: "DEMO-2026-001" },
  { type: "PUBLIC_TENDER" as const, title: `${T}Exemple de marché public fictif — prestations de cybersécurité`, summary: "Exemple FICTIF : la candidature se ferait sur le site source, pas sur LinkProB2B.", buyer: "Collectivité fictive (démo)", sector: "cybersecurite", city: "Quimper", dept: "29", deadline: 35, ext: "DEMO-2026-002" },
  { type: "EXTERNAL_OPPORTUNITY" as const, title: `${T}Exemple d'opportunité externe fictive — transport de marchandises`, summary: "Exemple FICTIF d'opportunité issue d'un partenaire.", buyer: null, sector: "transport-logistique", city: "Lorient", dept: "56", deadline: 15, ext: "DEMO-PART-003" },
  { type: "EXTERNAL_OPPORTUNITY" as const, title: `${T}Exemple d'opportunité externe fictive — fournitures industrielles`, summary: "Exemple FICTIF : référencé avec date de vérification.", buyer: null, sector: "fournitures-industrielles", city: "Saint-Brieuc", dept: "22", deadline: 19, ext: "DEMO-PART-004" },
];

/** Supprime puis recrée le jeu de démonstration. Retourne les identifiants créés. */
export async function seedDemo(db: Db, opts: { password?: string } = {}): Promise<{ creds: DemoCredential[]; companies: number; opportunities: number }> {
  // Verrou en base : posé par le déploiement de production (scripts/migrate.mjs).
  const { data: marker } = await db.from("platform_settings").select("value").eq("key", "private.environment").maybeSingle();
  if ((marker?.value as { name?: string } | undefined)?.name === "production") {
    throw new Error("Refusé : cette base est marquée « production ». Les données de démonstration n'y sont jamais chargées.");
  }
  await wipeDemo(db);
  const creds: { label: string; email: string; password: string }[] = [];
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const pw = opts.password ?? randomPassword();
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: u.name, terms_accepted: "true" },
    });
    if (error || !data.user) throw new Error(`createUser ${u.email}: ${error?.message}`);
    userIds[u.key] = data.user.id;
    must(await db.from("users").update({ platform_role: u.role, is_demo: true, job_title: "Compte de démonstration" }).eq("id", data.user.id).select("id"), "user role");
    creds.push({ label: u.label, email: u.email, password: pw });
  }

  const companyIds: Record<string, string> = {};
  for (const c of COMPANIES) {
    const slug = c.name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const row = must(
      await db
        .from("companies")
        .insert({
          slug, name: c.name, kind: c.kind, size: c.size, city: c.city, is_demo: true, created_by: userIds[c.owner],
          website: "https://example.org",
          verified_at: c.verified ? new Date().toISOString() : null,
          verified_by: c.verified ? userIds.admin : null,
          verification_note: c.verified ? "Démonstration : vérification fictive" : null,
        })
        .select("id")
        .single(),
      `company ${c.name}`,
    );
    companyIds[c.key] = row.id;
    must(await db.from("company_members").insert({ company_id: row.id, user_id: userIds[c.owner], role: "COMPANY_ADMIN" }).select("id"), "member");
    must(
      await db.from("company_profiles").insert({
        company_id: row.id, tagline: c.tagline, description: c.description, sectors: c.sectors, skills: c.skills,
        intervention_zone: c.zone, intervention_radius_km: c.radius, certifications: c.certifications ?? [],
        contact_email: `contact+${c.key}@${DEMO_DOMAIN}`,
      }).select("company_id"),
      "profile",
    );
  }
  // L'acheteur 2 est aussi membre de la société de transport (illustration multi-entreprises)
  must(await db.from("company_members").insert({ company_id: companyIds.transport, user_id: userIds.acheteur2, role: "COMPANY_MEMBER" }).select("id"), "member2");

  const oppIds: string[] = [];
  const byTitle: Record<string, string> = {};
  for (const o of OPPS) {
    const published = ["PUBLISHED", "CLOSED", "EXPIRED"].includes(o.status) ? daysFromNow(-o.publishedDaysAgo) : null;
    const row = must(
      await db
        .from("opportunities")
        .insert({
          company_id: companyIds[o.company], created_by: userIds[COMPANIES.find((c) => c.key === o.company)!.owner],
          type: o.type, status: o.status, title: o.title, summary: o.summary,
          description: `${o.summary}\n\nDonnées de démonstration — aucune entreprise ou opportunité réelle. Ce texte illustre la présentation d'un besoin : contexte, périmètre, attentes et modalités de réponse.`,
          sector_slug: o.sector, city: o.city, response_deadline: o.deadlineDays === null ? null : daysFromNow(o.deadlineDays),
          budget_min: o.budget?.[0] ?? null, budget_max: o.budget?.[1] ?? null, skills: o.skills, criteria: o.criteria ?? null,
          max_suppliers: o.maxSuppliers ?? null, visibility: o.visibility ?? "PUBLIC", published_at: published,
          closed_at: o.status === "CLOSED" ? daysFromNow(-5) : null, outcome: o.status === "CLOSED" ? "AWARDED" : null,
          publisher_attested_at: new Date().toISOString(), is_demo: true,
        })
        .select("id")
        .single(),
      `opp ${o.title}`,
    );
    oppIds.push(row.id);
    byTitle[o.title] = row.id;
  }

  // Source externe de démonstration (fictive) + opportunités externes d'exemple
  const source = must(
    await db
      .from("external_sources")
      .insert({
        name: "Source de démonstration (fictive)", base_url: "https://example.org", status: "APPROVED", is_demo: true,
        description: "Source FICTIVE utilisée uniquement pour illustrer l'affichage des opportunités externes.",
        license: "Exemple — aucune donnée réelle", import_method: "MANUAL", legal_validated_at: new Date().toISOString(),
        notes: "Données de démonstration — aucune entreprise ou opportunité réelle.",
      })
      .select("id")
      .single(),
    "source",
  );
  for (const e of EXTERNAL) {
    const row = must(
      await db
        .from("opportunities")
        .insert({
          origin: "EXTERNAL", type: e.type, status: "PUBLISHED", title: e.title, summary: e.summary,
          description: `${e.summary}\n\nRésumé rédigé pour la démonstration. Les conditions et la candidature figureraient sur le site source.`,
          external_buyer_name: e.buyer, sector_slug: e.sector, city: e.city, department_code: e.dept,
          response_deadline: daysFromNow(e.deadline), published_at: daysFromNow(-3), created_by: userIds.moderateur, is_demo: true,
        })
        .select("id")
        .single(),
      "external opp",
    );
    must(
      await db.from("opportunity_sources").insert({
        opportunity_id: row.id, source_id: source.id, external_id: e.ext, original_url: `https://example.org/demo/${e.ext}`,
        source_published_at: daysFromNow(-4).slice(0, 10), last_verified_at: daysFromNow(-1), imported_by: userIds.moderateur,
      }).select("opportunity_id"),
      "opportunity_source",
    );
  }

  // Interactions : intérêts, réponses, pipeline, messagerie, alertes, favoris
  const compressors = byTitle[OPPS[0].title];
  const convoyeur = byTitle[OPPS[1].title];
  const audit = byTitle[OPPS[3].title];
  must(await db.from("interests").insert([
    { opportunity_id: compressors, company_id: companyIds.iroise, user_id: userIds.fournisseur, message: "Nous intervenons régulièrement sur ce type de compresseurs (exemple de démonstration).", status: "SHORTLISTED" },
    { opportunity_id: convoyeur, company_id: companyIds.usinage, user_id: userIds.fournisseur3, message: "Intéressés, visite de site possible (démo).", status: "PENDING" },
    { opportunity_id: audit, company_id: companyIds.cyber, user_id: userIds.fournisseur2, message: "Disponibles pour un échange (démo).", status: "PENDING" },
  ]).select("id"), "interests");
  const proposal = must(
    await db.from("proposals").insert({
      opportunity_id: compressors, company_id: companyIds.iroise, submitted_by: userIds.fournisseur,
      message: "Proposition de démonstration : contrat annuel avec deux visites préventives et astreinte.",
      proposal_text: "Exemple de réponse fictive : planning, méthodologie et conditions.", price_amount: 8900, price_details: "Forfait annuel HT (exemple)",
      lead_time: "Démarrage sous 3 semaines", valid_until: daysFromNow(60).slice(0, 10), status: "SHORTLISTED",
    }).select("id").single(),
    "proposal",
  );
  must(await db.from("proposals").insert({
    opportunity_id: convoyeur, company_id: companyIds.usinage, submitted_by: userIds.fournisseur3,
    message: "Réponse de démonstration : fabrication et pose du convoyeur inox.", price_amount: 32500, lead_time: "8 semaines",
  }).select("id"), "proposal2");

  must(await db.from("pipeline_items").insert([
    { company_id: companyIds.iroise, opportunity_id: compressors, stage: "RESPONSE_SENT", notes: "Relancer après la visite (démo).", estimated_value: 8900 },
    { company_id: companyIds.iroise, opportunity_id: byTitle[OPPS[8].title], stage: "QUALIFIED", notes: "Vérifier les habilitations froid (démo)." },
    { company_id: companyIds.iroise, opportunity_id: byTitle[OPPS[14].title], stage: "DETECTED" },
    { company_id: companyIds.iroise, opportunity_id: byTitle[OPPS[15].title], stage: "RESPONSE_PREPARING" },
    { company_id: companyIds.usinage, opportunity_id: convoyeur, stage: "RESPONSE_SENT" },
    { company_id: companyIds.cyber, opportunity_id: audit, stage: "INTERESTED" },
  ]).select("id"), "pipeline");

  const conv = must(
    await db.from("conversations").insert({
      opportunity_id: compressors, buyer_company_id: companyIds.conserverie, supplier_company_id: companyIds.iroise,
      subject: OPPS[0].title, created_by: userIds.acheteur,
    }).select("id").single(),
    "conversation",
  );
  must(await db.from("messages").insert([
    { conversation_id: conv.id, sender_user_id: userIds.acheteur, sender_company_id: companyIds.conserverie, body: "Bonjour, pouvez-vous préciser le délai d'intervention en cas de panne ? (message de démonstration)", created_at: daysFromNow(-1) },
    { conversation_id: conv.id, sender_user_id: userIds.fournisseur, sender_company_id: companyIds.iroise, body: "Bonjour, intervention sous 4 heures ouvrées dans le cadre du contrat (message de démonstration).", created_at: daysFromNow(-0.5) },
  ]).select("id"), "messages");
  void proposal;

  must(await db.from("alerts").insert([
    { user_id: userIds.fournisseur, name: "Maintenance Finistère (démo)", sector_slug: "maintenance-industrielle", department_code: "29", frequency: "DAILY" },
    { user_id: userIds.fournisseur2, name: "Cybersécurité Bretagne (démo)", sector_slug: "cybersecurite", frequency: "IMMEDIATE" },
  ]).select("id"), "alerts");
  must(await db.from("favorites").insert([
    { user_id: userIds.fournisseur, opportunity_id: byTitle[OPPS[8].title] },
    { user_id: userIds.acheteur, company_id: companyIds.iroise },
  ]).select("id"), "favorites");
  must(await db.from("saved_searches").insert({ user_id: userIds.fournisseur, name: "Maintenance à Brest (démo)", query: { secteur: "maintenance-industrielle", lieu: "brest", rayon: "50" } }).select("id"), "saved");
  must(await db.from("reports").insert({ reporter_user_id: userIds.fournisseur2, target_type: "OPPORTUNITY", target_id: byTitle[OPPS[2].title], reason: "OTHER", details: "Signalement de démonstration pour tester la console de modération." }).select("id"), "report");

  return { creds, companies: COMPANIES.length, opportunities: OPPS.length + EXTERNAL.length };
}
