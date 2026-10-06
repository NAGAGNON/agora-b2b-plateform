# État du projet — V1 (octobre 2026)

Légende : ✅ terminé et testé · 🟡 fonctionnel avec limites · ⛔ non implémenté · 🔒 bloqué (décision ou accès requis)

## Lots

| Lot | Contenu | État |
|---|---|---|
| 0 — Fondations | Next.js 16, TypeScript, Tailwind, Supabase, migrations, RLS, rôles, design system à la charte | ✅ |
| 1 — Comptes et entreprises | Inscription, connexion, mot de passe oublié, profil, entreprise, membres et invitations, multi-entreprises, 2FA | ✅ |
| 2 — Opportunités | Publication en 6 étapes, brouillon, modération, édition, recherche et filtres, fiches, statuts, expiration | ✅ |
| 3 — Consultations et réponses | Devis, consultations, appels d'offres privés, intérêts, propositions, documents, shortlist, comparaison, décisions, clôture, pipeline | ✅ |
| 4 — Expérience commerciale | Favoris, alertes, recherches sauvegardées, messagerie, notifications, tableaux de bord | ✅ (e-mails 🟡, voir ci-dessous) |
| 5 — Administration | Modération, utilisateurs, entreprises, vérification, signalements, audit, sources externes, paramètres | ✅ |
| 6 — Qualité et SEO | SEO, sitemap, robots, en-têtes de sécurité, accessibilité de base, tests, responsive, analytics | ✅ |
| 7 — Préparation pilote | Données de démonstration, documentation, CI, configuration de déploiement | ✅ (mise en ligne 🔒) |

## Tests réalisés

| Suite | Nombre | Contenu |
|---|---|---|
| Unitaires (Vitest) | 25 | Formatage, validation (inscription, opportunité, entreprise, contact), filtres de recherche, contrôle des fichiers |
| Intégration (Vitest + Supabase local) | 41 | Rôles, RLS, cycle de vie et modération, recherche plein texte et par rayon, intérêts et réponses, confidentialité des évaluations et du pipeline, messagerie, clôture, sources externes, audit, suspension, export RGPD, expiration, stockage et URL signées |
| E2E (Playwright) | 13 | Parcours complet : inscription → entreprise → publication avec document → validation → recherche → intérêt → réponse avec pièce jointe → présélection → comparaison → clôture. Permissions. Absence de défilement horizontal à 375, 390, 768, 1024 et 1440 px. Menu burger et filtres en tiroir |

Commandes : `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`. Les deux dernières exigent Supabase local. La CI GitHub Actions (`.github/workflows/ci.yml`) les exécute toutes.

## Limites connues (🟡)

- **E-mails** : architecture complète (file, gabarits, Resend, résumés, désabonnement), mais aucun envoi réel tant que `RESEND_API_KEY` n'est pas configurée. Les e-mails d'authentification (confirmation, réinitialisation) passent par le SMTP de Supabase, à configurer.
- **Recherche par rayon** : basée sur un référentiel de communes (Bretagne et grandes villes françaises). Une ville absente du référentiel n'est pas géolocalisée ; le filtre par département fonctionne toujours. À terme : géocodage via l'API Adresse (données publiques).
- **Messagerie** : sans temps réel. Les nouveaux messages apparaissent au rechargement de la page ou à la navigation, et une notification est créée.
- **Accessibilité** : bonnes pratiques appliquées (libellés, focus visible, navigation clavier, contrastes de la charte, `aria`), sans audit RGAA formel.
- **Pages légales** : modèles à compléter (éléments entre crochets) et à faire valider par un professionnel.

## Non implémenté (⛔, hors V1 ou à décider)

- Paiement et abonnements : seule une architecture préparatoire existe (table `plans`).
- Import automatique de sources externes (BOAMP, TED…) : volontairement absent tant qu'aucune validation juridique n'est faite.
- Application mobile native.
- Mise en avant sponsorisée.
- Glisser-déposer tactile dans le pipeline : sur mobile, le changement d'étape passe par une liste déroulante.

## Bloqué (🔒, votre décision ou votre accès est nécessaire)

| Sujet | Pourquoi | Action |
|---|---|---|
| URL de prévisualisation publique | L'environnement de développement ne peut pas joindre Vercel ni ouvrir de tunnel public (politique réseau) | Créer les comptes Supabase et Vercel, puis suivre `docs/DEPLOIEMENT.md` (environ 30 min). Si vous connectez le connecteur **Supabase** à Claude, la création du projet et l'application des migrations peuvent être faites pour vous. |
| Nom de domaine | Achat | À choisir et acheter |
| Fournisseur e-mail (Resend ou autre) | Compte et domaine d'envoi | Créer le compte, vérifier le domaine |
| Sources BOAMP / TED | Validation juridique des conditions de réutilisation | Avis juridique, puis approbation dans l'administration |
| Contenu légal (mentions, CGU, confidentialité) | Décision juridique | Compléter et faire valider |
