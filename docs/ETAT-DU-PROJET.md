# État du projet — 6 octobre 2026

Légende : ✅ fonctionnel et testé · 🟡 nécessite vos identifiants ou comptes · 🔴 bloqué par une contrainte externe · ⚖️ nécessite une validation juridique

## Fonctionnalités

| Domaine | État | Détail |
|---|---|---|
| Comptes, entreprises, membres, invitations, double authentification | ✅ | Tests d'intégration et E2E |
| Publication en 6 étapes, modération, cycle de vie, expiration | ✅ | Parcours E2E complet |
| Intérêts, réponses, présélection, comparaison, décision, clôture, pipeline | ✅ | Contenu des réponses confidentiel, y compris vis-à-vis de l'administration |
| Recherche plein texte, filtres, rayon, annuaire | ✅ | |
| Alertes : secteur, zone, ville + rayon, type, compétences, taille, mots-clés, externes inclus ou non, fréquence | ✅ | |
| Recommandations à score expliqué (sur 100) | ✅ | Barème public |
| Messagerie et notifications en temps réel | ✅ | Supabase Realtime, filtré par la RLS ; E2E à deux navigateurs |
| Collecte BOAMP et TED : normalisation, classification, déduplication, mise à jour, expiration, journal | ✅ | Vérifiée sur les API réelles (GitHub Actions) ; exécution quotidienne sur Vercel |
| Administration : modération, entreprises, utilisateurs, réponses, signalements, sources, synchronisations, référentiels, paramètres, audit | ✅ | |
| Environnements développement / staging / production, séparation démo / réel | ✅ | Seed refusé en production ; démo masquée en production |
| Migrations au déploiement, santé (`/api/sante`), supervision de la tâche planifiée | ✅ | Transactionnelles, avec verrou |
| E-mails : confirmation d'inscription, mot de passe, bienvenue, notifications, alertes, invitations | 🟡 | Code et gabarits prêts et testés ; envoi réel dès que `RESEND_API_KEY` est configurée |
| URL publique de l'application | 🟡 | Un clic sur « Deploy with Vercel » (comptes Vercel et Supabase) ; voir ci-dessous |
| Nom de domaine | 🟡 | Achat à faire |
| Pages légales (mentions, CGU, confidentialité) | ⚖️ | Modèles à compléter (éléments entre crochets) et à faire valider |
| Sources APProch, DECP, plateformes d'acheteurs | ⚖️ / 🔴 | Voir [SOURCES-EXTERNES.md](SOURCES-EXTERNES.md) |
| Paiement, abonnements | — | Hors périmètre du pilote (architecture préparée) |

## Tests

Voir [TESTS.md](TESTS.md). Derniers résultats : unitaires 57/57 · base de données et sécurité 61/61 · E2E 9/9 · responsive 6/6 · accessibilité 3/3 · contrat des API réelles BOAMP et TED réussi.

## Aperçu consultable

Un aperçu statique (27 écrans, instantané du 6 octobre 2026, non interactif) est publié sur claude.ai. Il contient de vrais marchés publics bretons, collectés via BOAMP et TED, et les données de démonstration signalées. L'environnement de développement ne peut pas joindre Vercel ni ouvrir de tunnel public : l'application interactive nécessite le déploiement ci-dessous.

## Pour obtenir l'URL de l'application interactive

1. Fusionner la branche `claude/zealous-archimedes-ui0kph` dans `main` (le bouton de déploiement copie la branche par défaut).
2. Cliquer sur **Deploy with Vercel** dans le README, se connecter à Vercel puis à Supabase, et saisir `INITIAL_ADMIN_EMAIL`, `APP_ENV=staging` et `CRON_SECRET`.

Les migrations, la sécurité et les référentiels s'installent au build. La collecte BOAMP et TED démarre à la première tâche planifiée, ou tout de suite via **Administration → Sources → Synchroniser maintenant**.
