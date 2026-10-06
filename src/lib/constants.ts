import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type OpportunityType = Enums["opportunity_type"];
export type OpportunityStatus = Enums["opportunity_status"];
export type OpportunityOrigin = Enums["opportunity_origin"];
export type PipelineStage = Enums["pipeline_stage"];
export type InterestStatus = Enums["interest_status"];
export type ProposalStatus = Enums["proposal_status"];
export type CompanyKind = Enums["company_kind"];
export type CompanySize = Enums["company_size"];
export type CompanyRole = Enums["company_role"];
export type PlatformRole = Enums["platform_role"];
export type AlertFrequency = Enums["alert_frequency"];
export type SourceStatus = Enums["source_status"];
export type ReportStatus = Enums["report_status"];
export type ReportTarget = Enums["report_target"];
export type OpportunityOutcome = Enums["opportunity_outcome"];

export const SITE_NAME = "LinkProB2B";
export const SLOGAN = "Des opportunités qui créent des connexions.";
export const PROMISE = "Les bonnes opportunités. Les bons partenaires. Au bon moment.";
export const DEMO_NOTICE = "Données de démonstration — aucune entreprise ou opportunité réelle.";
/** Bandeau global : la démo coexiste avec les opportunités externes réelles (BOAMP, TED). */
export const DEMO_BANNER = "certaines entreprises et opportunités sont fictives et marquées « Démo ». Les marchés publics référencés (BOAMP, TED) sont réels.";

export const SECTORS = [
  { slug: "maintenance-industrielle", label: "Maintenance industrielle" },
  { slug: "fournitures-industrielles", label: "Fournitures industrielles" },
  { slug: "sous-traitance-industrielle", label: "Sous-traitance industrielle" },
  { slug: "informatique", label: "Informatique professionnelle" },
  { slug: "cybersecurite", label: "Cybersécurité" },
  { slug: "services-aux-entreprises", label: "Services aux entreprises" },
  { slug: "transport-logistique", label: "Transport et logistique" },
  { slug: "electricite-automatisme", label: "Électricité industrielle et automatisme" },
  { slug: "energie", label: "Énergie" },
  { slug: "batiment-technique", label: "Bâtiment technique" },
  { slug: "ingenierie-etudes", label: "Ingénierie et bureaux d'études" },
  { slug: "telecoms", label: "Télécoms et réseaux" },
  { slug: "nettoyage-proprete", label: "Nettoyage et propreté" },
  { slug: "securite-surete", label: "Sécurité et sûreté" },
  { slug: "formation", label: "Formation professionnelle" },
  { slug: "conseil", label: "Conseil aux entreprises" },
  { slug: "travaux-btp", label: "Travaux publics et bâtiment" },
  { slug: "espaces-verts", label: "Espaces verts et paysage" },
  { slug: "assurances-finance", label: "Assurances et services financiers" },
  { slug: "communication-evenementiel", label: "Communication et événementiel" },
  { slug: "restauration-alimentation", label: "Restauration et alimentation" },
] as const;

/**
 * Libellés par défaut. La liste de référence est la table `sectors` (gérée
 * dans l'administration) : voir getSectors() ; ces libellés servent de repli.
 */
export const SECTOR_LABELS: Record<string, string> = Object.fromEntries(SECTORS.map((s) => [s.slug, s.label]));

export type SectorOption = { slug: string; label: string };

export function sectorLabel(slug: string | null | undefined, labels: Record<string, string> = SECTOR_LABELS): string {
  if (!slug) return "—";
  return labels[slug] ?? SECTOR_LABELS[slug] ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const BRITTANY_DEPARTMENTS = [
  { code: "29", name: "Finistère", slug: "finistere" },
  { code: "22", name: "Côtes-d'Armor", slug: "cotes-d-armor" },
  { code: "56", name: "Morbihan", slug: "morbihan" },
  { code: "35", name: "Ille-et-Vilaine", slug: "ille-et-vilaine" },
] as const;

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  NEED: "Besoin",
  QUOTE_REQUEST: "Demande de devis",
  PRIVATE_CONSULTATION: "Consultation privée",
  PRIVATE_TENDER: "Appel d'offres privé",
  EXTERNAL_OPPORTUNITY: "Opportunité externe",
  PUBLIC_TENDER: "Marché public",
};

export const INTERNAL_TYPES: OpportunityType[] = ["NEED", "QUOTE_REQUEST", "PRIVATE_CONSULTATION", "PRIVATE_TENDER"];
export const EXTERNAL_TYPES: OpportunityType[] = ["EXTERNAL_OPPORTUNITY", "PUBLIC_TENDER"];

export const OPPORTUNITY_TYPE_HELP: Record<OpportunityType, string> = {
  NEED: "Vous recherchez un prestataire ou un fournisseur, sans formalisme particulier.",
  QUOTE_REQUEST: "Vous souhaitez recevoir plusieurs propositions chiffrées.",
  PRIVATE_CONSULTATION: "Consultation structurée auprès de plusieurs fournisseurs, avec critères et date limite.",
  PRIVATE_TENDER: "Appel d'offres formalisé : cahier des charges, documents, critères, présélection et sélection.",
  EXTERNAL_OPPORTUNITY: "Opportunité référencée depuis une source extérieure.",
  PUBLIC_TENDER: "Marché public référencé depuis une source publique autorisée.",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente de validation",
  CHANGES_REQUESTED: "Modifications demandées",
  REJECTED: "Refusée",
  PUBLISHED: "Publiée",
  CLOSED: "Clôturée",
  EXPIRED: "Expirée",
  SUSPENDED: "Suspendue",
  ARCHIVED: "Archivée",
};

export const PIPELINE_STAGES: { stage: PipelineStage; label: string }[] = [
  { stage: "DETECTED", label: "Détectée" },
  { stage: "QUALIFIED", label: "Qualifiée" },
  { stage: "INTERESTED", label: "Intérêt manifesté" },
  { stage: "RESPONSE_PREPARING", label: "Réponse en préparation" },
  { stage: "RESPONSE_SENT", label: "Réponse envoyée" },
  { stage: "DISCUSSION", label: "Discussion" },
  { stage: "NEGOTIATION", label: "Négociation" },
  { stage: "WON", label: "Gagnée" },
  { stage: "LOST", label: "Perdue" },
];
export const PIPELINE_LABELS = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.stage, s.label])) as Record<
  PipelineStage,
  string
>;

export const INTEREST_STATUS_LABELS: Record<InterestStatus, string> = {
  PENDING: "En attente",
  SHORTLISTED: "Présélectionné",
  INFO_REQUESTED: "Informations demandées",
  ACCEPTED: "Accepté",
  DECLINED: "Décliné",
  WITHDRAWN: "Retiré",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  SUBMITTED: "Reçue",
  SHORTLISTED: "Présélectionnée",
  INFO_REQUESTED: "Informations demandées",
  SELECTED: "Retenue",
  DECLINED: "Non retenue",
  WITHDRAWN: "Retirée",
};

export const COMPANY_KIND_LABELS: Record<CompanyKind, string> = {
  SUPPLIER: "Fournisseur / prestataire",
  BUYER: "Entreprise demandeuse",
  BOTH: "Demandeur et fournisseur",
};

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  INDEPENDANT: "Indépendant",
  TPE: "TPE (moins de 10 salariés)",
  PME: "PME (10 à 249 salariés)",
  ETI: "ETI (250 à 4 999 salariés)",
  GE: "Grande entreprise",
};

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  COMPANY_ADMIN: "Administrateur",
  COMPANY_MEMBER: "Membre",
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  USER: "Utilisateur",
  MODERATOR: "Modérateur",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super administrateur",
};

export const ALERT_FREQUENCY_LABELS: Record<AlertFrequency, string> = {
  IMMEDIATE: "Immédiate",
  DAILY: "Quotidienne",
  WEEKLY: "Hebdomadaire",
};

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  DRAFT: "Brouillon",
  LEGAL_REVIEW: "Validation juridique en cours",
  APPROVED: "Approuvée",
  SUSPENDED: "Suspendue",
  REJECTED: "Refusée",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Ouvert",
  REVIEWING: "En cours",
  RESOLVED: "Résolu",
  DISMISSED: "Classé sans suite",
};

export const REPORT_REASONS: Record<string, string> = {
  SPAM: "Spam ou publicité",
  FRAUD: "Fraude ou arnaque",
  INAPPROPRIATE: "Contenu inapproprié",
  FALSE_INFO: "Informations fausses ou trompeuses",
  COPYRIGHT: "Droits d'auteur / réutilisation non autorisée",
  OTHER: "Autre",
};

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  OPPORTUNITY: "Opportunité",
  COMPANY: "Entreprise",
  MESSAGE: "Message",
  USER: "Utilisateur",
  PROPOSAL: "Réponse",
};

export const OUTCOME_LABELS: Record<OpportunityOutcome, string> = {
  AWARDED: "Attribuée à un fournisseur",
  NOT_AWARDED: "Non attribuée",
  CANCELLED: "Annulée",
  UNKNOWN: "Non communiqué",
};

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  VERIFIED: "Vérifiée",
  UNVERIFIABLE: "Non vérifiable",
  REMOVED_AT_SOURCE: "Retirée de la source",
};

export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.oasis.opendocument.text": "ODT",
  "application/vnd.oasis.opendocument.spreadsheet": "ODS",
};
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const PAGE_SIZE = 12;
