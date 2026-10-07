/**
 * Informations légales de l'éditeur — À COMPLÉTER AVANT LE LANCEMENT COMMERCIAL.
 *
 * Aucune de ces informations n'a été inventée : tant qu'une valeur vaut TODO, les pages
 * légales affichent « [À COMPLÉTER : …] ». Pour compléter, remplacez la valeur ci-dessous
 * (par exemple `companyName: "LinkProB2B SAS"`), puis redéployez.
 *
 * Liste des éléments à fournir (documents officiels : Kbis / avis de situation INSEE) :
 *  - companyName        dénomination sociale exacte (ou nom et prénom pour un entrepreneur individuel)
 *  - legalForm          forme juridique (SAS, SARL, EI…)
 *  - shareCapital       capital social (sociétés uniquement)
 *  - address            adresse du siège social / de l'établissement
 *  - siret              numéro SIRET (14 chiffres)
 *  - rcs                immatriculation RCS (ville + numéro) ou RNE
 *  - vatNumber          numéro de TVA intracommunautaire
 *  - publicationDirector nom du directeur de la publication
 *  - contactEmail       adresse e-mail de contact légal
 *  - phone              téléphone (recommandé pour les professionnels)
 *  - supabaseRegion     région d'hébergement de la base Supabase (tableau de bord Supabase → Settings → General)
 *  - jurisdiction       tribunal compétent (ex. « tribunaux du ressort de la cour d'appel de Rennes »)
 *  - mediator           médiateur de la consommation, uniquement si des particuliers peuvent souscrire (ici : service réservé aux professionnels)
 */

const TODO = null;

export const LEGAL = {
  brand: "LinkProB2B",
  website: "https://www.linkprob2b.com",
  companyName: TODO as string | null,
  legalForm: TODO as string | null,
  shareCapital: TODO as string | null,
  address: TODO as string | null,
  siret: TODO as string | null,
  rcs: TODO as string | null,
  vatNumber: TODO as string | null,
  publicationDirector: TODO as string | null,
  contactEmail: TODO as string | null,
  phone: TODO as string | null,
  supabaseRegion: TODO as string | null,
  jurisdiction: TODO as string | null,
  lastUpdated: "7 octobre 2026",
};

/** Valeur légale ou mention « [À COMPLÉTER : libellé] » si elle n'est pas encore renseignée. */
export function legalValue(value: string | null | undefined, label: string): string {
  return value?.trim() ? value : `[À COMPLÉTER : ${label}]`;
}

/** Vrai tant que les informations d'identification de l'éditeur ne sont pas toutes renseignées. */
export function legalIncomplete(): boolean {
  return [LEGAL.companyName, LEGAL.legalForm, LEGAL.address, LEGAL.siret, LEGAL.publicationDirector, LEGAL.contactEmail].some((v) => !v?.trim());
}

/**
 * Prestataires réellement utilisés par l'application (vérifié dans le code) :
 * hébergement, base de données, e-mails, paiement, rédaction assistée, statistiques.
 */
export const PROCESSORS = [
  {
    name: "Vercel Inc.",
    role: "Hébergement de l'application et statistiques de fréquentation agrégées (Vercel Web Analytics, sans cookie)",
    data: "Requêtes techniques (adresse IP, navigateur) le temps de leur traitement ; pages consultées de manière agrégée",
    location: "États-Unis (réseau mondial) — clauses contractuelles types de la Commission européenne",
    url: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Supabase, Inc.",
    role: "Base de données, authentification (comptes et sessions) et stockage des fichiers déposés",
    data: "Ensemble des données du service (comptes, entreprises, publications, messages, documents)",
    location: "Région d'hébergement : voir ci-dessous — clauses contractuelles types",
    url: "https://supabase.com/privacy",
  },
  {
    name: "Resend (Plus Five Five, Inc.)",
    role: "Envoi des e-mails transactionnels (confirmation d'inscription, mot de passe, notifications, alertes)",
    data: "Adresse e-mail, nom, contenu de l'e-mail",
    location: "États-Unis — clauses contractuelles types",
    url: "https://resend.com/legal/privacy-policy",
  },
  {
    name: "Stripe",
    role: "Paiement des abonnements, factures, portail de gestion de l'abonnement",
    data: "Nom de l'entreprise, adresse e-mail, adresse de facturation, numéro de TVA le cas échéant, données de carte (saisies et conservées par Stripe uniquement)",
    location: "Stripe Payments Europe, Ltd. (Irlande) et ses sous-traitants",
    url: "https://stripe.com/fr/privacy",
  },
  {
    name: "Anthropic, PBC",
    role: "Aide à la rédaction des « Analyses des marchés » à partir de statistiques sur les opportunités publiées",
    data: "Aucune donnée de compte ni donnée personnelle des utilisateurs : uniquement des chiffres agrégés et des informations d'avis publics",
    location: "États-Unis",
    url: "https://www.anthropic.com/legal/privacy",
  },
] as const;
