# SHIFTER — Audit du projet (`PROJECT_AUDIT.md`)

| | |
|---|---|
| Version | 0.1 — brouillon soumis à validation du propriétaire |
| Date | 26 novembre 2026 |
| Sources analysées | Brief « SHIFTER — Brief de création de la plateforme », v1.0, 26/11/2026 (**18 pages lues intégralement**, tableaux, charte et maquette de composants inclus) ; Master Prompt, sections 0 à 9.2 (voir § 1) |
| Statut des affirmations | **[Brief]** = écrit dans le brief · **[Prompt]** = écrit dans le master prompt · **[Hypothèse]** = ma proposition, non validée · **[À vérifier]** = fait que je ne peux pas confirmer |

Aucun code produit, aucune donnée inventée, aucun déploiement. Ce document analyse ; les décisions appartiennent au propriétaire.

---

## 0. Synthèse et décisions bloquantes

SHIFTER est un radar d'opportunités commerciales assisté par IA. Le brief le décrit d'abord comme **un outil personnel du fondateur** (V1), puis un produit vendu aux structures de communication (V3), puis à tous les secteurs. La clé du projet n'est pas la technique : c'est **la qualité et la légalité des données** (sources, consentement, hébergement).

Six points doivent être tranchés avant d'écrire du code :

| # | Décision | Pourquoi c'est bloquant | Ma recommandation |
|---|---|---|---|
| D1 | **Où vit SHIFTER ?** Le dépôt actuel (`agora-b2b-plateform`) héberge LinkProB2B, un produit distinct et avancé | Risque de mélange de marques, de marchés, de domaine légal et de propriété | Dépôt **séparé** pour SHIFTER (§ 4.3-A) |
| D2 | **Quelles sources de données en Côte d'Ivoire ?** Le brief n'en nomme aucune | Sans source autorisée, ni radar ni appels d'offres : seul un travail manuel est possible | Phase de cadrage des sources **avant** tout connecteur |
| D3 | **Hébergement et transferts hors CEDEAO** | Le brief exige un lieu validé juridiquement ; les services cloud usuels sont hors CEDEAO (§ 4.7) | Avis juridique écrit avant de choisir l'hébergeur et le fournisseur d'IA |
| D4 | **Échelle du score : /6 (maquette du brief) ou /100 (prompt) ?** | Contradiction visible, impacte le modèle et l'UI | Calcul interne /100, affichage /6 si le propriétaire le souhaite |
| D5 | **Entité juridique** : SHIFTER « à créer », activité adossée à une agence | Déclaration des traitements, CGU, paiements et cession de droits exigent une entité | À clarifier avec un juriste |
| D6 | **Séquencement** : brief = prototype manuel (6 sem.) → V1 → V2 → V3 ; prompt = SaaS complet | Construire le SaaS entier avant d'avoir validé 100 fiches / 20 signaux / 5 conversations contredit le brief | Suivre les étapes du brief (§ 3.2) |

---

## 1. Périmètre et limites de cet audit

1. **Le master prompt reçu est tronqué** : il s'arrête à la section 9.2 (« Assistant commercial… Quelles questions poser pendant un rendez-vous ? »). Les sections suivantes (probablement sécurité, plan de développement, tests, lancement, etc.) ne m'ont pas été transmises. Je ne les suppose pas. **Merci de renvoyer la suite.** Les livrables 2 à 9 déjà listés (`PRODUCT_STRATEGY`, `TECHNICAL_ARCHITECTURE`, `DESIGN_SYSTEM`, `USER_FLOWS`, `RADAR_ENGINE_SPEC`, `DATABASE_SCHEMA`, `SCORING_ENGINE`, spec IA) restent à produire, après validation de cet audit.
2. **Le brief s'adresse à un prestataire** (§ 11 : chiffrage, références de projets comparables, cession écrite des droits, garantie, formation). Le prompt me place en CTO. Je ne peux pas fournir de « références » ni de cession de droits ; je peux fournir une structure de chiffrage (qualitative, § 4.5) et signaler ce qui demande un contrat.
3. **Faits externes cités par le brief et non vérifiés par moi** : 82 548 entreprises formelles en Côte d'Ivoire (répertoire statistique 2024, données 2022) ; loi n° 2013-546 art. 14 ; loi n° 2013-450. Je les traite comme des **hypothèses à confirmer par un juriste** (§ 4.7).
4. Aucun test, aucune estimation chiffrée de coût n'a été produite : je ne dispose d'aucune donnée de prix vérifiée.

---

## 2. Compréhension du produit (2.1)

### 2.1 Problème résolu
Les agences et prestataires de communication trouvent leurs clients par réseau et au hasard des rencontres. L'information utile (une entreprise qui ouvre un point de vente, recrute un directeur marketing, publie un appel d'offres communication) existe mais est **dispersée, non datée, non qualifiée**. Résultat : on contacte au mauvais moment, sans argument, et sans suivi. [Hypothèse formulée à partir du brief, p. 3 et p. 8 ; à valider par les 5 conversations du prototype.]

### 2.2 Proposition de valeur
« Aucune donnée sans action possible » [Brief p. 3] : pour chaque entreprise, **quoi faire, avec qui, pourquoi maintenant**. Un annuaire liste ; SHIFTER **signale** (événement sourcé), **explique** (score) et **recommande** (prochaine action), puis **suit** (pipeline, relances).

### 2.3 Utilisateurs et besoins

| Utilisateur | Besoin | Ouverture [Brief p. 4] |
|---|---|---|
| Fondateur | Trouver, qualifier, suivre ses opportunités | V1 |
| Administrateur SHIFTER | Qualité des données, comptes, abonnements | V1 ; abonnements en V3 |
| Structure de communication | Veille, appels d'offres, prospects qualifiés | V3 |
| Entreprise de tout secteur | Opportunités et leads, 3 utilisateurs max | Après les structures de communication |

Point notable : en V1, **il n'y a qu'un seul vrai utilisateur** (le fondateur). Le produit doit donc être excellent pour un usage quotidien de 15 minutes [Brief p. 8] avant d'être « vendable ».

### 2.4 Fonctionnement général
Sources → collecte → rattachement à une entreprise → signal sourcé → score expliqué → tableau de bord « priorités du jour » → fiche → action → pipeline (À qualifier, À approcher, En échange, Proposition, Gagné/Perdu) → relance datée. Parcours de conversion en 7 étapes [Brief p. 6] : Signal, Qualification, Entrée, Consentement, Suivi, Rendez-vous, Proposition.

### 2.5 Avantages concurrentiels potentiels [Hypothèse]
- Traçabilité par champ (source, date, fiabilité) : rare dans les annuaires.
- Score **explicable** plutôt que boîte noire.
- Ancrage local (Côte d'Ivoire) avec données très peu structurées : un travail de curation difficile à copier.
- Conformité dès la conception (consentement, opposition) comme argument de confiance.
- Charte et ton clairs [Brief p. 15-18].

### 2.6 Limites du projet actuel
- Aucune source de données nommée ; aucune preuve que les signaux détectés sont exploitables en Côte d'Ivoire.
- Aucune grille tarifaire (définie après entretiens) ni hypothèse de volume.
- « Capacité d'investissement » estimée à partir de données financières probablement rares : risque de fausse précision.
- Dépendance forte à un cadrage juridique non encore réalisé.
- Un seul utilisateur initial : validation commerciale encore à faire (objectifs : 5 structures payantes, 4 renouvellements [Brief p. 12]).

---

## 3. Analyse fonctionnelle (2.2)

### 3.1 Distinction entre versions commerciales et étapes techniques

Le brief numérote des **versions commerciales** (V1 = usage fondateur ; V2 = conversion ; V3 = commercialisation). Le prompt demande des **étapes techniques**. Je les sépare :

| Étape technique | Contenu | Correspond à (brief) |
|---|---|---|
| **MVP** | Socle sûr et traçable, utilisable manuellement par le fondateur ; **sans collecte automatique ni IA générative** | Prototype manuel + cœur de V1 |
| **V1 complète** | Collecte automatisée des sources autorisées, veille appels d'offres, alertes, IA de tri/synthèse/explication | Fin de la V1 commerciale |
| **V2** | Consentements, formulaires, mailing, IA de rédaction, campagnes | V2 commerciale |
| **V3** | Comptes clients isolés, abonnements, paiements, bases premium, leads, site public | V3 commerciale |

**Règle d'architecture** : l'isolation multi-clients, le multi-pays et la traçabilité sont conçus **dès le MVP** [Brief p. 10], mais ne sont **exposés commercialement** qu'en V3.

### 3.2 Inventaire des fonctionnalités

Difficulté : **F** facile · **I** intermédiaire · **C** complexe · **TC** très complexe (justification en § 5).

| ID | Fonctionnalité | Réf. | Version brief | Étape technique | Diff. |
|---|---|---|---|---|---|
| F01 | Connexion sécurisée, double authentification | B p.6 | 1 | MVP | I |
| F02 | Interface FR/EN, bascule par utilisateur, tous les écrans et messages | B p.6, 10 | 1 | MVP | I |
| F03 | Base d'entreprises, recherche (secteur, ville, taille, signal, score) | B p.6 | 1 | MVP | I |
| F04 | Recherches enregistrées | B p.8 | 1 | V1 complète | F |
| F05 | Import de tableur (CSV/XLSX) avec provenance | B p.6 | 1 | MVP | I |
| F06 | Fiche entreprise : synthèse, signaux, sources, dates, historique, prochaine action | B p.6, 8 | 1 | MVP | I |
| F07 | Traçabilité **par champ** : source, date de collecte, date de vérification, fiabilité (vérifié/déclaré/estimé/non vérifié), méthode | B p.5 ; P §7.2 | 1 | MVP | C |
| F08 | Signalement « à vérifier » après 6 mois | B p.5 | 1 | MVP | F |
| F09 | Types de signaux configurables | P §6.1 | 1 | MVP | F |
| F10 | Radar : signaux **saisis manuellement** et rattachés à entreprise + source | B p.6 | 1 | MVP | I |
| F11 | Radar : **collecte automatisée** par connecteurs indépendants, désactivables, avec surveillance | B p.10 ; P §6.4 | 1 | V1 complète | C |
| F12 | Cycle de vie du signal (12 étapes) | P §6.2 | 1 | MVP (états) → V1 | I |
| F13 | Veille appels d'offres : filtres communication, décision répondre/passer, alerte avant échéance | B p.6, 8 | 1 | V1 complète | C |
| F14 | Score d'opportunité expliqué (besoin, budget, accès), pondérations modifiables sans redéploiement | B p.6 ; P §8 | 1 | MVP | I |
| F15 | Pipeline, relances, prochaine action, **exclusion des conflits** | B p.6, 8 | 1 | MVP | I |
| F16 | Tableau de bord « priorités du jour » (10 opportunités, échéances, relances) ; blocs personnalisables | B p.6, 8 | 1 | MVP (fixe) → V1 (perso) | I |
| F17 | Dédoublonnage : **suggestions**, jamais de fusion automatique incertaine | P §7.3 ; B p.7 | 1 | MVP (règles) → V1 (IA) | C |
| F18 | Favoris, notes privées | P §4.3 | 1 | MVP | F |
| F19 | Alertes (appels d'offres, relances, signaux) | P §4.3 ; B p.6 | 1 | V1 complète | I |
| F20 | Journal d'activité, journal des accès et exports | B p.10 ; P §5.3 | 1 | MVP | I |
| F21 | Chiffrement, sauvegardes quotidiennes **avec test de restauration** | B p.10 | 1 | MVP | I |
| F22 | Export complet des données à tout moment (réversibilité) | B p.10 | 1 | MVP | I |
| F23 | Multi-pays : pays, devise, langue, sources ajoutables sans reconstruction | B p.10 | 1 | MVP (modèle) | I |
| F24 | Isolation multi-clients (notes, pipelines, historiques privés) | B p.10 ; P §4.4 | 3 (conçue dès 1) | MVP (schéma + tests) → V3 | C |
| F25 | Administration : sources, qualité des données, comptes | B p.8 | 1 | MVP minimal | I |
| F26 | IA : tri des sources, classification des signaux par secteur | B p.7 | 1 | V1 complète | C |
| F27 | IA : propositions de doublons et de mises à jour | B p.7 | 1 | V1 complète | C |
| F28 | IA : synthèse d'une fiche ou d'un appel d'offres, **avec sources** | B p.7 | 1 | V1 complète | I |
| F29 | IA : explication du score (en MVP : explication **déterministe** issue des règles) | B p.7 | 1 | MVP → V1 | I |
| F30 | **Suivi de consommation IA par utilisateur, plafonné ; fournisseur interchangeable** | B p.7 | 1 | V1 complète (préalable à toute IA) | I |
| F31 | Formulaires et consentements (date, source, texte accepté, case non pré-cochée) | B p.6 | 2 | V2 | I |
| F32 | Mailing et conversion : envoi bloqué sans consentement ou exception validée, désinscription | B p.6 | 2 | V2 | C |
| F33 | Registre des consentements, liste d'opposition commune, procédure de suppression | B p.11 | 2 (**requis dès qu'une donnée de personne est stockée**) | MVP (suppression) → V2 | I |
| F34 | IA : recommandations (prochaine action, brouillon validé par l'utilisateur) | B p.6 | 2 | V2 | I |
| F35 | IA : messages, argumentaires, notes de rendez-vous | B p.7 ; P §9.1 | 2 | V2 | I |
| F36 | IA : pistes de stratégie créative | B p.7 | 2 | V2 | I |
| F37 | Assistant conversationnel commercial (questions libres sur une fiche) — **ajout du prompt, absent du brief** | P §9.2 | — | V2 (sur fiche) | C |
| F38 | Bloc « Communication » (campagnes observées, agence connue publiquement) | B p.5 | 2 | V2 | C |
| F39 | Écran Campagnes (formulaires, consentements, séquences, résultats) | B p.8 | 2 | V2 | I |
| F40 | Comptes clients, rôles (titulaire + 2 collaborateurs), pipeline partagé | B p.6, 10 | 3 | V3 | C |
| F41 | Abonnements Veille / Pro / Premium / Entreprise, paiement mensuel (mobile money et carte) | B p.6, 9 | 3 | V3 | **TC** |
| F42 | Bases premium, export limité et tracé | B p.6 | 3 | V3 | C |
| F43 | Génération de leads (seuls les contacts ayant accepté la transmission) | B p.6, 9 | 3 | V3 | **TC** |
| F44 | Dirigeants (nom, fonction, source, statut du consentement) | B p.5 | « après formalités légales » | Gelé jusqu'à avis juridique | C |
| F45 | Site public, présentation produit, inscription libre, onboarding — **ajouts du prompt** ; le brief n'en parle pas | P §5.3 | — | V3 (page vitrine minimale possible avant) | I |

### 3.3 Hors périmètre explicite [Brief p. 6]
Application mobile native · place de marché · envois automatiques WhatsApp/SMS. Le prompt demande une « excellente expérience mobile » : c'est du **web responsive**, pas une application native (cohérent avec « Web uniquement »).

### 3.4 Écrans : cohérence brief / prompt
Le prompt liste 25 écrans, le brief en décrit 7 (Tableau de bord, Recherche, Fiche entreprise, Appels d'offres, Pipeline, Campagnes (V2), Administration). Les 18 autres (accueil public, présentation, inscription, onboarding, gestion des abonnements, profil…) sont des **déclinaisons ou ajouts**. L'affectation écran → étape sera faite dans `USER_FLOWS.md` ; les écrans V2/V3 seront documentés et **non présentés comme fonctionnels** [Prompt §5.3].

---

## 4. Identification des problèmes (2.3)

### 4.1 Fonctionnalités insuffisamment définies

| Sujet | Ce qui manque |
|---|---|
| « Conflits commerciaux » / « exclusion des conflits » [B p.5, 6] | Conflit de quoi ? Client existant du fondateur/agence ? Concurrent d'un client ? Liste manuelle ou règle ? |
| « Exception validée » du mailing [B p.6] | Quelle exception légale ? Qui la valide ? |
| « Lead valide » [B p.9] | Définition écrite annoncée mais **absente** |
| « Capacité d'investissement estimée » [P §7.1] | Formule, données d'entrée, et que faire quand l'effectif/CA est inconnu |
| « Taille de l'entreprise » | Seuils (effectif ? CA ?) propres à la Côte d'Ivoire |
| Appels d'offres | Quels émetteurs (publics, privés, ONG, bailleurs) ? Quelles sources ? « Filtres communication » : par quel référentiel ? |
| « Campagnes observées, agence connue publiquement » [B p.5] | Qui les observe, comment (manuel ?), avec quelle source |
| « Veille » (offre 1) | Frontière exacte avec « Pro » (alertes ? fréquence ?) |
| Import de tableur | Formats, taille max, règles de rejet, qui est responsable de la légalité des données importées |
| Recherches enregistrées, blocs personnalisables | Niveau de personnalisation attendu |
| Rôles | « Titulaire de compte » et « collaborateurs » : droits précis ? |
| Notion de « secteur » | Taxonomie (NACE/ISIC/maison ?) : choix structurant pour tout le catalogue |
| Devises, formats | XOF par défaut ? Formats de téléphone/adresse (peu normalisés) |

### 4.2 Dépendances techniques et métier
- **Sources autorisées → connecteurs → radar → score → alertes → IA** : tout le cœur dépend des sources (D2). Si D2 reste ouvert, le MVP ne peut être qu'**alimenté manuellement**.
- **Avis juridique → hébergement → fournisseur d'IA → données de personnes** (D3).
- **Fournisseur de messagerie transactionnelle/mailing** : délivrabilité (SPF/DKIM/DMARC), réputation du domaine ; nécessite un **nom de domaine** SHIFTER.
- **Paiement mobile money et carte** : choix d'un agrégateur compatible Côte d'Ivoire, nécessite une **entité juridique** et un compte marchand (D5).
- **Multi-pays** impose une **taxonomie commune des secteurs** et un modèle de « source » par pays.
- **Polices Sora/Inter** : licence SIL OFL [B p.17] → auto-hébergement possible, sans dépendance à un CDN tiers.
- **Logo** : seuls des aperçus sont fournis dans le PDF ; il faut les **fichiers vectoriels originaux** (SVG) pour respecter « ne pas déformer, recolorer » [B p.15].

### 4.3 Contradictions et écarts

| # | Brief | Prompt / constat | Résolution proposée |
|---|---|---|---|
| C1 | Maquette : score **5/6, 4/6** [B p.18] | Score **sur 100** [P §8] | **D4.** Calcul 0-100 en interne ; affichage /6 ou /100 décidé par le propriétaire |
| C2 | « Ouvert à tous les secteurs dès le départ », priorité = signal récent quel que soit le secteur [B p.4] | Positionnement initial = agences de communication [P §3.1] | Compatibles si on distingue **couverture des données (tous secteurs)** et **cible commerciale (structures de com.)**. Le propriétaire confirme |
| C3 | Commercialisation en **V3** ; V1 = usage personnel | « Plateforme SaaS B2B commercialisable » ; exigences d'usage quotidien en entreprise | Le MVP est **mono-organisation d'usage, multi-organisation de conception** (§ 3.1) |
| C4 | « Nomination » est un signal V1 ; le bloc « Dirigeants » est **gelé** jusqu'aux formalités légales | « Changement de direction », « Nomination » dans les signaux [P §6.1] | Une nomination **nomme une personne**. Proposition : en V1, enregistrer le signal avec fonction + entreprise + source, **sans nom** (ou avec nom publié officiellement, si le juriste l'autorise). À valider |
| C5 | 3 niveaux de fiabilité : vérifié, déclaré, estimé [B p.5] | 4 niveaux : + non vérifié [P §7.2] | Cohérent avec la règle IA « sans source = non vérifié » [B p.7] : 4 niveaux retenus |
| C6 | Dépôt de la **plateforme SHIFTER** | Le dépôt actuel est **LinkProB2B** | **D1** ci-dessous |
| C7 | Feuille de route étagée (prototype manuel d'abord) | Prompt ambitieux (25 écrans, IA complète, SaaS) | **D6** : suivre les critères de passage du brief |
| C8 | IA « dès la V1 » [B p.7] | Garde-fou : aucune donnée personnelle envoyée à un fournisseur d'IA sans validation juridique | L'IA de V1 ne traite **que des données d'entreprises et de textes publics**, pas de données de personnes |
| C9 | « Hébergement : lieu déclaré et validé juridiquement » | Préférence du prompt pour la performance et le coût | Le critère légal prime ; performance et coût départagent ensuite |
| C10 | Brief : « Réponse du prestataire : chiffrage, références, cession » | Rôle CTO interne | Voir § 1.2 |

#### D1 — Emplacement du projet (option détaillée)
Constat factuel : le dépôt contient LinkProB2B (README, `package.json`, 157 migrations Supabase, > 200 PR). Marché français (Bretagne), marchés publics BOAMP/TED, polices Manrope/Montserrat, hébergement Vercel Paris, charte différente.

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Nouveau dépôt SHIFTER** (je peux m'inspirer des **patterns** éprouvés ici : RLS multi-tenant, chaîne de collecte, déduplication, scoring explicable) | Séparation nette des marques, marchés et obligations légales ; historique propre ; réversibilité simple [B p.10] | Redémarrage du socle ; il faut confirmer que le code d'origine peut être réutilisé (même propriétaire ?) |
| B. Fork de ce dépôt | Démarrage rapide (auth, RLS, tests, CI existants) | Beaucoup de code spécifique France/BOAMP à retirer ; risque de dette et de fuite de logique LinkProB2B |
| C. Construire dans ce dépôt | Aucun | Mélange de deux produits, de deux chartes et de deux régimes légaux ; **non recommandé** |

**Recommandation : A.** Je n'ai pas pu vérifier que le propriétaire du dépôt actuel et celui de SHIFTER sont la même personne : à confirmer avant toute réutilisation de code (le brief impose la cession écrite des droits [B p.14]).

> Note : `AGENTS.md` de ce dépôt rappelle que la version de Next.js présente a des changements incompatibles et qu'il faut lire `node_modules/next/dist/docs/` avant d'écrire du code. Si une pile Next.js est retenue pour SHIFTER, cette lecture sera faite **avant** la première ligne de code.

### 4.4 Risques

| Risque | Impact | Probabilité [Hypothèse] | Atténuation |
|---|---|---|---|
| Pas de source de données exploitable et légale en CI | Critique | Moyenne à élevée | Cadrage sources (2-4 sem.), prototype manuel, entrée **manuelle sourcée** comme chemin principal du MVP |
| Non-conformité prospection / protection des données | Critique (sanction pénale citée par le brief) | Moyenne | Avis écrit avant toute collecte de données de personnes ; pas de mailing avant V2 |
| Données obsolètes/erronées → perte de confiance | Élevé | Élevée | Traçabilité par champ, marque « à vérifier » à 6 mois, priorité à la qualité sur le volume |
| Fausse précision du score et de la « capacité d'investissement » | Moyen | Élevée | Séparer 3 dimensions (probabilité du signal / pertinence / potentiel) [P §8.2] ; afficher l'incertitude |
| Hallucinations de l'IA | Élevé | Moyenne | Sorties **toujours rattachées à une source** ; « non vérifié » sinon ; validation humaine ; pas de contact généré |
| Fuite de données entre clients (V3) | Critique | Faible si testé | Isolation au niveau base de données + tests automatisés d'isolation dès le MVP |
| Dérive des coûts IA | Moyen | Moyenne | Plafonds par utilisateur, cache, modèles économiques pour le tri, fournisseur interchangeable |
| Dépendance à un prestataire cloud | Moyen | Moyenne | Standards ouverts (PostgreSQL), export complet, documentation |
| Surcharge de périmètre (prompt très large) | Élevé | Élevée | Étapes techniques gelées par critères de passage |
| Faible connexion des utilisateurs [B p.10] | Moyen | Moyenne | Budget de performance, pages légères, pas de dépendance à des gros scripts |
| Mobile money : échecs, rapprochements, rétrofacturation | Élevé (V3) | Moyenne | Reporter à V3, choisir un agrégateur après entretiens clients |

### 4.5 Coûts potentiellement élevés (qualitatif, **aucun montant inventé**)

| Poste | Nature | Niveau attendu | Levier d'optimisation |
|---|---|---|---|
| IA (tokens) | Récurrent, proportionnel à l'usage | Moyen → élevé | Plafonds, cache, résumés pré-calculés une fois, petit modèle pour le tri |
| Collecte et stockage de sources | Récurrent | Faible → moyen | Fréquences configurables, un connecteur à la fois |
| Données payantes (si achetées) | Récurrent | **Potentiellement élevé** | Ne rien acheter avant validation de la valeur ; sources ouvertes d'abord |
| E-mails (transactionnel, mailing) | Récurrent | Faible → moyen | Mailing seulement en V2 |
| Hébergement, base, sauvegardes | Récurrent | Faible → moyen | Un seul environnement payant au début ; préproduction éphémère |
| Paiements | Commission par transaction | Variable | V3 uniquement |
| Avis juridique, déclaration des traitements | Ponctuel | À chiffrer par un juriste | Indispensable avant V1 « réelle » |
| Nom de domaine, e-mail professionnel | Annuel | Faible | — |
| Travail humain de vérification des données | **Récurrent, souvent le poste principal** | Moyen → élevé | Priorité aux entreprises avec signal récent [B p.4] |

### 4.6 Fonctionnalités difficiles à maintenir
- **Connecteurs de collecte** : les sites changent, les formats cassent. → un connecteur = un module isolé, avec test de contrat et désactivation sans impact.
- **Extraction par IA** : dérive de qualité selon le modèle. → jeu d'évaluation figé, comparaison avant changement de modèle.
- **Dédoublonnage** : faux positifs/négatifs. → seuils configurables, file de revue humaine.
- **Mailing et délivrabilité** : réputation du domaine à surveiller en continu.
- **Traductions FR/EN** : toute chaîne nouvelle doit exister dans les deux langues. → vérification automatique dans l'intégration continue.
- **Multi-pays** : chaque pays = règles légales, sources, formats propres.

### 4.7 Éléments nécessitant une validation juridique
Je ne suis pas juriste ; les références légales sont celles du brief. Un juriste local doit se prononcer **par écrit** sur :
1. Conditions de collecte et de réutilisation de **chaque source** (le brief : « une source n'est utilisée que si ses conditions autorisent la réutilisation »).
2. Données de personnes : dirigeants, nominations, contacts (F44) — **gelées**.
3. Prospection électronique et exceptions applicables [B p.11, loi 2013-546 art. 14 — à confirmer].
4. Déclaration préalable des traitements et droits des personnes [B p.11, loi 2013-450 — à confirmer].
5. **Transfert hors CEDEAO** : le brief cite une autorisation requise. Un hébergement cloud, une base de données gérée ou un fournisseur d'IA situés hors CEDEAO peuvent constituer un transfert **dès que des données de personnes (y compris les comptes utilisateurs) sont traitées**. Choix à arbitrer par avis écrit, **avant** de retenir l'hébergeur.
6. Conditions générales d'utilisation, suspension en cas d'envoi abusif.
7. Entité juridique, cession de droits des prestataires, titularité du code et de la base.
8. Paiement : exigences applicables aux moyens de paiement mobiles (V3).
9. Pays suivants : vérification **avant ouverture** de chaque pays [B p.11].

### 4.8 Éléments nécessitant une décision du propriétaire
D1 à D6 (§ 0), plus :
- Taxonomie des secteurs ; définition des « conflits », du « lead valide », de la « taille d'entreprise ».
- Pondérations initiales du score (hypothèses du prompt : 35/25/20/10/10 — non validées).
- Grille tarifaire (définie après entretiens) et limites des offres.
- Budget mensuel plafond (infrastructure + IA) acceptable en phase de prototype.
- Nom de domaine et canal d'e-mail.
- Fichiers officiels du logo (vectoriel).
- Qui vérifie les données au quotidien (le fondateur ? un opérateur ?).

---

## 5. Faisabilité (2.4)

| Fonctionnalité / groupe | Niveau | Dépendances | Coût prévisible | Risques principaux |
|---|---|---|---|---|
| Auth + 2FA (F01) | Intermédiaire | Fournisseur d'authentification, e-mail transactionnel | Faible | Récupération de compte, gestion des appareils |
| FR/EN complet (F02) | Intermédiaire | Discipline de rédaction ; glossaire | Faible | Chaînes manquantes → contrôle en CI |
| Base, recherche, import (F03-F05) | Intermédiaire | Taxonomie de secteurs | Faible | Qualité des fichiers importés, légalité des données |
| **Traçabilité par champ (F07)** | **Complexe** | Modèle de données dédié (valeur + provenance) | Faible (infra), **fort** (conception) | Complexité de requête, discipline de saisie |
| Fiche entreprise (F06) | Intermédiaire | F07 | Faible | Surcharge d'écran |
| Signaux manuels (F10) | Intermédiaire | Types configurables | Faible | Saisie lourde → formulaire rapide |
| **Collecte automatisée (F11)** | **Complexe** | **Sources autorisées (D2)**, planificateur, supervision | Moyen | Sources instables ou interdites ; cassures |
| **Appels d'offres (F13)** | **Complexe** | Sources CI ; référentiel « communication » | Moyen | Pas de source structurée connue ; saisie manuelle probable |
| Score expliqué (F14, F29) | Intermédiaire | Pondérations validées (D4) | Faible | Sur-confiance de l'utilisateur ; modèle non calibré sans historique |
| Pipeline/relances/conflits (F15) | Intermédiaire | Définition de « conflit » | Faible | Règle de conflit ambiguë |
| Dashboard (F16) | Intermédiaire | F10, F14, F15 | Faible | Rester utile, éviter les statistiques vides [P §3.3] |
| **Dédoublonnage (F17, F27)** | **Complexe** | Identifiants légaux CI (disponibilité à vérifier) | Faible → moyen | Faux rapprochements ; jamais de fusion automatique incertaine |
| Journaux, chiffrement, sauvegardes, export (F20-F22) | Intermédiaire | Hébergement choisi (D3) | Faible | Test de restauration à **réellement** exécuter |
| **Isolation multi-clients (F24)** | **Complexe** | Modèle d'organisation, règles d'accès en base | Faible | Une faille = incident majeur ; tests automatisés obligatoires |
| IA tri/synthèse/explication (F26, F28) | Intermédiaire à Complexe | Fournisseur d'IA validé légalement (D3), suivi de consommation (F30) | Moyen → élevé | Hallucination, coût, données personnelles |
| IA rédaction/stratégie (F35, F36) | Intermédiaire | Brouillons **toujours validés** par l'humain | Moyen | Qualité de style local, confidentialité |
| Assistant conversationnel (F37) | Complexe | Contexte de fiche, garde-fous | Moyen → élevé | Dérives, coûts, réponses non sourcées |
| Consentements / formulaires (F31, F33) | Intermédiaire | Avis juridique | Faible | Preuve insuffisante si mal conçue |
| **Mailing (F32)** | **Complexe** | Domaine, délivrabilité, consentement, liste d'opposition | Moyen | Réputation du domaine, sanctions |
| Bloc Communication (F38) | Complexe | Source/observation manuelle | Moyen (travail) | Données rares et subjectives |
| Comptes clients/rôles (F40) | Complexe | F24 | Faible | Erreurs de permissions |
| **Abonnements et paiements (F41)** | **Très complexe** | Entité juridique, agrégateur mobile money/carte, facturation | Commissions + temps | Réconciliation, échecs, litiges, conformité |
| Bases premium + exports tracés (F42) | Complexe | Droits sur les données (sources) | Faible | Revente de données soumises à droits tiers |
| **Génération de leads (F43)** | **Très complexe** | Définition du « lead valide », consentement de transmission, avis juridique | Opérationnel | Risque juridique et réputationnel élevé |
| Dirigeants (F44) | Complexe | Avis juridique | Faible | **Gelé** |

**Synthèse** : aucune fonctionnalité n'est techniquement irréalisable. Les difficultés sont **juridiques, de données et d'opération**, pas d'algorithmie.

---

## 6. Prochaines étapes proposées (aucun développement)

1. **Vous** : valider ou amender cet audit (D1 à D6 et § 4.8) et **renvoyer la suite du prompt** (après la section 9.2).
2. Je produis ensuite, un par un et chacun soumis à validation : `PRODUCT_STRATEGY.md` → `TECHNICAL_ARCHITECTURE.md` (avec options d'hébergement comparées, **sous réserve de l'avis juridique**) → `DATABASE_SCHEMA.md` → `SCORING_ENGINE.md` → `RADAR_ENGINE_SPEC.md` → `DESIGN_SYSTEM.md` / `USER_FLOWS.md`.
3. En parallèle, côté propriétaire (hors code) : cadrage juridique, liste de sources candidates, fichiers du logo, début du prototype manuel (100 fiches, 20 signaux, 5 conversations [B p.12]).
4. Le développement ne démarre qu'après validation des documents ci-dessus, avec pour chaque fonctionnalité des **critères de réception** (ceux du brief p. 6 servent de base) et des tests avant de passer à la suivante.

## Annexe — Charte graphique extraite du brief (pour mémoire, pages 15 à 18)

- Couleurs : bleu nuit `#0B1640` (RVB 11·22·64), jaune orangé `#FFA914` (RVB 255·169·20) ; teintes Nuit 100/70/10, Orange 100/60/12 ; répartition 60 % blanc, 30 % bleu nuit, 10 % jaune orangé.
- Contrastes indiqués : blanc sur bleu nuit 17,5:1 ; jaune orangé sur bleu nuit 9,1:1 ; **jaune orangé sur blanc 1,9:1 → jamais pour du texte**, aplats et filets seulement.
- Typographies : Sora (titres : ExtraBold 800, 40 px ; sous-titres : SemiBold 600, 24 px), Inter (texte 400/16 px ; boutons 600/14 px ; données 500/14 px, chiffres alignés). Licence SIL OFL.
- Composants : bouton principal jaune orangé + texte bleu nuit ; bouton secondaire contour bleu nuit ; coins arrondis 6 px ; espacements multiples de 8 px ; **un statut s'écrit toujours en lettres ou en chiffres, jamais par la couleur seule**.
- Logo : deux chevrons décalés + « SHIFTER » en capitales Sora ExtraBold ; zone de protection = moitié de la hauteur du symbole ; taille minimale 24 px (écran) / 8 mm (impression) ; ni déformation, ni inclinaison, ni recoloration, ni ombre.
- Ton : direct, précis, utile ; une phrase, une idée ; chaque message propose une action ; FR et EN rédigés avec le même soin.
