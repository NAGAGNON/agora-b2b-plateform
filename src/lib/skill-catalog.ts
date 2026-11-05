/**
 * Compétences proposées pour chaque métier (profil express, fiche entreprise) et mots qui les
 * désignent dans les avis de marché. Une offre est rattachée à une compétence quand l'un de ces
 * mots figure dans son intitulé, son résumé ou son descriptif : rien n'est estimé.
 * Les mots sont écrits sans majuscules ; les accents sont ignorés à la comparaison.
 */
export type CatalogSkill = {
  label: string;
  terms: string[];
  /** Métier qui s'exerce souvent à distance (indépendants, freelances) : alerte sur toute la France */
  remote?: boolean;
};

export const SKILL_CATALOG: Record<string, CatalogSkill[]> = {
  "travaux-btp": [
    { label: "Gros œuvre et maçonnerie", terms: ["gros oeuvre", "gros-oeuvre", "maconnerie", "beton arme", "fondations"] },
    { label: "Voirie et réseaux (VRD)", terms: ["voirie", "vrd", "chaussee", "enrobes", "trottoirs", "terrassement"] },
    { label: "Eau potable et assainissement", terms: ["assainissement", "eau potable", "eaux usees", "eaux pluviales", "reseaux humides", "canalisations", "aep"] },
    { label: "Couverture et étanchéité", terms: ["couverture", "toiture", "etancheite", "zinguerie", "charpente"] },
    { label: "Menuiserie", terms: ["menuiserie", "menuiseries", "fenetres", "portes"] },
    { label: "Peinture et revêtements", terms: ["peinture", "revetements de sols", "revetement de sol", "sols souples", "carrelage", "faience"] },
    { label: "Plâtrerie et isolation", terms: ["platrerie", "cloisons", "doublage", "isolation", "faux plafonds", "plaquiste"] },
    { label: "Métallerie et serrurerie", terms: ["metallerie", "serrurerie", "charpente metallique", "garde-corps"] },
    { label: "Démolition et désamiantage", terms: ["demolition", "desamiantage", "amiante", "deconstruction"] },
    { label: "Réhabilitation et rénovation", terms: ["rehabilitation", "renovation", "restructuration"] },
  ],
  "batiment-technique": [
    { label: "Chauffage, ventilation, climatisation (CVC)", terms: ["chauffage", "ventilation", "climatisation", "cvc", "pompe a chaleur", "chaufferie"] },
    { label: "Plomberie et sanitaires", terms: ["plomberie", "sanitaire", "sanitaires", "eau chaude sanitaire", "robinetterie"] },
    { label: "Électricité du bâtiment", terms: ["electricite", "courants forts", "courants faibles", "eclairage", "tableaux electriques"] },
    { label: "Sécurité incendie", terms: ["securite incendie", "ssi", "desenfumage", "extincteurs", "detection incendie", "sprinkler"] },
    { label: "Ascenseurs", terms: ["ascenseur", "ascenseurs", "monte-charge", "monte-charges", "elevateur"] },
    { label: "Contrôle d'accès et vidéoprotection", terms: ["controle d'acces", "videoprotection", "videosurveillance", "interphonie"] },
    { label: "Exploitation et maintenance multitechnique", terms: ["multitechnique", "exploitation des installations", "maintenance multitechnique", "gtb", "gtc"] },
  ],
  "maintenance-industrielle": [
    { label: "Maintenance mécanique", terms: ["mecanique", "maintenance preventive", "maintenance curative", "roulements", "reducteurs"] },
    { label: "Hydraulique et pneumatique", terms: ["hydraulique", "pneumatique", "verins", "compresseurs", "air comprime"] },
    { label: "Levage et manutention", terms: ["levage", "ponts roulants", "palans", "chariots elevateurs", "manutention"] },
    { label: "Équipements de cuisine et froid", terms: ["equipements de cuisine", "materiels de cuisine", "froid", "chambres froides", "frigorifique"] },
    { label: "Véhicules et ateliers", terms: ["vehicules", "atelier mecanique", "ateliers mecaniques", "poids lourds", "flotte"] },
    { label: "Contrôles et métrologie", terms: ["metrologie", "controle periodique", "verifications periodiques", "etalonnage", "requalification"] },
    { label: "Portes et portails automatiques", terms: ["portes automatiques", "portails", "barrieres automatiques", "rideaux metalliques"] },
  ],
  "electricite-automatisme": [
    { label: "Électricité industrielle", terms: ["electricite industrielle", "haute tension", "basse tension", "postes de transformation", "tgbt"] },
    { label: "Automatismes et supervision", terms: ["automatisme", "automatismes", "automates", "supervision", "scada"] },
    { label: "Éclairage public", terms: ["eclairage public", "candelabres", "illuminations"] },
    { label: "Bornes de recharge", terms: ["bornes de recharge", "irve", "recharge de vehicules"] },
    { label: "Signalisation et feux", terms: ["signalisation lumineuse", "feux tricolores", "carrefours a feux"] },
  ],
  energie: [
    { label: "Photovoltaïque", terms: ["photovoltaique", "photovoltaiques", "panneaux solaires", "centrale solaire"] },
    { label: "Efficacité énergétique", terms: ["efficacite energetique", "performance energetique", "audit energetique", "economies d'energie"] },
    { label: "Fourniture d'énergie", terms: ["fourniture d'electricite", "fourniture de gaz", "fourniture d'energie", "acheminement"] },
    { label: "Réseaux de chaleur et biomasse", terms: ["reseau de chaleur", "reseaux de chaleur", "biomasse", "chaudiere bois", "geothermie"] },
  ],
  "fournitures-industrielles": [
    { label: "Outillage et quincaillerie", terms: ["outillage", "quincaillerie", "visserie", "outils"] },
    { label: "Équipements de protection (EPI)", terms: ["epi", "equipements de protection", "vetements de travail", "chaussures de securite"] },
    { label: "Matériaux de construction", terms: ["materiaux", "granulats", "beton pret a l'emploi", "fournitures de voirie"] },
    { label: "Pièces détachées", terms: ["pieces detachees", "pieces de rechange", "consommables"] },
    { label: "Produits d'entretien et d'hygiène", terms: ["produits d'entretien", "produits d'hygiene", "essuyage", "consommables d'hygiene"] },
  ],
  "sous-traitance-industrielle": [
    { label: "Usinage", terms: ["usinage", "tournage", "fraisage", "decolletage"] },
    { label: "Chaudronnerie et tôlerie", terms: ["chaudronnerie", "tolerie", "pliage", "decoupe laser"] },
    { label: "Soudure", terms: ["soudure", "soudage"] },
    { label: "Traitement de surface", terms: ["traitement de surface", "peinture industrielle", "thermolaquage", "galvanisation"] },
    { label: "Plasturgie et composites", terms: ["plasturgie", "injection plastique", "composites"] },
  ],
  informatique: [
    { label: "Développement de logiciels et d'applications", terms: ["developpement de logiciel", "developpement d'application", "developpement web", "application mobile", "application web", "logiciel", "progiciel", "solution logicielle"] },
    { label: "Sites internet", terms: ["site internet", "sites internet", "site web", "portail web"] },
    { label: "Matériel informatique", terms: ["materiel informatique", "postes de travail", "ordinateurs", "fournitures informatiques", "serveurs"] },
    { label: "Infogérance et support", terms: ["infogerance", "support utilisateurs", "maintenance informatique", "assistance informatique", "tierce maintenance"] },
    { label: "Hébergement et cloud", terms: ["hebergement", "cloud", "saas", "datacenter"] },
    { label: "Données et SIG", terms: ["base de donnees", "donnees geographiques", "sig", "cartographie", "geomatique"] },
    { label: "Réalité virtuelle, 3D et serious games", terms: ["realite virtuelle", "realite augmentee", "realite mixte", "serious game", "serious games", "jeu serieux", "jeux serieux", "immersif", "immersive", "modelisation 3d", "jumeau numerique", "jumeaux numeriques", "unity"], remote: true },
    { label: "Design UX/UI", terms: ["ux design", "design ux", "ui design", "experience utilisateur", "ergonomie web", "design d'interface", "design d'interfaces"], remote: true },
    { label: "Données et intelligence artificielle", terms: ["intelligence artificielle", "data science", "science des donnees", "apprentissage automatique", "machine learning", "datavisualisation"], remote: true },
  ],
  cybersecurite: [
    { label: "Audit et tests d'intrusion", terms: ["audit de securite", "tests d'intrusion", "pentest", "audit de cybersecurite"] },
    { label: "Sécurité des systèmes d'information", terms: ["securite des systemes d'information", "cybersecurite", "rssi"] },
    { label: "Supervision et réponse aux incidents", terms: ["soc", "supervision de securite", "reponse aux incidents", "edr"] },
  ],
  telecoms: [
    { label: "Fibre et câblage", terms: ["fibre optique", "cablage", "reseau fibre", "precablage"] },
    { label: "Téléphonie", terms: ["telephonie", "standard telephonique", "telephonie mobile", "toip"] },
    { label: "Réseaux et wifi", terms: ["reseau informatique", "reseaux locaux", "wifi", "commutateurs"] },
  ],
  "nettoyage-proprete": [
    { label: "Nettoyage de bureaux et locaux", terms: ["nettoyage des locaux", "nettoyage de locaux", "nettoyage des bureaux", "entretien des locaux", "menage"] },
    { label: "Vitrerie", terms: ["vitrerie", "nettoyage des vitres", "vitres"] },
    { label: "Nettoyage de fin de chantier", terms: ["fin de chantier", "remise en etat"] },
    { label: "Propreté urbaine", terms: ["proprete urbaine", "nettoiement", "balayage mecanise", "balayage des voies"] },
    { label: "Déchets", terms: ["dechets", "collecte des dechets", "traitement des dechets", "bennes"] },
    { label: "Désinfection et dératisation", terms: ["desinfection", "deratisation", "desinsectisation", "nuisibles"] },
  ],
  "espaces-verts": [
    { label: "Entretien des espaces verts", terms: ["espaces verts", "tonte", "entretien des espaces", "fauchage", "debroussaillage"] },
    { label: "Élagage et abattage", terms: ["elagage", "abattage", "arbres", "arboriste"] },
    { label: "Aménagement paysager", terms: ["amenagement paysager", "paysager", "plantations", "aires de jeux"] },
  ],
  "transport-logistique": [
    { label: "Transport de personnes", terms: ["transport de personnes", "transport scolaire", "transport de voyageurs", "autocars"] },
    { label: "Transport de marchandises", terms: ["transport de marchandises", "messagerie", "fret", "livraison"] },
    { label: "Déménagement", terms: ["demenagement", "demenagements", "transfert de mobilier"] },
    { label: "Location de véhicules", terms: ["location de vehicules", "location longue duree", "vehicules utilitaires"] },
    { label: "Logistique et entreposage", terms: ["logistique", "entreposage", "stockage", "archivage physique"] },
  ],
  "securite-surete": [
    { label: "Gardiennage et surveillance", terms: ["gardiennage", "surveillance", "agents de securite", "securite privee", "rondes"] },
    { label: "Télésurveillance", terms: ["telesurveillance", "alarme", "alarmes"] },
    { label: "Sécurité événementielle", terms: ["securite evenementielle", "ssiap", "accueil securite"] },
  ],
  "ingenierie-etudes": [
    { label: "Maîtrise d'œuvre", terms: ["maitrise d'oeuvre", "moe", "architecte", "architecture"] },
    { label: "Bureau d'études techniques", terms: ["bureau d'etudes", "etudes techniques", "ingenierie", "diagnostic"] },
    { label: "Assistance à maîtrise d'ouvrage (AMO)", terms: ["assistance a maitrise d'ouvrage", "amo", "programmation"] },
    { label: "Contrôle technique et coordination SPS", terms: ["controle technique", "coordination sps", "coordonnateur sps", "opc"] },
    { label: "Études d'environnement", terms: ["etude d'impact", "evaluation environnementale", "etude environnementale", "faune flore", "inventaires naturalistes"] },
  ],
  "services-aux-entreprises": [
    { label: "Impression et reprographie", terms: ["impression", "imprimerie", "reprographie", "editique"] },
    { label: "Accueil et standard", terms: ["prestations d'accueil", "accueil physique", "accueil telephonique", "standard telephonique", "hotesse", "hote d'accueil"] },
    { label: "Traduction et interprétariat", terms: ["traduction", "traductions", "traducteur", "interpretariat", "interpretes", "sous-titrage", "transcription"], remote: true },
    { label: "Fournitures de bureau", terms: ["fournitures de bureau", "papeterie", "mobilier de bureau"] },
    { label: "Courrier et affranchissement", terms: ["courrier", "affranchissement", "routage"] },
  ],
  conseil: [
    { label: "Conseil en organisation", terms: ["conseil en organisation", "accompagnement au changement", "conduite du changement"] },
    { label: "Conseil juridique", terms: ["juridique", "avocat", "assistance juridique", "conseil juridique"] },
    { label: "Ressources humaines", terms: ["ressources humaines", "recrutement", "cabinet de recrutement"] },
    { label: "Expertise comptable et finances", terms: ["expertise comptable", "commissaire aux comptes", "comptable", "audit financier"] },
    { label: "Études de marché et enquêtes", terms: ["etude de marche", "etudes de marche", "enquete de satisfaction", "enquetes de satisfaction", "etude qualitative", "etude quantitative", "barometre"], remote: true },
    { label: "Marketing et stratégie", terms: ["strategie marketing", "marketing", "plan marketing", "etude de positionnement"], remote: true },
  ],
  formation: [
    { label: "Formation sécurité", terms: ["formation securite", "formations securite", "habilitation electrique", "sst", "caces"] },
    { label: "Formation management et bureautique", terms: ["formation management", "formation au management", "bureautique"] },
    { label: "Langues", terms: ["formation linguistique", "cours de langues", "formation en langues", "anglais", "francais langue etrangere"] },
    { label: "E-learning et ingénierie pédagogique", terms: ["e-learning", "elearning", "digital learning", "ingenierie pedagogique", "modules pedagogiques", "capsules pedagogiques", "formation a distance"], remote: true },
  ],
  "assurances-finance": [
    { label: "Assurances", terms: ["assurance", "assurances", "dommages aux biens", "responsabilite civile", "flotte automobile"] },
    { label: "Services bancaires et financiers", terms: ["services bancaires", "emprunt", "financement", "affacturage"] },
  ],
  "communication-evenementiel": [
    { label: "Stratégie et agence de communication", terms: ["agence de communication", "plan de communication", "strategie de communication", "supports de communication", "campagne de communication"] },
    { label: "Graphisme et identité visuelle", terms: ["graphisme", "graphiste", "identite visuelle", "charte graphique", "creation graphique", "conception graphique", "mise en page", "infographie", "illustrations", "pao"], remote: true },
    { label: "Rédaction et contenus", terms: ["redaction de contenus", "redaction web", "redacteur", "redactionnel", "contenus editoriaux", "copywriting", "ecriture de contenus"], remote: true },
    { label: "Réseaux sociaux", terms: ["reseaux sociaux", "community management", "community manager", "animation des reseaux"], remote: true },
    { label: "Motion design et montage vidéo", terms: ["motion design", "montage video", "animation 2d", "animation 3d", "films d'animation"], remote: true },
    { label: "Événementiel", terms: ["evenementiel", "organisation d'evenements", "organisation de salons", "seminaire", "congres"] },
    { label: "Vidéo et photographie", terms: ["realisation video", "realisation de films", "production audiovisuelle", "audiovisuel", "photographie", "photographe", "reportages photo", "prises de vue"] },
    { label: "Signalétique", terms: ["signaletique", "enseignes", "panneaux signaletiques"] },
    { label: "Médias et publicité", terms: ["achat d'espace", "achats d'espaces", "publicite", "agence media"] },
  ],
  "restauration-alimentation": [
    { label: "Restauration collective", terms: ["restauration collective", "restauration scolaire", "cantine", "repas"] },
    { label: "Fourniture de denrées", terms: ["denrees alimentaires", "produits alimentaires", "fruits et legumes", "viandes", "epicerie"] },
    { label: "Traiteur", terms: ["traiteur", "cocktail", "buffets"] },
    { label: "Distributeurs automatiques", terms: ["distributeurs automatiques", "distribution automatique", "boissons chaudes"] },
  ],
};

export const normalizeSkillText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const BY_LABEL = new Map(Object.values(SKILL_CATALOG).flat().map((s) => [normalizeSkillText(s.label), s]));

/**
 * Mots trop généraux pour cibler seuls (saisie libre) : ils figurent dans des offres de tous les métiers
 * (« application de peinture », « contrat 2D-3D de dératisation », « simulation de chiffrage »…).
 */
const GENERIC = new Set(
  "application applications logiciel logiciels simulation interactif interactive service services prestation prestations travaux maintenance conseil conseils etude etudes formation formations gestion projet projets developpement creation conception realisation fourniture fournitures installation entretien reparation 2d 3d web digital numerique informatique communication design technique techniques ingenierie expertise audit".split(" "),
);

/** Mots qui désignent une compétence : ceux du catalogue, sinon la compétence telle que saisie (si assez précise). */
export function skillTerms(skill: string): string[] {
  const n = normalizeSkillText(skill);
  const known = BY_LABEL.get(n);
  if (known) return known.terms;
  const clean = n.replace(/[^a-z0-9#+' -]+/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 3 || GENERIC.has(clean)) return [];
  return [clean];
}

/** Compétence du catalogue (libellé exact), ou null pour une saisie libre. */
export const catalogSkill = (label: string) => BY_LABEL.get(normalizeSkillText(label)) ?? null;

/**
 * Mots d'alerte pour une liste de compétences (catalogue et saisie libre), sans doublon.
 * `remote` : toutes les compétences du catalogue choisies s'exercent à distance → alerte nationale.
 */
export function alertTermsFor(skills: string[]): { terms: string[]; remote: boolean } {
  const terms = expandSkills(skills).slice(0, 60);
  const known = skills.map(catalogSkill).filter((x): x is CatalogSkill => x !== null);
  return { terms, remote: known.length > 0 && known.every((k) => k.remote) };
}

/** Tous les mots d'une liste de compétences (sans doublon). */
export function expandSkills(skills: string[]): string[] {
  return [...new Set(skills.flatMap(skillTerms))];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Première compétence (libellé) dont un mot figure dans le texte de l'offre, ou null. */
export function matchedSkill(skills: string[], text: string): string | null {
  const t = ` ${normalizeSkillText(text).replace(/[^a-z0-9' -]+/g, " ")} `;
  for (const s of skills) {
    if (skillTerms(s).some((term) => new RegExp(`[^a-z0-9]${escapeRe(term)}(s|x)?[^a-z0-9]`).test(t))) return s.trim();
  }
  return null;
}
