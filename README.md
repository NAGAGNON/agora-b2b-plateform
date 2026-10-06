# LinkProB2B

> **Des opportunités qui créent des connexions.**
> Les bonnes opportunités. Les bons partenaires. Au bon moment.

Plateforme B2B qui met en relation les entreprises qui ont un besoin avec les entreprises capables d'y répondre : besoins, demandes de devis, consultations et appels d'offres privés, opportunités externes référencées (toujours identifiées), annuaire, alertes, messagerie, pipeline commercial et administration. Le pilote est prévu en Bretagne, avec le Finistère en priorité.

| Document | Contenu |
|---|---|
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Mise en ligne pas à pas (Supabase + Vercel), variables d'environnement |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, modèle de données, sécurité, choix techniques |
| [docs/ETAT-DU-PROJET.md](docs/ETAT-DU-PROJET.md) | Ce qui est terminé, testé, non implémenté ou bloqué |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), **TypeScript**, **Tailwind CSS 4**
- **Supabase** : PostgreSQL (RLS sur toutes les tables), Auth (e-mail + mot de passe, double authentification TOTP), Storage
- E-mail transactionnel : **Resend** (facultatif, via API HTTP)
- Tests : **Vitest** (unitaires et intégration sur base réelle) et **Playwright** (E2E et responsive)
- Hébergement cible : **Vercel**, région Paris (`cdg1`)

## Démarrage local

Prérequis : Node.js ≥ 20.9 et Docker (pour Supabase local).

```bash
npm install
npm run db:start            # démarre Supabase local et applique les migrations
npx supabase status -o env  # affiche les clés locales
cp .env.example .env.local  # puis renseigner SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY
npm run seed:demo           # données de démonstration ; identifiants écrits dans .demo-credentials.local.md
npm run dev                 # http://localhost:3000
```

Interfaces locales : API Supabase sur http://127.0.0.1:54321, base sur `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Studio est accessible si vous lancez `npx supabase start` sans exclure `studio`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Développement, build et serveur de production |
| `npm run lint` / `typecheck` | ESLint et TypeScript |
| `npm run test:unit` | Tests unitaires (aucune dépendance externe) |
| `npm run test:integration` | Tests des permissions et de la RLS sur la base locale |
| `npm run test:e2e` | Parcours complets Playwright (recharge les données de démo et exige un `npm run build` préalable) |
| `npm run db:reset` | Recrée la base locale à partir des migrations |
| `npm run db:types` | Régénère `src/lib/database.types.ts` |
| `npm run seed:demo` / `seed:clean` | Charge ou supprime les données de démonstration |
| `npm run create-admin -- email "Nom"` | Crée ou promeut le compte super administrateur |

## Données de démonstration

`npm run seed:demo` crée 8 entreprises et 22 opportunités **fictives**, plus 7 comptes de test (super admin, modérateur, demandeurs, fournisseurs). Toutes ces données sont :

- marquées `is_demo = true` en base ;
- préfixées « Démo » ou « [DÉMO] » ;
- signalées dans l'interface par un bandeau et des badges « Démo ».

Les e-mails utilisent le domaine réservé `demo.linkprob2b.test`. Les mots de passe sont générés aléatoirement et écrits dans `.demo-credentials.local.md`, un fichier ignoré par Git. Avant le lancement réel : `npm run seed:clean`.

## Organisation du code

```
supabase/migrations/   schéma, sécurité (RLS), fonctions métier, données de référence
src/proxy.ts           session et protection des espaces privés
src/app/(site)/        pages publiques, /dashboard (espace connecté), /admin
src/app/actions/       Server Actions (validation zod + RPC Supabase)
src/app/api/           fichiers privés, logos, export RGPD, tâche planifiée
src/components/        design system (ui/), composants métier
src/lib/               clients Supabase, auth, validation, recherche, e-mails, fichiers
scripts/               seed de démonstration, création d'administrateur
tests/                 unit/, integration/, e2e/
legacy/                ancien prototype Streamlit (non utilisé)
```
