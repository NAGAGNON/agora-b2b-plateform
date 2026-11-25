/**
 * Guide de réponse à un marché public, étape par étape (règles générales de la commande publique ;
 * le règlement de la consultation de chaque marché fait foi). Les étapes cochées sont enregistrées
 * dans le suivi de la candidature (pipeline_items.guide_done).
 */
export type GuideStep = { title: string; how: string[] };

export const APPLICATION_GUIDE: GuideStep[] = [
  {
    title: "Vérifier votre éligibilité",
    how: [
      "Pour chaque condition de l'acheteur, indiquez si vous l'avez, s'il vous manque quelque chose ou s'il faut vérifier.",
      "Il vous manque quelque chose ? Répondez avec une autre entreprise (groupement) ou confiez-lui une partie du travail (sous-traitance).",
      "Vous restez seul juge : LinkProB2B ne déclare jamais une entreprise éligible à sa place.",
    ],
  },
  {
    title: "Comprendre le besoin de l'acheteur",
    how: [
      "Téléchargez le dossier complet sur le site de l'acheteur (bouton « Voir l'annonce officielle ») et lisez d'abord le règlement de la consultation (le document qui fixe les règles).",
      "Une question ? Posez-la sur le site de l'acheteur, avant la date limite des questions.",
      "Visite obligatoire ? Inscrivez-vous à temps et gardez l'attestation de visite : sans elle, votre offre peut être refusée.",
    ],
  },
  {
    title: "Évaluer vos capacités",
    how: [
      "Faites le point sur vos moyens : équipe, matériel, trésorerie, délais.",
      "Un point faible ? Pensez à un partenaire ou à un sous-traitant avant de vous lancer.",
    ],
  },
  {
    title: "Rassembler les documents",
    how: [
      "Le règlement de la consultation donne la liste exacte. Souvent : le DUME (formulaire de candidature en ligne) ou les formulaires DC1 et DC2, un extrait Kbis, les attestations URSSAF et impôts, l'attestation d'assurance.",
      "Vérifiez que chaque attestation est à jour, puis signez les documents demandés.",
    ],
  },
  {
    title: "Préparer votre offre",
    how: [
      "Le mémoire technique, c'est le document où vous expliquez comment vous ferez le travail. Suivez les critères de notation, dans le même ordre.",
      "Soyez concret : méthode, planning, équipe, matériel, chantiers du même type déjà réalisés.",
      "Remplissez les tableaux de prix de l'acheteur sans les modifier, puis vérifiez les totaux.",
    ],
  },
  {
    title: "Organiser et déposer votre candidature",
    how: [
      "Déposez sur le site de l'acheteur. N'attendez pas la dernière heure : l'envoi des fichiers peut être long.",
      "Une offre arrivée après l'heure limite n'est pas lue.",
      "Gardez l'accusé de réception, puis indiquez ici la date et la référence du dépôt.",
    ],
  },
];

/** Conseils après une réponse non retenue. */
export const LOST_ADVICE = [
  "L'acheteur doit vous dire pourquoi votre offre n'a pas été choisie. Demandez-lui le nom de l'entreprise retenue et les points forts et faibles de votre offre.",
  "Ces retours vous aideront à faire mieux la prochaine fois.",
  "Suivez cet acheteur sur LinkProB2B : vous serez prévenu de ses prochains appels d'offres.",
];

type TemplateInput = { title: string; buyer: string | null; reference: string | null; company: string };

/** Modèle de question à poser à l'acheteur (sur sa plateforme, avant la date limite des questions). */
export function questionTemplate(t: TemplateInput) {
  return [
    "Objet : Question sur la consultation" + (t.reference ? ` n° ${t.reference}` : ""),
    "",
    "Madame, Monsieur,",
    "",
    `Dans le cadre de la consultation « ${t.title} »${t.buyer ? ` publiée par ${t.buyer}` : ""}, nous souhaiterions obtenir une précision :`,
    "",
    "[Votre question, précise et courte. Une question par point : quantités, accès au site, planning, documents attendus…]",
    "",
    "Nous vous remercions par avance pour votre réponse.",
    "",
    "Cordialement,",
    t.company,
  ].join("\n");
}

/** Modèle de demande des motifs du rejet d'une offre. */
/** Relance polie de l'acheteur, plusieurs semaines après le dépôt, sans nouvelles. */
export function followUpTemplate(t: TemplateInput) {
  return [
    "Objet : Suivi de notre offre" + (t.reference ? ` (consultation n° ${t.reference})` : ""),
    "",
    "Madame, Monsieur,",
    "",
    `Nous avons déposé notre offre pour la consultation « ${t.title} » et restons pleinement disponibles pour toute question ou précision utile à son analyse.`,
    "Pourriez-vous nous indiquer, si possible, à quelle date la décision est attendue ?",
    "",
    "Nous vous remercions par avance.",
    "",
    "Cordialement,",
    t.company,
  ].join("\n");
}

export function rejectionTemplate(t: TemplateInput) {
  return [
    "Objet : Demande d'informations sur le rejet de notre offre" + (t.reference ? ` (consultation n° ${t.reference})` : ""),
    "",
    "Madame, Monsieur,",
    "",
    `Nous avons été informés que notre offre pour la consultation « ${t.title} » n'a pas été retenue.`,
    "Afin de progresser, nous vous serions reconnaissants de bien vouloir nous communiquer les motifs de ce rejet, le nom de l'entreprise retenue, ainsi que les caractéristiques et avantages de l'offre retenue et, si possible, les notes obtenues par notre offre sur chaque critère.",
    "",
    "Nous vous remercions par avance.",
    "",
    "Cordialement,",
    t.company,
  ].join("\n");
}
