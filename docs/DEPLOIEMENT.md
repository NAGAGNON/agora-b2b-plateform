# Déploiement de LinkProB2B

## Trois environnements séparés

| Environnement | Où | Base de données | Données | Comptes |
|---|---|---|---|---|
| **Développement** | poste local (`npm run dev`) | Supabase local (Docker) | démo + tests | activés immédiatement |
| **Staging / Preview** | Vercel « Preview » (une URL par branche) | projet Supabase **dédié au staging** | démo autorisée (`APP_ENV=staging`) | activés immédiatement si aucun fournisseur e-mail |
| **Production** | Vercel « Production » (domaine) | projet Supabase de production | **réelles uniquement** | confirmation par e-mail obligatoire |

Garde-fous qui empêchent de mélanger les deux mondes :

- `APP_ENV=production` (déduit automatiquement de `VERCEL_ENV=production`) : `npm run seed:demo` et le bouton « Charger les données de démonstration » sont **refusés**. Les données `is_demo` éventuelles sont masquées des recherches, de l'annuaire, des recommandations et des fiches (404).
- Les alertes et e-mails ignorent toujours les opportunités de démonstration.
- Les déploiements de prévisualisation **n'appliquent pas** les migrations, sauf `MIGRATIONS_ON_PREVIEW=1` (à ne définir que si l'environnement Preview pointe vers la base de staging).

## Prévisualisation interactive immédiate (sans compte)

Le workflow `.github/workflows/preview.yml` lance l'application complète sur un exécuteur GitHub et l'expose sur une URL publique `https://….trycloudflare.com` :
- base, authentification, stockage et temps réel (Supabase) ;
- marchés publics BOAMP et TED collectés en direct, puis synchronisés toutes les heures ;
- boîte e-mail de test, qui affiche tous les e-mails envoyés ;
- confirmation d'e-mail obligatoire ;
- comptes de test.

Lancement : à chaque commit dont le message contient `[preview]`, ou depuis **Actions → Prévisualisation → Run workflow**. L'URL est publiée dans l'onglet **Deployments** du dépôt et dans l'issue « Prévisualisation LinkProB2B ». Durée : 5 h 30 au plus ; les données sont effacées à l'arrêt. Ce n'est pas un hébergement de production.

## Mise en ligne en une action (bouton « Deploy »)

Le bouton du [README](../README.md#mettre-en-ligne) ouvre Vercel et enchaîne :

1. la copie du dépôt dans votre compte GitHub ;
2. la création d'un projet **Supabase** (intégration officielle Vercel ↔ Supabase), qui fournit automatiquement `SUPABASE_URL`, les clés et `POSTGRES_URL_NON_POOLING` ;
3. la saisie de trois valeurs :
   - `INITIAL_ADMIN_EMAIL` : votre adresse, promue super-administrateur à votre première inscription ou connexion ;
   - `CRON_SECRET` : une chaîne aléatoire d'au moins 32 caractères (protège la tâche planifiée) ;
   - `RESEND_API_KEY` : votre clé Resend (e-mails de confirmation, mot de passe, notifications, alertes) ;
   L'environnement `production` est déduit de Vercel : démonstration interdite, confirmation d'e-mail obligatoire.
4. le build : `node scripts/migrate.mjs` crée toutes les tables, la sécurité et les données de référence et marque la base « production » (seed démo refusé même avec une mauvaise variable), puis une première collecte BOAMP/TED (non bloquante), puis `next build`. La collecte se poursuit chaque jour à 06:00 UTC (tâche planifiée).

Ensuite : ouvrez l'URL fournie par Vercel, inscrivez-vous avec `INITIAL_ADMIN_EMAIL` : vous êtes administrateur. En staging, **Administration → Paramètres → Charger les données de démonstration** crée les comptes fictifs et affiche leurs identifiants une seule fois.

> Le bouton copie la **branche par défaut** du dépôt. Le travail en cours doit donc d'abord être fusionné dans `main`.

## Mise en ligne manuelle (dépôt existant, avec prévisualisations par branche)

1. **Supabase** : https://supabase.com → *New project*, région **Paris (eu-west-3)**. Créez deux projets pour séparer staging et production.
2. **Vercel** : *Add New → Project* → importez `agora-b2b-plateform`. Chaque push sur une branche crée une URL de prévisualisation.
3. Dans Vercel, *Integrations → Supabase* : liez le projet de production à l'environnement **Production** et le projet de staging à **Preview**. Sinon, saisissez les variables à la main (tableau ci-dessous).
4. Variables propres à l'application (*Settings → Environment Variables*) :

| Variable | Production | Preview | Rôle |
|---|---|---|---|
| `APP_ENV` | `production` | `staging` | comportement de l'environnement (déduit de Vercel s'il est absent) |
| `INITIAL_ADMIN_EMAIL` | votre adresse | votre adresse | premier super-administrateur |
| `CRON_SECRET` | aléatoire | aléatoire | tâche planifiée `/api/cron/quotidien` |
| `RESEND_API_KEY` | **requis** | facultatif | e-mails : confirmation, mot de passe, notifications, alertes |
| `ANTHROPIC_API_KEY` | conseillé | — | analyses de marché quotidiennes rédigées par IA (Administration → Articles) |
| `INDEXNOW_KEY` | facultatif | — | clé IndexNow ; à défaut, dérivée de `CRON_SECRET` et publiée sur `/indexnow.txt` |
| `EMAIL_FROM` | `LinkProB2B <notifications@votre-domaine.fr>` | idem | domaine vérifié chez Resend (SPF, DKIM, DMARC) |
| `SITE_URL` | `https://votre-domaine.fr` | — (déduit de l'URL Vercel) | liens des e-mails, sitemap, URL canoniques |
| `MIGRATIONS_ON_PREVIEW` | — | `1` si base de staging dédiée | migrations au déploiement des branches |
| `DATABASE_CA_CERT` | conseillé | conseillé | certificat Supabase (PEM) pour vérifier le TLS des migrations |

Variables Supabase (fournies par l'intégration, ou à saisir) : `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_ANON_KEY`), `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`), `POSTGRES_URL_NON_POOLING` (ou `DATABASE_URL`).

> `SUPABASE_URL` est aussi lue **au build**, pour autoriser le stockage et le temps réel (WebSocket) dans la politique de sécurité (CSP). Après l'avoir modifiée, redéployez.

### Réglages Supabase (production)

- *Authentication → Providers → Email* : « Confirm email » **activé**.
- *Authentication → URL Configuration* : Site URL = `SITE_URL`. Les liens de confirmation sont construits par l'application (`/auth/confirmation?token_hash=…`).
- *Authentication → SMTP* : facultatif si `RESEND_API_KEY` est défini, car l'application envoie elle-même les e-mails d'authentification. Sans Resend, le service intégré de Supabase n'envoie qu'aux membres de l'équipe, en très faible volume.
- *Authentication → Multi-Factor* : TOTP activé.

## Domaine linkprob2b.com

Côté application, rien à régler : URL canoniques, sitemap et liens des e-mails suivent le domaine de production Vercel (ou `SITE_URL`), cookies `Secure` en HTTPS, expéditeur par défaut `notifications@linkprob2b.com` (déduit du domaine).

1. **Vercel → Settings → Domains** : `www.linkprob2b.com` (principal) et `linkprob2b.com` (redirigé vers `www`). Certificat HTTPS automatique.
2. **Chez le registraire** : les enregistrements affichés par Vercel pour chaque domaine (A pour `@`, CNAME pour `www`).
3. **Supabase → Authentication → URL Configuration** : Site URL `https://www.linkprob2b.com`.
4. **Resend → Domains → Add domain** `linkprob2b.com` : copier chez le registraire les enregistrements affichés (SPF, DKIM, retour).

## SEO automatique

Chaque jour, la tâche planifiée (`/api/cron/quotidien`, 06:00 UTC) :

1. collecte BOAMP et TED, puis expire les annonces échues ;
2. **publie au moins une analyse de marché** rédigée par Claude à partir des seules données de la plateforme. Thèmes en alternance (secteur, département, secteur × département, acheteur public ; chacun une fois par mois, au moins 5 opportunités ouvertes), puis, en dernier recours, la synthèse bretonne du jour. Chaque chiffre est comparé au jeu de données transmis : en cas d'écart, l'article est réécrit une fois, puis le thème suivant est essayé ; un article non conforme reste en brouillon et ne compte pas dans le quota quotidien. Couverture et graphiques générés à partir des mêmes données. Réglages dans **Administration → Articles** (1 à 3 articles par jour, publication automatique) ;
3. **signale à IndexNow** (Bing, Yandex, Seznam…) les annonces et articles nouveaux ou modifiés depuis le dernier envoi (production, domaine personnalisé uniquement).

Les pages publiques portent des données structurées schema.org (Organization, WebSite avec recherche, BreadcrumbList, Article, FAQPage). Les analyses sont sur `/analyses` et dans le sitemap.

## Migrations

- Au déploiement de production : `npm run build` = `node scripts/migrate.mjs && next build`.
- Chaque migration s'exécute **dans une transaction**. En cas d'échec, rien n'est appliqué, le build échoue, et **Vercel conserve la version en ligne précédente**.
- Un verrou consultatif empêche deux déploiements de migrer en même temps.
- Le journal (`supabase_migrations.schema_migrations`) est compatible avec la CLI : `npx supabase db push` reste utilisable.
- `npm run db:status` liste les migrations appliquées, avec `DATABASE_URL` défini.
- Règle d'écriture : migrations **additives** (nouvelles colonnes nullables, nouvelles fonctions), pour que la version précédente de l'application continue de fonctionner pendant un retour arrière.

## Retour arrière (rollback)

| Problème | Action |
|---|---|
| Régression applicative | Vercel → *Deployments* → version précédente → **Promote to Production** (instantané) |
| Migration erronée | écrire une migration corrective (pas de modification d'une migration déjà appliquée) puis redéployer |
| Données perdues ou corrompues | Supabase → *Database → Backups* : restauration (quotidienne ; *Point-in-Time Recovery* selon l'offre) |

## Sauvegardes

- Supabase réalise des **sauvegardes quotidiennes** sur les offres payantes. Sur l'offre gratuite, aucune sauvegarde n'est restaurable : prévoyez un export régulier, ou passez à l'offre Pro avant l'ouverture.
- Export manuel : `pg_dump "$POSTGRES_URL_NON_POOLING" -Fc -f linkprob2b-$(date +%F).dump`.
- Fichiers (logos, documents) : bucket Supabase Storage, inclus dans le projet ; à exporter séparément si nécessaire.
- **Testez une restauration** sur le projet de staging avant l'ouverture.

## Supervision, journaux et erreurs

- **`/api/sante`** : état de la base, environnement, version déployée, dernière exécution de la tâche planifiée. Renvoie 503 si la base est indisponible. À brancher sur un moniteur de disponibilité (UptimeRobot, Better Stack…).
- **Journaux** : Vercel → *Logs* (erreurs serveur préfixées `[linkprob2b]`, sans données personnelles) ; Supabase → *Logs* (base, authentification, temps réel).
- **Tâche planifiée** : Vercel → *Cron Jobs* ; le résultat de chaque étape est visible dans **Administration → Synchronisations**.
- **Sources externes** : journal de chaque collecte dans **Administration → Synchronisations**. Le workflow GitHub `sources.yml` vérifie chaque jour que les API BOAMP et TED répondent et restent compatibles.
- **E-mails** : **Administration → E-mails → Envoyer les modèles de contrôle** envoie les 15 modèles à votre adresse et vérifie liens, statut Resend et absence de double envoi. Table `email_outbox` (statut, tentatives, dernière erreur). Jusqu'à 5 tentatives pour les erreurs temporaires, avec clé d'idempotence côté Resend.
- **Audit** : **Administration → Journal d'audit** (modération, rôles, paramètres, secteurs, données de démonstration).

## Avant l'ouverture au public

- [ ] `APP_ENV=production`, `RESEND_API_KEY` et `EMAIL_FROM` configurés ; domaine d'envoi authentifié
- [ ] Nom de domaine configuré dans Vercel, `SITE_URL` et Supabase
- [ ] Super-administrateur avec double authentification ; double authentification obligatoire pour l'administration activée
- [ ] Aucune donnée de démonstration (**Administration → Paramètres** : 0)
- [ ] Sauvegardes actives et restauration testée
- [ ] Pages légales complétées et validées (voir [RGPD.md](RGPD.md))
- [ ] Sources externes : conditions de réutilisation revues (voir [SOURCES-EXTERNES.md](SOURCES-EXTERNES.md))
- [ ] Search Console : sitemap `https://<domaine>/sitemap.xml` soumis

## Développement local

Voir le [README](../README.md#démarrage-local). Dans certains environnements restreints, les images Docker de Supabase ne sont accessibles que via Docker Hub :

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npm run db:start
```
