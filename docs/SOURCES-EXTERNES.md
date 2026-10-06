# Sources externes

Règle absolue : **une source n'est collectée automatiquement que si ses conditions de réutilisation l'autorisent explicitement et si elle offre un accès technique prévu pour cela (API ou export officiel)**. Aucun scraping. Une opportunité externe est toujours présentée comme externe, avec sa source, sa référence, sa date et le lien vers l'annonce originale.

## Sources intégrées

| Source | Contenu | Accès | Conditions de réutilisation | Statut |
|---|---|---|---|---|
| **BOAMP** (DILA) | avis de marchés publics français : appels d'offres, procédures adaptées publiées au BOAMP, rectificatifs, annulations | API Opendatasoft `boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records` | **Licence Ouverte / Open Licence 2.0 (Etalab)** : réutilisation libre, y compris commerciale, avec mention de la source et de la date de mise à jour | ✅ approuvée, active |
| **TED** (Office des publications de l'UE) | avis européens au-dessus des seuils (France) | API de recherche v3 `api.ted.europa.eu/v3/notices/search` (sans clé pour la recherche) | **Réutilisation autorisée, y compris commerciale** (politique de réutilisation de la Commission, décision 2011/833/UE ; données sous CC BY 4.0), avec mention de la source | ✅ approuvée, active |

Mention affichée sur chaque fiche : « Source : BOAMP — Direction de l'information légale et administrative (DILA), Licence Ouverte 2.0 » ou « Source : TED — Office des publications de l'Union européenne ».

### Paramétrage actuel (modifiable dans *Administration → Sources → Réglages*)

- **BOAMP** : départements 22, 29, 35, 56 ; fenêtre initiale de 21 jours ; 1 000 annonces au plus par synchronisation ; uniquement les avis dont la date limite n'est pas passée.
- **TED** : pays FRA ; zones NUTS FRH01 à FRH04 (Bretagne) ; fenêtre initiale de 21 jours ; 500 avis au plus.
- **Couverture nationale** : retirer le filtre `departments` (BOAMP) ou `nuts` (TED). L'architecture le permet sans modification de code ; le volume augmente fortement.

### Correspondances

- **Secteurs** : codes CPV d'abord (ex. `5053…` maintenance de machines → *Maintenance industrielle* ; `7273…` → *Cybersécurité*), puis mots-clés de l'objet. La règle appliquée est conservée pour chaque annonce. Les annonces non classées restent publiées, sans secteur.
- **Géographie** : BOAMP fournit le code département ; TED fournit le code NUTS du lieu d'exécution (FRH02 → 29…). Sans commune, l'annonce est localisée au chef-lieu de référence du département pour la recherche par rayon.

## Chaîne de traitement

`Source → Collecte → Normalisation → Déduplication → Validation → Publication → Mise à jour → Expiration`

| Étape | Règle |
|---|---|
| Collecte | Incrémentale, depuis la dernière synchronisation réussie (avec 2 jours de recouvrement) ; pagination ; délai d'attente de 25 s ; identifiant `User-Agent` explicite |
| Normalisation | Titre, résumé, acheteur, dates (publication, limite), département, CPV, mots-clés, URL d'origine (`https` uniquement) |
| Déduplication | Même identifiant à la même source = mise à jour. Même acheteur normalisé + même date limite + titres similaires (Jaccard ≥ 0,5) dans une **autre** source = même consultation : la source est rattachée comme secondaire (« Également publiée sur »), sans doublon visible |
| Validation | Annonces annulées ou dont la date limite est dépassée : ignorées à la création. Champs obligatoires manquants : annonce écartée et motif journalisé |
| Publication | Statut publié, origine `EXTERNAL`, `is_demo = false`, alertes immédiates déclenchées |
| Mise à jour | Empreinte du contenu : seules les annonces réellement modifiées sont réécrites ; annulation à la source → archivage avec motif |
| Expiration | Date limite dépassée → « EXPIRÉE » ; annonce sans date limite non revérifiée depuis 60 jours → expirée |

Chaque exécution est journalisée (**Administration → Synchronisations**) : lues, créées, mises à jour, inchangées, doublons rattachés, ignorées, expirées, erreurs, durée.

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
