# Sources externes

Règle absolue : **une source n'est collectée automatiquement que si ses conditions de réutilisation l'autorisent explicitement et si elle offre un accès technique prévu pour cela (API ou export officiel)**. Aucun scraping. Une opportunité externe est toujours présentée comme externe, avec sa source, sa référence, sa date et le lien vers l'annonce originale.

## Sources intégrées

| Source | Contenu | Accès | Conditions de réutilisation | Statut |
|---|---|---|---|---|
| **BOAMP** (DILA) | avis de marchés publics français : appels d'offres, procédures adaptées publiées au BOAMP, rectificatifs, annulations | API Opendatasoft `boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records` | **Licence Ouverte / Open Licence 2.0 (Etalab)** : réutilisation libre, y compris commerciale, avec mention de la source et de la date de mise à jour | ✅ approuvée, active |
| **TED** (Office des publications de l'UE) | avis européens au-dessus des seuils (France) | API de recherche v3 `api.ted.europa.eu/v3/notices/search` (sans clé pour la recherche) | **Réutilisation autorisée, y compris commerciale** (politique de réutilisation de la Commission, décision 2011/833/UE ; données sous CC BY 4.0), avec mention de la source | ✅ approuvée, active |

Mention affichée sur chaque fiche : « Source : BOAMP — Direction de l'information légale et administrative (DILA), Licence Ouverte 2.0 » ou « Source : TED — Office des publications de l'Union européenne ».

### Paramétrage actuel (modifiable dans *Administration → Sources → Réglages*)

- **Couverture : France entière** (métropole et outre-mer) depuis la migration `20261015000001_national.sql`.
- **BOAMP** : tous départements ; fenêtre initiale de 14 jours ; 4 000 annonces au plus par synchronisation (plafond technique 9 900) ; uniquement les avis dont la date limite n'est pas passée.
- **TED** : pays FRA (acheteurs français), tous lieux d'exécution ; fenêtre initiale de 14 jours ; 2 000 avis au plus.
- Un filtre géographique reste possible (`departments` pour BOAMP, `nuts` pour TED) dans les réglages de la source.

### Correspondances

- **Secteurs** : codes CPV d'abord (ex. `5053…` maintenance de machines → *Maintenance industrielle* ; `7273…` → *Cybersécurité*), puis mots-clés de l'objet. La règle appliquée est conservée pour chaque annonce. Les annonces non classées restent publiées, sans secteur.
- **Géographie** : BOAMP fournit le code département (région déduite) ; TED fournit le code NUTS 2021 du lieu d'exécution, converti pour les 101 départements (`src/lib/geo.ts`, ex. FR101 → 75, FRJ23 → 31, FRY40 → 974) ; un code régional seul (ex. FRK) donne la région. Sans commune, l'annonce est localisée à la plus grande ville du département pour la recherche par rayon.
- **Villes** : communes de plus de 10 000 habitants importées automatiquement depuis l'API officielle **geo.api.gouv.fr** (Licence Ouverte), une fois, par la tâche planifiée ; villes bretonnes existantes conservées.

## Chaîne de traitement

`Source → Collecte → Normalisation → Déduplication → Validation → Publication → Mise à jour → Expiration`

| Étape | Règle |
|---|---|
| Collecte | 3 tentatives en cas d'indisponibilité (attente 5 s puis 15 s) ; incrémentale, depuis la dernière synchronisation réussie (avec 2 jours de recouvrement) ; pagination ; délai d'attente de 25 s ; identifiant `User-Agent` explicite |
| Normalisation | Titre, résumé, acheteur, dates (publication, limite), département, CPV, mots-clés, URL d'origine (`https` uniquement) |
| Import par lots | Lecture groupée des annonces déjà connues (300 par requête), insertion par lots de 200, index des doublons potentiels chargé une fois par synchronisation : plusieurs milliers d'annonces en quelques secondes |
| Déduplication | Même identifiant à la même source = mise à jour. Même acheteur normalisé + même date limite + titres similaires (Jaccard ≥ 0,5) dans une **autre** source = même consultation : la source est rattachée comme secondaire (« Également publiée sur »), sans doublon visible |
| Validation | Annonces annulées ou dont la date limite est dépassée : ignorées à la création. Champs obligatoires manquants : annonce écartée et motif journalisé |
| Publication | Statut publié, origine `EXTERNAL`, `is_demo = false`, alertes immédiates déclenchées |
| Mise à jour | Empreinte du contenu : seules les annonces réellement modifiées sont réécrites ; annulation à la source → archivage avec motif |
| Expiration | Date limite dépassée → « EXPIRÉE » ; annonce sans date limite non revérifiée depuis 60 jours → expirée |

Chaque exécution est journalisée (**Administration → Synchronisations**) : lues, créées, mises à jour, inchangées, doublons rattachés, ignorées, expirées, erreurs, durée.

## Vérification sur données réelles (6 octobre 2026)

Mesures réalisées par `npm run sources:check` (GitHub Actions) sur les API réelles, puis rejeu d'un échantillon à travers le pipeline complet :

| | BOAMP | TED |
|---|---|---|
| Avis lus (Bretagne, 21 derniers jours) | 200 | 200 (filtre NUTS côté serveur) |
| Exploitables | 200 (100 %) | 200 (100 %) |
| Avec date limite | 100 % | 77 % (les autres n'en publient pas dans les champs structurés) |
| Classés dans un secteur | 94 % | 97 % |
| Échantillon rejoué | 29 avis → 29 opportunités | 30 avis → 15 nouvelles + **15 rattachées à l'avis BOAMP correspondant** |

Corrections apportées grâce à ces mesures : filtrage géographique TED côté serveur (9 → 200 avis utiles), lecture des dates TED au format `AAAA-MM-JJ+fuseau`, date limite de candidature des procédures restreintes, 5 secteurs ajoutés, rapprochement des acheteurs aux intitulés différents.

## Sources évaluées, non intégrées

| Source | Raison | Suite possible |
|---|---|---|
| **APProch** (projets d'achats publics, data.economie.gouv.fr) | Licence ouverte, mais il s'agit de **projets** d'achats, pas de consultations ouvertes ; correspondance des champs non vérifiée sur données réelles | Enregistrée « Validation juridique en cours », inactive ; activable après test (*Tester la collecte*) |
| **DECP** (données essentielles de la commande publique, data.gouv.fr) | Licence ouverte, mais ce sont des marchés **attribués** : ce ne sont pas des opportunités | Intéressant pour une future fonction « acheteurs actifs / historique des marchés » |
| **PLACE**, **Mégalis Bretagne** et autres profils d'acheteurs | Aucune API publique documentée pour les consultations en cours ; la collecte supposerait du scraping, exclu. Les avis au-dessus des seuils de publicité sont publiés au BOAMP et/ou au JOUE, donc déjà couverts | Convention d'échange de données avec la plateforme |
| Agrégateurs commerciaux de veille | Contenus protégés, réutilisation interdite sans contrat | Partenariat commercial uniquement |

## Ajouter une source

1. Vérifier et archiver les conditions de réutilisation (licence, mentions obligatoires, limites d'usage de l'API).
2. *Administration → Sources* : créer la source (statut brouillon) avec la licence et la mention d'attribution.
3. Si l'API est un jeu de données Opendatasoft, le connecteur générique `ods-generic` suffit : renseigner `endpoint` et `fieldMap` dans la configuration, puis **Tester la collecte** (échantillon normalisé, sans écriture).
4. Approuver la source (confirmation explicite de la validation juridique, journalisée), puis l'activer.

## Vérification continue

Le workflow GitHub `sources.yml` exécute chaque jour `npm run sources:check` contre les API réelles de BOAMP et de TED, sans écriture en base. Il échoue si une source ne répond plus ou si plus aucune annonce n'est exploitable (changement de format).
