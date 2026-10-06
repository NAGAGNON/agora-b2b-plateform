# LinkProB2B

> **Des opportunités qui créent des connexions.**
> Les bonnes opportunités. Les bons partenaires. Au bon moment.

LinkProB2B met en relation les entreprises qui ont un besoin avec celles capables d'y répondre. La plateforme couvre :

- les besoins, demandes de devis, consultations et appels d'offres privés ;
- les marchés publics collectés automatiquement depuis BOAMP et TED, toujours identifiés comme externes, avec leur source ;
- l'annuaire, les alertes, les recommandations expliquées et la messagerie en temps réel ;
- le pipeline commercial et une console d'administration complète.

Le pilote démarre en Bretagne, Finistère en priorité ; l'architecture est nationale.

## Mettre en ligne

[![Déployer avec Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNAGAGNON%2Fagora-b2b-plateform&project-name=linkprob2b&repository-name=linkprob2b&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=INITIAL_ADMIN_EMAIL,CRON_SECRET,RESEND_API_KEY&envDescription=INITIAL_ADMIN_EMAIL%20%3A%20votre%20e-mail%20(premier%20administrateur).%20CRON_SECRET%20%3A%20cha%C3%AEne%20al%C3%A9atoire%20de%2032%20caract%C3%A8res%20ou%20plus.%20RESEND_API_KEY%20%3A%20cl%C3%A9%20Resend%20(e-mails).&envLink=https%3A%2F%2Fgithub.com%2FNAGAGNON%2Fagora-b2b-plateform%2Fblob%2Fmain%2Fdocs%2FDEPLOIEMENT.md)

Le bouton crée le projet Vercel et la base Supabase (intégration officielle), applique les migrations au build et vous demande trois valeurs. L'environnement (`production`) est déduit automatiquement. Inscrivez-vous ensuite avec `INITIAL_ADMIN_EMAIL` : vous êtes administrateur. Détails, environnements, sauvegardes et retour arrière : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).

## Documentation

| Document | Contenu |
|---|---|
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Développement / staging / production, variables, migrations, sauvegardes, rollback, supervision |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, modèle de données, cycle de vie, recherche, temps réel, choix techniques |
| [docs/SOURCES-EXTERNES.md](docs/SOURCES-EXTERNES.md) | Sources intégrées et leurs licences, chaîne de collecte, déduplication, sources écartées |
| [docs/SECURITE.md](docs/SECURITE.md) | Mesures de sécurité et points d'attention |
| [docs/RGPD.md](docs/RGPD.md) | Données traitées, droits, conservation, sous-traitants |
| [docs/TESTS.md](docs/TESTS.md) | Stratégie et suites de tests, comment les lancer |
| [docs/ETAT-DU-PROJET.md](docs/ETAT-DU-PROJET.md) | Ce qui fonctionne, ce qui attend vos comptes ou une validation |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), **TypeScript**, **Tailwind CSS 4**
- **Supabase** : PostgreSQL (RLS sur toutes les tables), Auth (e-mail + mot de passe, TOTP), Storage, Realtime
- **Resend** pour les e-mails transactionnels
- **Vercel** (région Paris `cdg1`) avec une tâche planifiée quotidienne
- Tests : **Vitest** (unitaires, intégration sur base réelle) et **Playwright** (E2E, temps réel, responsive)
- CI : **GitHub Actions** (qualité, intégration + E2E, test de contrat quotidien des sources)

## Démarrage local

Prérequis : Node.js ≥ 20.9 et Docker.

```bash
npm install
npm run db:start            # Supabase local (base, auth, stockage, temps réel) + migrations
npx supabase status -o env  # clés locales
cp .env.example .env.local  # renseigner SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY
npm run seed:demo           # données de démonstration ; identifiants dans .demo-credentials.local.md
npm run dev                 # http://localhost:3000
```

## Données de démonstration et données réelles

Les deux ne se mélangent pas :

| | Démonstration | Réel |
|---|---|---|
| Marquage | `is_demo = true`, noms « Démo… » / « [DÉMO] », e-mails `@demo.linkprob2b.test` | `is_demo = false` |
| Affichage | bandeau « Données de démonstration » + badges « Démo » | normal |
| Production | **interdit** : seed refusé, données masquées des recherches et fiches | seul contenu |
| Alertes et e-mails | jamais | oui |
| Sitemap / SEO | exclu (`noindex`) | indexé s'il y a du contenu |

```bash
npm run seed:demo    # supprime l'ancien jeu démo puis recrée 8 entreprises, 22 opportunités, 7 comptes fictifs
npm run seed:clean   # supprime toutes les données de démonstration (comptes, entreprises, opportunités, source fictive)
```

- Le seed est **refusé** lorsque `APP_ENV=production`.
- Les mots de passe sont aléatoires, écrits dans `.demo-credentials.local.md` (ignoré par Git) ; `DEMO_PASSWORD` permet d'imposer un mot de passe pour les tests automatisés.
- En staging, la même opération existe dans **Administration → Paramètres** (super-administrateur).
- `seed:clean` ne touche aucune donnée réelle : il cible uniquement `is_demo = true` et le domaine de démonstration.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `start` | développement, serveur de production |
| `npm run build` | migrations (si une base est configurée) puis build |
| `npm run build:app` | build seul |
| `npm run lint` / `typecheck` | ESLint et TypeScript |
| `npm run test:unit` / `test:integration` / `test:e2e` | voir [docs/TESTS.md](docs/TESTS.md) |
| `npm run db:start` / `db:stop` / `db:reset` | Supabase local |
| `npm run db:migrate` / `db:status` | migrations via `DATABASE_URL` |
| `npm run db:types` | régénère `src/lib/database.types.ts` |
| `npm run seed:demo` / `seed:clean` | données de démonstration |
| `npm run sources:check` | test de contrat contre les API BOAMP et TED (lecture seule) |
| `npm run create-admin -- email "Nom"` | crée ou promeut un super-administrateur |

## Organisation du dépôt

```
.github/workflows/     ci.yml (qualité, intégration, E2E) · sources.yml (contrat BOAMP/TED quotidien)
docs/                  documentation (déploiement, architecture, sources, sécurité, RGPD, tests, état)
scripts/               migrate.mjs, seed-demo.ts, create-admin.ts, check-sources.ts
supabase/migrations/   schéma, RLS, fonctions métier, référentiels, pipeline de sources
src/proxy.ts           session et protection des espaces privés
src/app/(site)/        pages publiques, /dashboard (espace connecté), /admin
src/app/actions/       Server Actions (validation zod + RPC)
src/app/api/           fichiers privés, export RGPD, tâche planifiée, santé
src/components/        design system (ui/) et composants métier
src/lib/collect/       connecteurs, normalisation, classification, déduplication
src/lib/               Supabase, auth, e-mails, validation, recherche, démo
tests/                 unit/, integration/, e2e/, fixtures/
```
