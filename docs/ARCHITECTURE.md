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
Vercel Cron (quotidien) ──▶ /api/cron/quotidien : expiration, résumés d'alertes, file d'e-mails ──▶ Resend
```

**Principe de sécurité** : le navigateur ne reçoit aucune clé capable de lire des données. Toutes les lectures et écritures passent par le serveur Next.js, avec la session de l'utilisateur, et sont donc soumises à la RLS. La clé publishable n'est transmise au navigateur que pour l'envoi d'un fichier via une URL signée déjà autorisée. La clé secrète n'est utilisée que dans du code serveur de confiance : tâches planifiées, suppression de compte, formulaire de contact, limitation de débit.

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

- Origine `EXTERNAL`, types `EXTERNAL_OPPORTUNITY` ou `PUBLIC_TENDER` (contrainte en base).
- Création uniquement via `admin_create_external_opportunity`, et seulement depuis une source au statut `APPROVED`.
- Une source ne passe à `APPROVED` qu'avec confirmation explicite de la validation juridique et technique ; cette confirmation est journalisée.
- BOAMP et TED sont enregistrées au statut « Validation juridique en cours ». **Aucune importation automatique, aucun scraping.**
- La fiche affiche le badge « Opportunité externe », la source, la référence, les dates de publication, de référencement et de vérification, et le bouton « Consulter l'annonce sur le site source » (redirection `/go/[id]`, clic compté de façon agrégée). Aucun bouton de candidature interne n'est proposé.
- Suspendre une source retire de la publication les opportunités qui en proviennent.

## Recherche

`search_opportunities` (security invoker, donc soumise à la RLS) combine :

- le plein texte en français (`tsvector` pondéré : titre, compétences, description) ;
- les filtres : secteur, département, type, provenance, statut, dates, taille, compétences ;
- la distance (formule de Haversine depuis une commune de référence) ;
- le tri (récentes, échéance, pertinence, distance) et la pagination.

Les recommandations (`recommended_opportunities`) sont explicables : secteur, département et compétences communes, affichés en badges. Il n'y a pas d'IA opaque.

## Fichiers

1. Le serveur vérifie le type et la taille, puis crée une **URL d'envoi signée** avec la session de l'utilisateur. La politique de stockage refuse si l'utilisateur n'a pas de droits sur le dossier.
2. Le navigateur envoie le fichier directement au stockage. Cela respecte la limite de 4,5 Mo par requête de Vercel ; la taille maximale par fichier est de 10 Mo.
3. Le serveur relit le fichier, contrôle sa **signature binaire** (PDF, PNG, JPEG, Office, OpenDocument), supprime tout fichier invalide, puis l'enregistre.
4. Les téléchargements passent par `/api/fichiers/...` avec la session de l'utilisateur : double contrôle, sur la table des métadonnées et sur le stockage.

## Notifications et e-mails

- Les notifications internes sont créées en base par les RPC et déclencheurs : intérêt reçu, réponse reçue, décision, message, statut de modération, alerte…
- Les e-mails sont mis en file (`email_outbox`). Ils partent juste après l'action (`after()`) si Resend est configuré, sinon lors de la tâche quotidienne. Sans fournisseur configuré, ils sont marqués `SKIPPED` : rien n'est envoyé.
- Alertes : immédiates (à la publication), quotidiennes ou hebdomadaires (résumé). Chaque résumé contient un lien de désabonnement en un clic, avec une confirmation pour éviter les désinscriptions par préchargement.

## Sécurité

| Mesure | Mise en œuvre |
|---|---|
| Authentification | Supabase Auth, mots de passe ≥ 10 caractères, confirmation par e-mail, TOTP (obligatoire pour l'administration si le paramètre est activé) |
| Autorisation | RLS sur 100 % des tables publiques, droits `UPDATE` limités par colonne, RPC security definer avec contrôle explicite des droits |
| Validation | zod côté serveur sur toutes les Server Actions ; contraintes `CHECK` en base |
| Injections | Requêtes paramétrées (PostgREST / RPC), aucune concaténation SQL ; filtres de recherche nettoyés |
| XSS | Rendu React échappé, aucun `dangerouslySetInnerHTML`, CSP stricte (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`) |
| CSRF | Server Actions protégées par Next.js (vérification d'origine) ; cookies de session `SameSite=Lax` |
| Fichiers | Liste blanche MIME, 10 Mo maximum, signature binaire vérifiée, noms nettoyés, buckets privés |
| Limitation de débit | Connexion, inscription, mot de passe oublié, contact (empreinte d'IP salée et hachée) ; actions métier limitées par utilisateur en base |
| Redirections | Paramètre `suite` limité aux chemins internes ; redirection externe uniquement vers les URL de sources enregistrées |
| Erreurs | Messages génériques côté client, détails uniquement dans les journaux serveur |
| Journalisation | `audit_logs` (modération, administration, entreprises, réponses, clôtures, suppressions de compte) |
| En-têtes | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ; `noindex` sur les espaces privés |

## RGPD

- Export des données personnelles (JSON) et suppression du compte en libre-service.
- Lors de la suppression, une entreprise dont l'utilisateur est le seul membre est supprimée avec lui ; sinon, le rôle d'administrateur est transmis au membre le plus ancien.
- Minimisation :
  - analytics sans IP ni cookie ;
  - limitation de débit par empreinte hachée, purgée régulièrement (fenêtres de plus de 2 jours) ;
  - coordonnées des entreprises visibles des seuls membres connectés.
- Cookies : uniquement des cookies strictement nécessaires (session, entreprise active). Aucun bandeau n'est requis tant qu'aucun traceur non essentiel n'est ajouté.
- Les pages légales sont des modèles à compléter et à faire valider.

## Analytics (événements)

Les événements sont enregistrés par `track_event`, avec une liste fermée :

`view_opportunity`, `search_opportunities`, `create_account`, `create_company`, `publish_opportunity`, `express_interest`, `submit_proposal`, `save_favorite`, `create_alert`, `contact_company`, `source_outbound_clicked`, `profile_completed`, `view_company`, `search_companies`.

Les KPI sont calculés en temps réel par `admin_stats` dans **Administration → Vue d'ensemble**.

## Modèle économique (préparation)

- Table `plans` : `PILOT` gratuit par défaut, plus `FREE`, `SUPPLIER_PRO` et `BUYER_PRO` marquées « non commercialisées ».
- Chaque entreprise porte un `plan_code`.
- Aucun paiement n'est implémenté.

## Choix notables

- **Pas de client Supabase dans le navigateur** : surface d'attaque réduite et une seule origine. Le navigateur ne contacte le stockage que pour envoyer un fichier via URL signée.
- **Logique métier en base** : les règles critiques (transitions, droits, notifications, journal) ne dépendent pas de l'interface et sont testées directement sur la base (`tests/integration`).
- **Pages SEO secteur et département** (`/opportunites/maintenance-industrielle`, `/opportunites/finistere`, `/entreprises/<secteur>/<departement>`) : indexées seulement si elles ont du contenu réel. Les combinaisons de filtres ne sont pas indexées, et les données de démonstration sont exclues du sitemap.
