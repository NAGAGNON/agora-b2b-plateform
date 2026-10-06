# Sécurité

## Principes

1. **Défense en profondeur** : les droits sont vérifiés par le serveur (Server Actions) **et** par la base de données (RLS, fonctions `security definer` qui contrôlent `auth.uid()`). Une erreur dans l'interface ne suffit pas à exposer une donnée.
2. **Moindre privilège** : la clé secrète Supabase n'est utilisée que par du code serveur de confiance (tâche planifiée, collecte, e-mails d'authentification, suppression de compte, limitation de débit). Elle n'est jamais envoyée au navigateur.
3. **Secrets hors du code** : toutes les clés sont des variables d'environnement (voir `.env.example`). Aucun secret n'est versionné ; `.env*` est ignoré par Git.

## Mesures

| Domaine | Mise en œuvre |
|---|---|
| Authentification | Supabase Auth, mots de passe ≥ 10 caractères (minuscules, majuscules, chiffres), confirmation d'e-mail en production, liens à usage unique, double authentification TOTP (obligatoire pour l'administration si le paramètre est activé) |
| Premier administrateur | `INITIAL_ADMIN_EMAIL` : promotion uniquement si **aucun** super-administrateur réel n'existe (`bootstrap_super_admin`, exécutable par le seul `service_role`), action journalisée |
| Autorisation | RLS sur 100 % des tables publiques ; droits `UPDATE` limités par colonne ; transitions d'état contrôlées par déclencheurs ; fonctions `security definer` avec `search_path` vide |
| Confidentialité commerciale | Le contenu des réponses (message, prix, documents) n'est lisible que par le fournisseur et le demandeur. Même l'administration n'en voit que les métadonnées |
| Temps réel | Abonnements avec la session de l'utilisateur : le serveur Realtime applique la RLS à chaque événement. Le navigateur ne reçoit que des signaux et relit les données par le serveur |
| Validation | zod côté serveur sur toutes les Server Actions ; contraintes `CHECK` et clés étrangères en base |
| Injections | Requêtes paramétrées (PostgREST / RPC), aucune concaténation SQL ; recherche plein texte via `websearch_to_tsquery` / `plainto_tsquery` |
| XSS | Rendu React échappé, aucun `dangerouslySetInnerHTML` ; e-mails : échappement HTML de tout contenu dynamique ; CSP stricte (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limité à l'origine Supabase) |
| CSRF | Server Actions protégées par Next.js (vérification d'origine) ; cookies de session `SameSite=Lax` |
| Fichiers | Liste blanche MIME, 10 Mo maximum, **signature binaire vérifiée**, noms nettoyés, buckets privés, téléchargements contrôlés par l'application |
| Limitation de débit | Connexion, inscription, mot de passe oublié, contact (empreinte d'IP salée et hachée) ; actions métier limitées par utilisateur en base |
| Redirections | Paramètre `suite` limité aux chemins internes ; redirection externe (`/go/[id]`) uniquement vers des URL de sources enregistrées |
| Données externes | URL d'annonces acceptées uniquement en `https` (ou `http`) ; textes nettoyés et tronqués ; aucune exécution de contenu tiers |
| Tâche planifiée | `/api/cron/quotidien` exige `Authorization: Bearer $CRON_SECRET` (comparaison en temps constant) ; fermée si le secret est absent |
| Erreurs | Messages génériques côté client, détails uniquement dans les journaux serveur (sans données personnelles) |
| Journalisation | `audit_logs` : modération, rôles, statuts, paramètres, secteurs, sources, données de démonstration, suppressions de compte |
| En-têtes | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ; `noindex` sur les espaces privés |
| Migrations | Transactionnelles, verrouillées, jamais exécutées depuis une branche de prévisualisation par défaut |

## Audit final (6 octobre 2026, sur la base réelle)

| Contrôle | Résultat |
|---|---|
| Tables publiques sans RLS | 0 / 34 |
| Tables sans aucune politique (accès refusé à tous sauf serveur) | `email_outbox`, `rate_limits` — voulu |
| Droits d'écriture du rôle anonyme sur des tables | aucun |
| Fonctions `security definer` sans `search_path` fixé | 0 |
| Fonctions privilégiées exécutables par le rôle anonyme | uniquement les 12 fonctions d'aide des politiques RLS et `track_event` (migration `20261010000001`) |
| Fonctions internes (déclencheurs, alertes, file d'e-mails, premier administrateur) | réservées au serveur (`service_role`) |
| Stockage | 4 buckets ; 3 privés (documents, réponses, pièces jointes) avec liste blanche MIME et 10 Mo ; logos publics 2 Mo, images uniquement ; écriture limitée aux membres concernés |
| Pièces jointes et documents | téléchargement uniquement via l'application après contrôle des droits ; signature binaire vérifiée à l'envoi |
| Réponses aux consultations | lisibles par le seul fournisseur et le demandeur ; l'administration ne voit que des métadonnées |
| Conversations | lisibles par les deux entreprises participantes uniquement |
| Limitation de débit | connexion 10 / 10 min, inscription 5 / h, mot de passe oublié 5 / h, contact ; actions métier limitées en base |
| Secrets | uniquement en variables d'environnement ; aucun dans le dépôt ni dans les journaux (masqués dans GitHub Actions) |
| Journaux | erreurs serveur sans données personnelles ; journal d'audit des actions sensibles |

## Tests de sécurité automatisés

`tests/integration/security.test.ts` et les autres tests d'intégration vérifient sur une vraie base PostgreSQL :

- un visiteur ne voit ni brouillon, ni opportunité en modération, ni coordonnée privée ;
- un utilisateur ne peut pas se publier lui-même, modifier un champ protégé, ni lire les réponses ou le pipeline d'une autre entreprise ;
- la messagerie est limitée aux deux entreprises de la conversation ;
- les fonctions d'administration refusent les utilisateurs ordinaires ;
- le stockage refuse l'accès aux fichiers d'autrui ;
- les données de démonstration sont exclues des alertes ;
- le rôle anonyme ne peut exécuter aucune fonction métier privilégiée ;
- les liens d'authentification sont à usage unique et ne sont jamais stockés.

Voir [TESTS.md](TESTS.md).

## Points d'attention

- **TLS des migrations** : sans `DATABASE_CA_CERT`, la connexion de migration est chiffrée mais le certificat de Supabase n'est pas vérifié (autorité propre à Supabase). Ajoutez le certificat (*Project Settings → Database → SSL*) pour une vérification complète.
- **Staging sans fournisseur e-mail** : les comptes sont activés sans vérifier l'adresse. N'utilisez jamais ce mode avec des données réelles.
- **Audit externe** : aucun test d'intrusion indépendant n'a été réalisé. Il est recommandé avant une ouverture large.

## Signaler une vulnérabilité

Écrivez à l'adresse de contact indiquée dans les mentions légales, sans divulgation publique avant correction.
