/**
 * Guides pratiques rédigés pour LinkProB2B. Conseils généraux — aucun chiffre,
 * témoignage ou cas client n'est inventé.
 */
export type Guide = { slug: string; title: string; description: string; audience: "Demandeurs" | "Fournisseurs" | "Tous"; sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[]; faq?: { question: string; answer: string }[] };

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
      { heading: "Comment répondre à une opportunité externe", bullets: ["Consultez la fiche : source, référence, date de publication et date de dernière vérification sont indiquées.", "Cliquez sur « Consulter l'annonce originale » : les conditions et la candidature se trouvent sur ce site.", "Vérifiez toujours la date limite et les pièces exigées directement sur la source officielle."] },
      { heading: "Nos règles", paragraphs: ["Une source externe n'est référencée qu'après validation de ses conditions de réutilisation. Nous privilégions un résumé rédigé et un lien vers l'annonce originale plutôt qu'une copie intégrale. Si une annonce est retirée ou erronée, signalez-la : elle sera vérifiée et, si besoin, retirée."] },
    ],
  },
  {
    slug: "repondre-appel-d-offres-artisan",
    title: "Répondre à un appel d'offres quand on est artisan ou petite entreprise",
    description: "Les étapes, en mots simples, pour répondre à un marché public pour la première fois : où trouver les offres, quoi préparer, où déposer.",
    audience: "Fournisseurs",
    sections: [
      { heading: "C'est possible, même seul", paragraphs: ["Les marchés publics ne sont pas réservés aux grandes entreprises. Beaucoup sont découpés en lots (des parties du marché) pour que les petites entreprises puissent répondre à une seule partie. Le dossier se télécharge gratuitement sur le site de l'acheteur."] },
      { heading: "Les 6 étapes", bullets: ["Vérifier que vous pouvez répondre : certifications, chiffre d'affaires minimum, assurances.", "Télécharger le dossier sur le site de l'acheteur, en créant un compte pour être prévenu des changements.", "Poser vos questions avant la date limite des questions, et faire la visite si elle est obligatoire.", "Rassembler les pièces : souvent le DUME (formulaire de candidature en ligne) ou les formulaires DC1 et DC2, un extrait Kbis, les attestations URSSAF et impôts, l'attestation d'assurance.", "Rédiger votre réponse : le mémoire technique (le document où vous expliquez comment vous ferez le travail) et vos prix.", "Déposer en ligne avant la date et l'heure limites : une offre arrivée en retard n'est pas lue."] },
      { heading: "Comment LinkProB2B vous aide", paragraphs: ["Chaque appel d'offres a une fiche en langage simple : ce que veut l'acheteur, les conditions, les pièces, la notation et où déposer. Le bouton « En savoir plus » ouvre un guide étape par étape, avec un planning jusqu'à la date limite."] },
    ],
    faq: [
      { question: "Faut-il payer pour répondre à un marché public ?", answer: "Non. Le dossier se télécharge gratuitement sur le site de l'acheteur et l'offre s'y dépose en ligne." },
      { question: "Il me manque une certification : puis-je quand même répondre ?", answer: "Souvent oui, avec une autre entreprise (groupement) ou en lui confiant une partie du travail (sous-traitance). Lisez les conditions du règlement de la consultation." },
      { question: "Où trouver les appels d'offres de mon métier près de chez moi ?", answer: "Sur LinkProB2B, les appels d'offres publics (BOAMP, TED) sont classés par métier, région et département, mis à jour chaque jour, avec des alertes gratuites par e-mail." },
    ],
  },
  {
    slug: "trouver-un-sous-traitant-ou-un-partenaire",
    title: "Trouver un sous-traitant ou un partenaire pour répondre à un marché",
    description: "Groupement, sous-traitance, disponibilités : comment s'associer à une autre entreprise pour répondre à plusieurs.",
    audience: "Tous",
    sections: [
      { heading: "Deux façons de répondre à plusieurs", bullets: ["Le groupement : plusieurs entreprises répondent ensemble à un même marché. L'une d'elles est le mandataire (elle représente les autres).", "La sous-traitance : vous répondez seul et vous confiez une partie du travail à une autre entreprise, déclarée à l'acheteur."] },
      { heading: "Trouver la bonne entreprise", bullets: ["Cherchez dans l'annuaire par métier et par département.", "Consultez les entreprises disponibles : elles annoncent ce qu'elles peuvent faire, où et à partir de quand.", "Depuis un appel d'offres, le bouton « Trouver un partenaire » publie votre besoin auprès des entreprises du métier dans la zone."] },
      { heading: "Avant de vous engager", bullets: ["Vérifiez les assurances et les qualifications de votre partenaire.", "Mettez par écrit qui fait quoi, et comment le prix est partagé.", "Gardez du temps avant la date limite pour rassembler les pièces des deux entreprises."] },
    ],
    faq: [
      { question: "Quelle différence entre groupement et sous-traitance ?", answer: "En groupement, les entreprises répondent ensemble et signent toutes le marché. En sous-traitance, une seule entreprise signe et confie une partie du travail à une autre, déclarée à l'acheteur." },
      { question: "Comment trouver une entreprise disponible dans mon département ?", answer: "La page « Disponibilités » de LinkProB2B liste les entreprises qui annoncent ce qu'elles peuvent faire, filtrables par métier et par département. Vous leur écrivez par la messagerie." },
    ],
  },
  {
    slug: "mots-des-marches-publics",
    title: "Les mots des marchés publics, expliqués simplement",
    description: "DUME, DC1, Kbis, BPU, DPGF, mémoire technique, accord-cadre… le vocabulaire des appels d'offres traduit en mots de tous les jours.",
    audience: "Tous",
    sections: [
      { heading: "Les documents de l'acheteur", bullets: ["Règlement de la consultation : le document qui fixe les règles (pièces à fournir, notation, date limite).", "Cahier des charges (CCTP) : la description détaillée du travail demandé.", "DCE (dossier de consultation des entreprises) : l'ensemble des documents à télécharger."] },
      { heading: "Les pièces de votre candidature", bullets: ["DUME : formulaire de candidature en ligne.", "DC1 et DC2 : formulaires de candidature (lettre de candidature et présentation de l'entreprise).", "Kbis : extrait d'immatriculation de l'entreprise.", "Attestations URSSAF et fiscales : la preuve que vous êtes à jour de vos cotisations et impôts."] },
      { heading: "Votre offre", bullets: ["Mémoire technique : le document où vous expliquez comment vous ferez le travail.", "BPU (bordereau des prix unitaires) : la liste des prix à l'unité à remplir.", "DPGF (décomposition du prix global et forfaitaire) : le tableau des prix à remplir pour un prix fixe."] },
      { heading: "Les types de marchés", bullets: ["Accord-cadre : contrat de plusieurs années, le travail est commandé au fur et à mesure.", "Bons de commande : les commandes passées au fur et à mesure dans un accord-cadre.", "Lot : une partie du marché, on peut répondre à un seul lot.", "Variante : une autre solution que celle demandée, seulement si l'acheteur l'autorise."] },
    ],
  },
  {
    slug: "annoncer-ses-disponibilites",
    title: "Trouver des clients en annonçant ses disponibilités",
    description: "Une équipe libre le mois prochain ? Annoncez ce que vous pouvez faire, où et quand : les entreprises qui cherchent un prestataire vous écrivent.",
    audience: "Fournisseurs",
    sections: [
      { heading: "Le principe", paragraphs: ["Une disponibilité, c'est l'inverse d'un besoin : au lieu de chercher une entreprise, vous dites ce que la vôtre peut faire. Les entreprises qui cherchent un prestataire dans votre métier et votre zone vous trouvent et vous écrivent par la messagerie."] },
      { heading: "Une bonne annonce", bullets: ["Un titre clair : « Électricien disponible pour vos chantiers à Brest ».", "Ce que vous faites, pour qui, et ce qui vous distingue.", "Votre zone : un département ou toute la France.", "Vos dates : à partir de quand, et jusqu'à quand si vous le savez.", "Vos moyens : nombre d'équipes, matériel."] },
      { heading: "Bon à savoir", bullets: ["C'est gratuit et en ligne tout de suite, pour 60 jours, prolongeable.", "Pas de téléphone ni d'e-mail dans le texte : les échanges passent par la messagerie, vous êtes prévenu par e-mail.", "Vous pouvez annoncer jusqu'à 5 disponibilités en même temps."] },
    ],
  },
];