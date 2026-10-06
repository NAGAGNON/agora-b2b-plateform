# Architecture technique

## Vue d'ensemble

```
Navigateur ──HTTPS──▶ Next.js 16 (Vercel)
                        │  proxy.ts : rafraîchit la session, protège /dashboard, /admin, /onboarding
                        │  Server Components : lecture (session de l'utilisateur → RLS)
                        │  Server Actions : écriture (validation zod → RPC / requêtes sous RLS)
                        ▼
                     Supabase
                        ├─ PostgreSQL : tables + RLS + fonctions métier (RPC security definer)
                        ├─ Auth : e-mail / mot de passe, confirmation, réinitialisation, TOTP
                        └─ Storage : 4 buckets (logos publics ; documents, réponses, pièces jointes privés)
Navigateur ──URL signée──▶ Storage (envoi direct des fichiers, après contrôle des droits)
Navigateur ◀──WebSocket── Realtime (nouveaux messages, notifications ; filtrés par la RLS)
Vercel Cron (quotidien) ──▶ /api/cron/quotidien : collecte BOAMP/TED, expiration, résumés d'alertes, file d'e-mails ──▶ Resend
Build (production) ──▶ scripts/migrate.mjs : migrations SQL transactionnelles
```

**Principe de sécurité** : toutes les lectures et écritures de données passent par le serveur Next.js, avec la session de l'utilisateur, et sont donc soumises à la RLS. La clé publishable (publique par conception) est transmise au navigateur pour l'envoi d'un fichier via une URL signée déjà autorisée et pour l'abonnement temps réel, lui aussi filtré par la RLS. La clé secrète n'est utilisée que dans du code serveur de confiance : tâches planifiées, suppression de compte, formulaire de contact, limitation de débit.

## Modèle de données (PostgreSQL)

| Domaine | Tables |
|---|---|
| Référentiels | `sectors`, `opportunity_types`, `departments` (101), `places` (communes avec coordonnées pour la recherche par rayon), `plans` |
| Comptes | `users` (profil lié à `auth.users`, rôle plateforme, statut), `companies`, `company_members` (rôle entreprise), `company_profiles`, `company_invitations` |
| Opportunités | `opportunities`, `opportunity_documents`, `external_sources`, `opportunity_sources` (source, référence, URL originale, dates de vérification) |
| Réponses | `interests`, `proposals`, `proposal_documents`, `proposal_evaluations` (notes privées du demandeur) |
| Suivi commercial | `pipeline_items` (privé à l'entreprise), `favorites`, `saved_searches`, `alerts` |
| Échanges | `conversations`, `messages`, `notifications`, `email_outbox` |
| Gouvernance | `reports`, `moderation_actions`, `audit_logs`, `analytics_events`, `rate_limits`, `platform_settings`, `contact_messages` |

Migrations :

1. `…001_schema.sql` : types et tables
2. `…002_security.sql` : fonctions d'aide, déclencheurs, RLS, droits par colonne, stockage
3. `…003_business_functions.sql` : RPC métier, recherche, notifications, modération, RGPD
4. `…004_reference_data.sql` : données de référence réelles, aucune entreprise ni opportunité

## Rôles

- **Plateforme** (`users.platform_role`) : `USER`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`.
- **Entreprise** (`company_members.role`) : `COMPANY_MEMBER`, `COMPANY_ADMIN`.

| Action | Qui |
|---|---|
| Publier, répondre, gérer une consultation | Membre de l'entreprise |
| Modifier le profil entreprise, gérer l'équipe | Administrateur de l'entreprise |
| Modérer, suspendre opportunités et entreprises, traiter les signalements, référencer une opportunité externe | Modérateur et au-dessus |
| Gérer les utilisateurs, vérifier une entreprise, gérer les sources, consulter l'audit, modifier les paramètres | Administrateur et au-dessus |
| Nommer ou révoquer un administrateur | Super administrateur |

Ces règles sont appliquées **en base** (RLS, droits par colonne, déclencheurs, contrôles dans les RPC) et répétées côté serveur Next.js (`requireStaff`, `requireAdmin`…). L'interface ne fait que les refléter.

## Cycle de vie d'une opportunité

```
DRAFT → PENDING_REVIEW → PUBLISHED → CLOSED / EXPIRED → ARCHIVED
              ↘ CHANGES_REQUESTED / REJECTED      ↘ SUSPENDED (modération)
```

- Le déclencheur `enforce_opportunity_rules` refuse toute transition non autorisée à un membre : impossible de se publier soi-même ou de modifier un champ protégé.
- Une modification du titre, de la description ou du budget d'une opportunité publiée la renvoie en validation.
- Les transitions de modération passent par `moderate_opportunity` (motif obligatoire pour refuser, demander une modification ou suspendre). Chacune est journalisée dans `moderation_actions` et `audit_logs`.
- Une opportunité publiée dont la date limite est dépassée est affichée « Expirée » immédiatement. La tâche quotidienne la passe ensuite au statut `EXPIRED`.

## Opportunités externes

- Origine `EXTERNAL`, types `EXTERNAL_OPPORTUNITY` ou `PUBLIC_TENDER` (contrainte en base). Il est impossible de les confondre avec une demande publiée sur LinkProB2B : badge « Opportunité externe » / « Marché public », bloc « Source : BOAMP · Référence · Date », bouton **« Consulter l'annonce originale »**, aucun bouton de candidature interne.
- Collecte automatique (`src/lib/collect/`) **uniquement** pour les sources au statut `APPROVED` dont les conditions de réutilisation ont été vérifiées (voir [SOURCES-EXTERNES.md](SOURCES-EXTERNES.md)) : BOAMP (API Opendatasoft de la DILA) et TED (API de recherche v3). Aucun scraping.
- Chaîne de traitement : **collecte** (connecteur par source, pagination, fenêtre incrémentale depuis la dernière synchronisation réussie) → **normalisation** (titre, acheteur, dates, département, CPV, URL d'origine) → **classification** (CPV puis mots-clés, règle explicable) → **déduplication** → **publication** → **mise à jour** (empreinte du contenu ; annulation à la source → archivage) → **expiration**.
- Déduplication : même `(source, identifiant externe)` = mise à jour ; même acheteur normalisé + même date limite + titres similaires (Jaccard ≥ 0,5) provenant d'une **autre** source = même consultation, la source est rattachée comme secondaire (« Également publiée sur… »).
- Expiration : date limite dépassée → « EXPIRÉE » immédiatement à l'affichage, statut `EXPIRED` par la tâche quotidienne ; annonce externe sans date limite non revérifiée depuis 60 jours → expirée.
- Chaque exécution est journalisée dans `source_sync_runs` (lus, créés, mis à jour, inchangés, doublons, ignorés, expirés, erreurs) ; l'administration permet de synchroniser, tester (échantillon sans écriture) et régler chaque source.
- Le référencement manuel reste possible (`admin_create_external_opportunity`), toujours depuis une source approuvée. Suspendre une source retire ses opportunités de la publication.

## Recherche

`search_opportunities` (security invoker, donc soumise à la RLS) combine :

- le plein texte en français (`tsvector` pondéré : titre, compétences, description) ;
- les filtres : secteur, département, type, provenance, statut, dates, taille, compétences ;
- la distance (formule de Haversine depuis une commune de référence) ;
- le tri (récentes, échéance, pertinence, distance) et la pagination.

Les recommandations (`recommended_opportunities`) sont explicables : score sur 100 (secteur 30, zone d'intervention 25 ou département 15, compétences communes jusqu'à 30, mots-clés 10, historique favoris/intérêts 10, taille visée 5), raisons affichées sous « Pourquoi cette opportunité vous est proposée » et barème public dans **Recommandations**. Il n'y a pas d'IA opaque.

## Fichiers

1. Le serveur vérifie le type et la taille, puis crée une **URL d'envoi signée** avec la session de l'utilisateur. La politique de stockage refuse si l'utilisateur n'a pas de droits sur le dossier.
2. Le navigateur envoie le fichier directement au stockage. Cela respecte la limite de 4,5 Mo par requête de Vercel ; la taille maximale par fichier est de 10 Mo.
3. Le serveur relit le fichier, contrôle sa **signature binaire** (PDF, PNG, JPEG, Office, OpenDocument), supprime tout fichier invalide, puis l'enregistre.
4. Les téléchargements passent par `/api/fichiers/...` avec la session de l'utilisateur : double contrôle, sur la table des métadonnées et sur le stockage.

## Notifications, e-mails et temps réel

- Les notifications internes sont créées en base par les RPC et déclencheurs : intérêt reçu, réponse reçue, décision, sélection, message, statut de modération, clôture, alerte…
- **Temps réel** : un client Supabase navigateur (clé publique + session, donc soumis à la RLS) s'abonne aux tables `messages` et `notifications` (publication `supabase_realtime`). À chaque événement, la page est re-rendue côté serveur (`router.refresh()`) : nouveaux messages, accusés de lecture et cloche de notifications sans rechargement. Indicateur « En direct » dans la conversation.
- **E-mails d'authentification** (confirmation d'inscription, réinitialisation du mot de passe, bienvenue) : Supabase génère un jeton à usage unique (`admin.generateLink`), l'application envoie l'e-mail via Resend. Le jeton n'est jamais stocké.
- **E-mails de notification** : file `email_outbox` ; envoi juste après l'action (`after()`) puis par la tâche quotidienne ; 5 tentatives au plus pour les erreurs temporaires (réseau, 429, 5xx), clé d'idempotence. Gabarits HTML + texte. Sans fournisseur configuré, statut `SKIPPED`.
- Alertes : secteur, département ou **ville + rayon**, type, compétences, taille d'entreprise, mots-clés, inclusion ou non des opportunités externes ; fréquence immédiate, quotidienne ou hebdomadaire ; désabonnement en un clic.

## Sécurité

Voir [SECURITE.md](SECURITE.md).

## RGPD

Voir [RGPD.md](RGPD.md).

## Analytics (événements)

Les événements sont enregistrés par `track_event`, avec une liste fermée :

`view_opportunity`, `search_opportunities`, `create_account`, `create_company`, `publish_opportunity`, `express_interest`, `submit_proposal`, `save_favorite`, `create_alert`, `contact_company`, `source_outbound_clicked`, `profile_completed`, `view_company`, `search_companies`.

Les KPI sont calculés en temps réel par `admin_stats` dans **Administration → Vue d'ensemble**.

## Modèle économique (préparation)

- Table `plans` : `PILOT` gratuit par défaut, plus `FREE`, `SUPPLIER_PRO` et `BUYER_PRO` marquées « non commercialisées ».
- Chaque entreprise porte un `plan_code`.
- Aucun paiement n'est implémenté.

## Choix notables

- **Données lues et écrites par le serveur** : le navigateur ne contacte Supabase que pour envoyer un fichier (URL signée) et recevoir les événements temps réel (clé publique, RLS). Aucune lecture de données métier côté client.
- **Secteurs administrables** : la table `sectors` est la référence (formulaires, filtres, SEO, classification) ; ajout et désactivation dans **Administration → Référentiels**.
- **Environnements** : `APP_ENV` (development, staging, production) ; voir [DEPLOIEMENT.md](DEPLOIEMENT.md).
- **Logique métier en base** : les règles critiques (transitions, droits, notifications, journal) ne dépendent pas de l'interface et sont testées directement sur la base (`tests/integration`).
- **Pages SEO secteur et département** (`/opportunites/maintenance-industrielle`, `/opportunites/finistere`, `/entreprises/<secteur>/<departement>`) : indexées seulement si elles ont du contenu réel. Les combinaisons de filtres ne sont pas indexées, et les données de démonstration sont exclues du sitemap.
