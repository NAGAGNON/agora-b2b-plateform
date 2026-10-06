/**
 * Guides pratiques rédigés pour LinkProB2B. Conseils généraux — aucun chiffre,
 * témoignage ou cas client n'est inventé.
 */
export type Guide = { slug: string; title: string; description: string; audience: "Demandeurs" | "Fournisseurs" | "Tous"; sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[] };

export const GUIDES: Guide[] = [
  {
    slug: "rediger-un-cahier-des-charges",
    title: "Rédiger un cahier des charges clair",
    description: "Les rubriques indispensables pour obtenir des réponses comparables de vos fournisseurs.",
    audience: "Demandeurs",
    sections: [
      { heading: "Pourquoi c'est important", paragraphs: ["Un besoin bien décrit permet aux fournisseurs de répondre vite et précisément, et à vous de comparer des offres homogènes. Les imprécisions se paient en échanges supplémentaires, en devis difficiles à comparer et en avenants."] },
      { heading: "Les rubriques à prévoir", bullets: ["Contexte : votre activité, le site concerné, ce qui motive le besoin.", "Périmètre : ce qui est inclus et ce qui ne l'est pas.", "Exigences techniques : équipements, normes, habilitations requises.", "Contraintes : horaires d'intervention, accès au site, règles de sécurité, continuité de production.", "Calendrier : date de démarrage souhaitée, jalons, date limite de réponse.", "Critères de sélection et leur pondération (prix, délai, références, méthodologie…).", "Format de réponse attendu : décomposition du prix, planning, pièces à fournir."] },
      { heading: "Conseils pratiques", bullets: ["Joignez plans, photos et références d'équipements : ils évitent de nombreuses questions.", "Indiquez un budget ou une fourchette si possible : vous recevrez des propositions réalistes.", "Prévoyez un délai de réponse raisonnable au regard de la complexité du besoin.", "Sur LinkProB2B, les documents ne sont visibles que par les membres connectés."] },
    ],
  },
  {
    slug: "choisir-un-prestataire-de-maintenance",
    title: "Choisir un prestataire de maintenance industrielle",
    description: "Points de vigilance pour sélectionner un partenaire de maintenance préventive ou curative.",
    audience: "Demandeurs",
    sections: [
      { heading: "Définir le type de contrat", paragraphs: ["Maintenance préventive planifiée, curative à la demande, contrat avec astreinte : chaque formule implique des engagements différents. Précisez le niveau de service attendu (délai d'intervention, plages horaires, pièces incluses ou non)."] },
      { heading: "Vérifier les capacités", bullets: ["Compétences sur vos équipements et technologies (mécanique, hydraulique, électricité, automatismes…).", "Habilitations et formations du personnel intervenant.", "Zone et délai d'intervention réalistes au regard de votre implantation.", "Assurances professionnelles adaptées.", "Références sur des équipements comparables, que vous pouvez vérifier."] },
      { heading: "Comparer les offres", paragraphs: ["Comparez à périmètre identique : nombre de visites, pièces et consommables, déplacements, rapports d'intervention. Sur LinkProB2B, l'onglet « Comparer » d'une consultation aligne prix, délais et validité des réponses reçues, et vous pouvez noter chaque réponse en interne."] },
    ],
  },
  {
    slug: "repondre-a-une-consultation",
    title: "Répondre efficacement à une consultation privée",
    description: "Méthode pour qualifier une opportunité et construire une réponse convaincante.",
    audience: "Fournisseurs",
    sections: [
      { heading: "Qualifier avant de répondre", bullets: ["Le besoin correspond-il à votre cœur de métier ?", "La localisation et le calendrier sont-ils compatibles avec vos ressources ?", "Les critères de sélection sont-ils à votre avantage ?", "Avez-vous des références comparables à présenter ?"], paragraphs: ["Le pipeline LinkProB2B vous aide à suivre cette qualification : Détectée → Qualifiée → Intérêt manifesté → Réponse en préparation → Réponse envoyée."] },
      { heading: "Construire la réponse", bullets: ["Reformulez le besoin pour montrer que vous l'avez compris.", "Répondez point par point aux critères annoncés.", "Décomposez le prix et précisez ce qui est inclus.", "Indiquez un délai réaliste et la durée de validité de l'offre.", "Joignez les pièces utiles : références, attestations, fiches techniques."] },
      { heading: "Après l'envoi", paragraphs: ["Restez disponible : le demandeur peut vous demander des informations complémentaires via la messagerie. Mettez à jour votre pipeline (discussion, négociation, gagnée ou perdue) pour garder une vision claire de votre activité commerciale."] },
    ],
  },
  {
    slug: "opportunites-externes-et-marches-publics",
    title: "Opportunités externes et marchés publics : comment les lire",
    description: "Ce que signifie une opportunité « externe » sur LinkProB2B et comment y répondre.",
    audience: "Tous",
    sections: [
      { heading: "Deux types d'annonces, toujours distingués", paragraphs: ["Un « Besoin publié sur LinkProB2B » est déposé par une entreprise membre : vous y répondez directement sur la plateforme. Une « Opportunité externe » est référencée depuis une source extérieure (site d'un partenaire, publication officielle) : LinkProB2B n'en est pas l'auteur."] },
      { heading: "Comment répondre à une opportunité externe", bullets: ["Consultez la fiche : source, référence, date de publication et date de dernière vérification sont indiquées.", "Cliquez sur « Consulter l'annonce sur le site source » : les conditions et la candidature se trouvent sur ce site.", "Vérifiez toujours la date limite et les pièces exigées directement sur la source officielle."] },
      { heading: "Nos règles", paragraphs: ["Une source externe n'est référencée qu'après validation de ses conditions de réutilisation. Nous privilégions un résumé rédigé et un lien vers l'annonce originale plutôt qu'une copie intégrale. Si une annonce est retirée ou erronée, signalez-la : elle sera vérifiée et, si besoin, retirée."] },
    ],
  },
];
