/**
 * Référentiel « quel type d'entreprise est concerné par quel besoin ».
 *  - SECTOR_PROFILES : pour chaque secteur LinkProB2B, profils d'entreprises
 *    concernés et codes NAF (nomenclature d'activités française, INSEE).
 *  - NEED_RULES : règles plus fines, déclenchées par le texte réel de
 *    l'opportunité (titre, résumé, description, compétences). Elles désignent
 *    les métiers les plus directement concernés.
 * Les règles sont explicables : chaque correspondance peut être justifiée.
 */
export type Profile = { profiles: string[]; naf: string[] };

export const SECTOR_PROFILES: Record<string, Profile> = {
  "maintenance-industrielle": {
    profiles: ["Entreprises de maintenance industrielle", "Réparateurs de machines et équipements", "Installateurs d'équipements industriels"],
    naf: ["33.11Z", "33.12Z", "33.13Z", "33.14Z", "33.17Z", "33.19Z", "33.20A", "33.20B", "33.20C", "33.20D"],
  },
  "fournitures-industrielles": {
    profiles: ["Distributeurs de fournitures industrielles", "Grossistes en équipements et matériels"],
    naf: ["46.69A", "46.69B", "46.69C", "46.62Z", "46.63Z", "46.74A", "46.74B", "46.14Z"],
  },
  "sous-traitance-industrielle": {
    profiles: ["Ateliers d'usinage", "Chaudronniers et soudeurs", "Sous-traitants mécaniques"],
    naf: ["25.62A", "25.62B", "25.11Z", "25.12Z", "25.29Z", "25.61Z", "28.99B"],
  },
  informatique: {
    profiles: ["ESN (entreprises de services du numérique)", "Éditeurs de logiciels", "Développeurs et agences web", "Sociétés d'infogérance"],
    naf: ["62.01Z", "62.02A", "62.02B", "62.03Z", "62.09Z", "63.11Z", "58.29C", "58.29A"],
  },
  cybersecurite: {
    profiles: ["Sociétés de cybersécurité", "ESN spécialisées en sécurité informatique"],
    naf: ["62.02A", "62.02B", "62.09Z", "62.03Z"],
  },
  "services-aux-entreprises": {
    profiles: ["Sociétés de services administratifs", "Entreprises de services aux entreprises"],
    naf: ["82.11Z", "82.19Z", "82.99Z", "78.10Z", "78.20Z"],
  },
  "transport-logistique": {
    profiles: ["Transporteurs routiers", "Entreprises de logistique", "Déménageurs", "Coursiers et messagerie"],
    naf: ["49.41A", "49.41B", "49.41C", "49.42Z", "52.10B", "52.29A", "52.29B", "53.20Z", "49.39A"],
  },
  "electricite-automatisme": {
    profiles: ["Électriciens", "Entreprises d'installation électrique", "Automaticiens", "Bureaux d'études électricité"],
    naf: ["43.21A", "43.21B", "27.12Z", "33.14Z", "71.12B"],
  },
  energie: {
    profiles: ["Installateurs photovoltaïques et énergies renouvelables", "Exploitants de chauffage et d'énergie", "Fournisseurs d'énergie"],
    naf: ["35.11Z", "35.14Z", "35.30Z", "43.21A", "43.22B"],
  },
  "batiment-technique": {
    profiles: ["Plombiers et chauffagistes", "Entreprises de génie climatique (CVC)", "Entreprises multitechniques"],
    naf: ["43.22A", "43.22B", "43.29A", "43.29B", "33.12Z"],
  },
  "ingenierie-etudes": {
    profiles: ["Bureaux d'études techniques", "Maîtres d'œuvre et architectes", "Contrôleurs techniques"],
    naf: ["71.12B", "71.12A", "71.11Z", "71.20B", "74.90B"],
  },
  telecoms: {
    profiles: ["Opérateurs et intégrateurs télécoms", "Installateurs de fibre et réseaux"],
    naf: ["61.10Z", "61.20Z", "61.90Z", "42.22Z", "43.21A"],
  },
  "nettoyage-proprete": {
    profiles: ["Entreprises de nettoyage", "Sociétés de propreté", "Entreprises multiservices", "Entreprises de collecte et traitement des déchets"],
    naf: ["81.21Z", "81.22Z", "81.29A", "81.29B", "81.10Z", "38.11Z"],
  },
  "securite-surete": {
    profiles: ["Sociétés de gardiennage et de surveillance", "Installateurs de systèmes de sécurité"],
    naf: ["80.10Z", "80.20Z", "80.30Z"],
  },
  formation: {
    profiles: ["Organismes de formation professionnelle"],
    naf: ["85.59A", "85.59B", "85.32Z"],
  },
  conseil: {
    profiles: ["Cabinets de conseil", "Consultants en organisation et gestion"],
    naf: ["70.22Z", "70.21Z", "69.20Z", "73.20Z"],
  },
  "travaux-btp": {
    profiles: ["Entreprises du BTP", "Entreprises de gros œuvre et de second œuvre", "Entreprises de travaux publics"],
    naf: ["41.20A", "41.20B", "42.11Z", "42.21Z", "42.99Z", "43.11Z", "43.12A", "43.12B", "43.31Z", "43.32A", "43.32B", "43.33Z", "43.34Z", "43.39Z", "43.91A", "43.91B", "43.99A", "43.99B", "43.99C"],
  },
  "espaces-verts": {
    profiles: ["Paysagistes", "Entreprises d'entretien d'espaces verts", "Élagueurs"],
    naf: ["81.30Z", "02.40Z", "01.30Z"],
  },
  "assurances-finance": {
    profiles: ["Assureurs et courtiers", "Établissements financiers"],
    naf: ["65.12Z", "66.22Z", "64.19Z"],
  },
  "communication-evenementiel": {
    profiles: ["Agences de communication", "Imprimeurs", "Photographes et vidéastes", "Organisateurs d'événements"],
    naf: ["73.11Z", "73.12Z", "74.20Z", "18.12Z", "82.30Z", "70.21Z", "74.10Z", "59.11B"],
  },
  "restauration-alimentation": {
    profiles: ["Sociétés de restauration collective", "Traiteurs", "Grossistes alimentaires"],
    naf: ["56.29A", "56.29B", "56.21Z", "46.39B", "46.17A"],
  },
};

/** Règles fines : texte de l'opportunité (normalisé, sans accents) → métiers concernés. */
export const NEED_RULES: { re: RegExp; profile: string; naf: string[] }[] = [
  { re: /\b(electri\w*|courants? faibles?|eclairage|tableaux? electriques?|haute tension|basse tension)\b/, profile: "Électriciens et entreprises d'installation électrique", naf: ["43.21A", "43.21B"] },
  { re: /\b(automat\w*|instrumentation|supervision industrielle)\b/, profile: "Automaticiens et intégrateurs", naf: ["33.14Z", "33.20C", "71.12B"] },
  { re: /\b(photovoltaique\w*|solaire\w*|borne\w* de recharge|irve)\b/, profile: "Installateurs photovoltaïques et bornes de recharge", naf: ["43.21A", "35.11Z"] },
  { re: /\b(plomberie|sanitaires?|chauffage|chaudiere\w*|chaufferie\w*|climatisation|ventilation|cvc|genie climatique|pompes? a chaleur)\b/, profile: "Plombiers, chauffagistes et entreprises de génie climatique", naf: ["43.22A", "43.22B"] },
  { re: /\b(ascenseurs?|monte charges?|portes? automatiques?)\b/, profile: "Ascensoristes et installateurs d'équipements", naf: ["43.29B", "33.12Z"] },
  { re: /\b(nettoyage|proprete|entretien des locaux|vitrerie|lavage)\b/, profile: "Entreprises de nettoyage et de propreté", naf: ["81.21Z", "81.22Z", "81.29A"] },
  { re: /\b(dechets|ordures|collecte|tri selectif)\b/, profile: "Entreprises de collecte et de traitement des déchets", naf: ["38.11Z", "38.21Z", "38.32Z"] },
  { re: /\b(deratisation|desinsectisation|nuisibles)\b/, profile: "Entreprises de lutte contre les nuisibles", naf: ["81.29A"] },
  { re: /\b(logiciels?|developpement|applicati\w*|site (internet|web)|plateforme numerique|progiciel|saas)\b/, profile: "ESN, éditeurs de logiciels, agences web et développeurs", naf: ["62.01Z", "62.02A", "58.29C", "62.09Z"] },
  { re: /\b(infogerance|hebergement|serveurs?|cloud|postes? de travail|parc informatique|materiel informatique)\b/, profile: "Sociétés d'infogérance et intégrateurs informatiques", naf: ["62.03Z", "62.02A", "63.11Z", "46.51Z"] },
  { re: /\b(cyber\w*|pentest|tests? d intrusion|securite (des )?systemes? d information|ssi)\b/, profile: "Sociétés de cybersécurité", naf: ["62.02A", "62.09Z"] },
  { re: /\b(telephonie|fibre optique|telecom\w*|wifi|reseau radio|radiocommunication\w*)\b/, profile: "Intégrateurs télécoms et installateurs de réseaux", naf: ["61.10Z", "61.20Z", "42.22Z"] },
  { re: /\b(menuiser\w*|fenetres?|portes?|huisseries?)\b/, profile: "Menuisiers", naf: ["43.32A", "43.32B", "16.23Z"] },
  { re: /\b(peinture|revetements? (de sols?|muraux)|sols souples|platrerie|cloisons?|faux plafonds?)\b/, profile: "Peintres, plâtriers et entreprises de finitions", naf: ["43.34Z", "43.31Z", "43.33Z"] },
  { re: /\b(couverture|etancheite|toitures?|charpente\w*|zinguerie)\b/, profile: "Couvreurs, charpentiers et étancheurs", naf: ["43.91A", "43.91B", "43.99A"] },
  { re: /\b(maconnerie|gros oeuvre|beton|demolition|desamiantage)\b/, profile: "Maçons et entreprises de gros œuvre", naf: ["43.99C", "41.20A", "41.20B", "43.11Z"] },
  { re: /\b(terrassement|voirie|enrobes?|chaussees?|routes?|signalisation routiere)\b/, profile: "Entreprises de terrassement et de voirie", naf: ["42.11Z", "43.12A", "43.12B"] },
  { re: /\b(assainissement|reseaux humides|canalisations?|eau potable|station d epuration)\b/, profile: "Entreprises de réseaux d'eau et d'assainissement", naf: ["42.21Z", "37.00Z", "36.00Z"] },
  { re: /\b(metallerie|serrurerie|charpente metallique|garde corps)\b/, profile: "Métalliers et serruriers", naf: ["25.11Z", "43.32B"] },
  { re: /\b(usinage|chaudronnerie|soudure|tolerie|mecanique de precision)\b/, profile: "Ateliers d'usinage, chaudronniers et soudeurs", naf: ["25.62A", "25.62B", "25.29Z"] },
  { re: /\b(espaces? verts?|paysag\w*|elagage|tonte|fauchage|arbres?|plantations?)\b/, profile: "Paysagistes et entreprises d'espaces verts", naf: ["81.30Z", "02.40Z"] },
  { re: /\b(gardiennage|surveillance|agents? de securite|ssiap|securite incendie)\b/, profile: "Sociétés de gardiennage et de sécurité", naf: ["80.10Z"] },
  { re: /\b(videoprotection|videosurveillance|alarmes?|controle d acces|intrusion)\b/, profile: "Installateurs de systèmes de sûreté", naf: ["80.20Z", "43.21A"] },
  { re: /\b(formations?|habilitations?|caces|sst)\b/, profile: "Organismes de formation", naf: ["85.59A", "85.59B"] },
  { re: /\b(transport|demenagement|livraisons?|messagerie|navettes?)\b/, profile: "Transporteurs et déménageurs", naf: ["49.41A", "49.42Z", "49.39A", "53.20Z"] },
  { re: /\b(restauration|repas|traiteur|denrees|cuisine centrale)\b/, profile: "Restauration collective et traiteurs", naf: ["56.29A", "56.21Z", "56.29B"] },
  { re: /\b(imprim\w*|impression|signaletique|edition)\b/, profile: "Imprimeurs et entreprises de signalétique", naf: ["18.12Z", "18.13Z"] },
  { re: /\b(communication|publicite|campagnes?|graphisme|reseaux sociaux)\b/, profile: "Agences de communication", naf: ["73.11Z", "70.21Z", "74.10Z"] },
  { re: /\b(photographi\w*|reportages?|videos?|audiovisuel\w*|films?)\b/, profile: "Photographes et vidéastes", naf: ["74.20Z", "59.11B"] },
  { re: /\b(evenement\w*|salons?|congres|seminaires?)\b/, profile: "Organisateurs d'événements", naf: ["82.30Z"] },
  { re: /\b(maitrise d oeuvre|architect\w*)\b/, profile: "Architectes et maîtres d'œuvre", naf: ["71.11Z", "71.12B"] },
  { re: /\b(bureau d etudes|etudes? techniques?|diagnostics?|controle technique|ingenierie)\b/, profile: "Bureaux d'études et d'ingénierie", naf: ["71.12B", "71.20B"] },
  { re: /\b(assistance a maitrise d ouvrage|amo|conseil|audit|accompagnement)\b/, profile: "Cabinets de conseil et d'assistance à maîtrise d'ouvrage", naf: ["70.22Z", "71.12B"] },
  { re: /\b(assurances?|courtage|mutuelles?)\b/, profile: "Assureurs et courtiers", naf: ["65.12Z", "66.22Z"] },
  { re: /\b(mobilier|amenagement de bureaux)\b/, profile: "Fabricants et distributeurs de mobilier", naf: ["31.01Z", "46.65Z"] },
  { re: /\b(maintenance|depannage|entretien preventif|maintenance (preventive|corrective))\b/, profile: "Entreprises de maintenance", naf: ["33.12Z", "33.14Z", "43.22B"] },
];

/** Libellés des codes NAF les plus utilisés (affichage des raisons). */
export const NAF_LABELS: Record<string, string> = {
  "43.21A": "Travaux d'installation électrique",
  "43.22A": "Travaux d'installation d'eau et de gaz",
  "43.22B": "Travaux d'installation d'équipements thermiques et de climatisation",
  "81.21Z": "Nettoyage courant des bâtiments",
  "81.22Z": "Autres activités de nettoyage des bâtiments et nettoyage industriel",
  "62.01Z": "Programmation informatique",
  "62.02A": "Conseil en systèmes et logiciels informatiques",
  "71.12B": "Ingénierie, études techniques",
  "81.30Z": "Services d'aménagement paysager",
  "80.10Z": "Activités de sécurité privée",
  "85.59A": "Formation continue d'adultes",
  "73.11Z": "Activités des agences de publicité",
};
