# Tests

## Suites

| Suite | Commande | Ce qu'elle vérifie | Dépendances |
|---|---|---|---|
| **Unitaires** | `npm run test:unit` | Validation des formulaires, filtres de recherche, contrôle des fichiers, formatage ; normalisation, classification et déduplication des sources **sur des formats réels BOAMP/TED** ; environnements, envoi d'e-mails (réessais, idempotence, échappement HTML) | aucune |
| **Base de données et sécurité** | `npm run test:integration` | Sur une vraie base PostgreSQL : RLS, rôles, cycle de vie et modération, recherche plein texte et par rayon, intérêts, réponses, confidentialité, messagerie, clôture, stockage, export RGPD, expiration ; collecte de bout en bout ; alertes étendues, séparation démo/réel, premier administrateur, référentiels | Supabase local |
| **E2E** | `npm run test:e2e` | Navigateur réel : parcours complet inscription → publication → modération → réponse → clôture, permissions, opportunités externes, **messagerie et notifications en temps réel** | Supabase local (avec Realtime) + `npm run build` |
| **Responsive** | inclus dans E2E | Aucun défilement horizontal à 375, 390, 768, 1024 et 1440 px ; menu et filtres mobiles | idem |
| **Accessibilité** | inclus dans E2E | axe-core, WCAG 2.1 A/AA : aucune violation grave ou critique sur 22 pages (public, espace connecté, administration) | idem |
| **Contrat des sources** | `npm run sources:check` | API réelles BOAMP et TED : disponibilité, format, part des annonces exploitables, avec date limite et classées | accès Internet |

## Lancer localement

```bash
npm run db:start                     # Supabase local, Realtime inclus
npm run test:unit
npm run test:integration
npm run build:app && npm run test:e2e   # recharge les données de démonstration (global-setup)
npm run sources:check                # nécessite Internet
```

## Intégration continue (GitHub Actions)

- `ci.yml`, à chaque push : lint, typage, unitaires, build ; puis Supabase local, statut des migrations, intégration et E2E.
- `sources.yml`, chaque jour à 05:30 UTC et à chaque modification des connecteurs : test de contrat contre BOAMP et TED. Le journal contient un échantillon brut rejouable localement :

```bash
npx tsx --conditions=react-server scripts/replay-sources.ts journal.txt
```

## Derniers résultats (6 octobre 2026)

| Suite | Résultat |
|---|---|
| Unitaires | 61 / 61 |
| Base de données, RLS et sécurité (dont e-mails d'authentification, alertes sur collecte, audience, analyses de marché) | 74 / 74 |
| E2E : parcours, permissions, déconnexion, audience, SEO (analyses, JSON-LD, IndexNow) | 11 / 11 |
| Temps réel (messagerie, notifications) | 2 / 2 |
| Responsive | 6 / 6 |
| Accessibilité | 3 / 3 (22 pages) |
| Contrat API réelles | BOAMP et TED : réussi (GitHub Actions) |
| Build, lint, typage | réussis |

## Ce que les tests ne couvrent pas

- L'envoi effectif par Resend : sans clé API, la chaîne complète est testée avec une boîte de test (liens de confirmation et de réinitialisation réellement utilisés).
- La collecte réelle **depuis Vercel** : elle est vérifiée depuis GitHub Actions, avec le même code.
- Les performances sous charge et un audit d'accessibilité manuel (RGAA) : à prévoir avant l'ouverture large.
