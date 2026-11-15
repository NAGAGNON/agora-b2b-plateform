/**
 * Guide de réponse à un marché public, étape par étape (règles générales de la commande publique ;
 * le règlement de la consultation de chaque marché fait foi). Les étapes cochées sont enregistrées
 * dans le suivi de la candidature (pipeline_items.guide_done).
 */
export type GuideStep = { title: string; how: string[] };

export const APPLICATION_GUIDE: GuideStep[] = [
  {
    title: "Vérifier que vous pouvez candidater",
    how: [
      "Relisez les conditions de la fiche : certifications ou qualifications exigées, chiffre d'affaires minimum, références, assurances.",
      "S'il vous manque une exigence, vous pouvez répondre à plusieurs : en groupement avec une autre entreprise ou en faisant appel à un sous-traitant.",
      "Ajoutez vos certifications à votre fiche entreprise : LinkProB2B les compare automatiquement aux exigences de chaque marché.",
    ],
  },
  {
    title: "Télécharger le dossier de consultation",
    how: [
      "Le dossier complet (règlement de la consultation, cahier des charges, documents de prix) se télécharge sur la plateforme de l'acheteur, indiquée dans la fiche.",
      "Créez un compte sur cette plateforme et téléchargez en étant identifié : vous serez prévenu des modifications et des réponses aux questions.",
      "Lisez d'abord le règlement de la consultation : il précise les pièces à remettre, les critères de notation et la date limite.",
    ],
  },
  {
    title: "Poser vos questions et faire la visite",
    how: [
      "Une question sur le dossier ? Posez-la sur la plateforme de l'acheteur, avant la date limite fixée pour les questions.",
      "Si la visite est obligatoire, inscrivez-vous à temps et gardez l'attestation de visite : sans elle, l'offre peut être écartée.",
    ],
  },
  {
    title: "Rassembler les pièces administratives",
    how: [
      "Le règlement de la consultation liste les pièces demandées : souvent le DUME (ou les formulaires DC1 et DC2), un extrait Kbis, les attestations sociales et fiscales et l'attestation d'assurance.",
      "Vérifiez que chaque attestation est à jour, et signez les documents demandés.",
    ],
  },
  {
    title: "Rédiger le mémoire technique et chiffrer l'offre",
    how: [
      "Reprenez les critères de notation un par un : chaque partie du mémoire technique doit répondre à un critère, dans le même ordre.",
      "Soyez concret : méthode, planning, moyens humains et matériels, références similaires, mesures de sécurité et d'environnement demandées.",
      "Remplissez les documents de prix fournis par l'acheteur sans les modifier, et relisez les totaux.",
    ],
  },
  {
    title: "Déposer l'offre avant la date limite",
    how: [
      "Le dépôt se fait sur la plateforme de l'acheteur. N'attendez pas la dernière heure : l'envoi de fichiers lourds peut être long.",
      "Une offre reçue après l'heure limite n'est pas examinée.",
      "Conservez l'accusé de réception du dépôt, puis indiquez ici « Réponse envoyée ».",
    ],
  },
];

/** Conseils après une réponse non retenue. */
export const LOST_ADVICE = [
  "L'acheteur doit vous informer du rejet de votre offre et de ses motifs. Vous pouvez lui demander des précisions : le nom de l'entreprise retenue et les points forts et faibles de votre offre.",
  "Ces retours sont précieux pour améliorer votre prochain mémoire technique.",
  "Restez visible auprès de cet acheteur : suivez-le sur LinkProB2B pour être prévenu de ses prochains marchés.",
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
