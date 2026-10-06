# Déploiement de LinkProB2B

Le déploiement prend environ 30 minutes : une base Supabase (cloud) et l'application sur Vercel, connectée au dépôt GitHub. Les deux services proposent des offres gratuites suffisantes pour un pilote. Choisir l'offre et créer les comptes au nom de votre entreprise vous revient.

## 1. Créer le projet Supabase

1. Créez un compte sur https://supabase.com, puis **New project**.
   - Région : **Paris (eu-west-3)** ou **Frankfurt**, pour héberger les données dans l'UE.
   - Notez le mot de passe de la base.
2. Appliquez les migrations depuis votre poste :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-du-projet>   # visible dans l'URL du tableau de bord
   npx supabase db push                              # applique supabase/migrations/*
   ```
   *Sans CLI* : ouvrez **SQL Editor** et exécutez, dans l'ordre, les quatre fichiers de `supabase/migrations/`.
3. **Authentication → URL Configuration**
   - Site URL : `https://<votre-domaine>` (ou l'URL Vercel)
   - Redirect URLs : `https://<votre-domaine>/**`, plus les URL de prévisualisation Vercel si besoin (`https://*-<equipe>.vercel.app/**`). Les liens envoyés par e-mail pointent vers `/auth/confirmation?suite=…`.
4. **Authentication → Providers → Email** : laissez « Confirm email » **activé**.
   - Mot de passe : 10 caractères minimum, avec minuscules, majuscules et chiffres (même règle qu'en local).
5. **Authentication → SMTP** : configurez un SMTP (Resend, Brevo…). Sans SMTP, le serveur d'e-mails intégré de Supabase est limité à quelques envois par heure, ce qui ne suffit pas pour les confirmations d'inscription.
6. **Authentication → Multi-Factor** : vérifiez que TOTP est activé (c'est le cas par défaut).
7. **Project Settings → API Keys** : récupérez
   - la **Publishable key** (`sb_publishable_…`, ou l'ancienne clé `anon`) ;
   - la **Secret key** (`sb_secret_…`, ou l'ancienne clé `service_role`). **Ne jamais l'exposer.**

## 2. Déployer sur Vercel

1. Créez un compte sur https://vercel.com, puis **Add New → Project** et importez le dépôt GitHub `agora-b2b-plateform`.
2. Framework détecté : Next.js. Laissez les commandes par défaut.
3. Renseignez les **variables d'environnement** (Production et Preview) :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `SITE_URL` | `https://<votre-domaine>` (sans `/` final) | oui |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | oui |
| `SUPABASE_PUBLISHABLE_KEY` | clé publishable / anon | oui |
| `SUPABASE_SECRET_KEY` | clé secrète / service_role | oui |
| `CRON_SECRET` | chaîne aléatoire (`openssl rand -hex 32`) | oui |
| `RATE_LIMIT_SALT` | chaîne aléatoire (`openssl rand -hex 32`) | oui |
| `RESEND_API_KEY` | clé API Resend | non — sans clé, aucun e-mail de notification n'est envoyé |
| `EMAIL_FROM` | `LinkProB2B <notifications@votre-domaine.fr>` (domaine vérifié chez Resend : SPF, DKIM, DMARC) | si Resend |

4. Lancez le déploiement. Chaque push sur une branche crée une **URL de prévisualisation**.
5. La tâche planifiée quotidienne (`vercel.json` → `/api/cron/quotidien`, 6 h UTC) est activée automatiquement. Elle gère l'expiration des opportunités, les résumés d'alertes et l'envoi des e-mails en attente. Vercel envoie `Authorization: Bearer $CRON_SECRET`.

> La variable `SUPABASE_URL` est aussi lue au **build** : elle sert à autoriser l'envoi direct des fichiers vers le stockage dans la politique de sécurité (CSP). Après l'avoir modifiée, redéployez.

## 3. Créer le premier administrateur

Depuis votre poste, avec un `.env.local` pointant vers le projet de production :

```bash
npm run create-admin -- vous@entreprise.fr "Prénom Nom"
```

Ensuite :

1. Connectez-vous, changez le mot de passe et activez la double authentification (**Paramètres**).
2. Dans **Administration → Paramètres**, activez « Double authentification obligatoire pour l'administration ».

## 4. Données de démonstration (facultatif)

Pour une préproduction de test : `npm run seed:demo`, avec `.env.local` pointant vers le projet de préproduction. Toutes ces données sont marquées « Démo ».

**Ne chargez jamais les données de démonstration en production.** Si cela arrive : `npm run seed:clean`.

## 5. Avant l'ouverture au public

- [ ] Pages légales complétées (éléments entre crochets) et validées par un professionnel ; DPO si nécessaire
- [ ] Nom de domaine acheté, configuré dans Vercel, et reporté dans `SITE_URL` et dans Supabase (Site URL, Redirect URLs)
- [ ] SMTP Supabase et Resend configurés ; domaine d'envoi authentifié (SPF, DKIM, DMARC)
- [ ] Super administrateur créé avec 2FA ; obligation de 2FA activée
- [ ] Données de démonstration absentes (`npm run seed:clean`)
- [ ] Sauvegardes : vérifier la politique de sauvegarde de l'offre Supabase choisie et tester une restauration
- [ ] Search Console : propriété créée, sitemap `https://<domaine>/sitemap.xml` soumis
- [ ] Sources externes : n'en approuver aucune sans validation juridique écrite de ses conditions de réutilisation

## Environnement de développement local

Voir le [README](../README.md). Remarque : dans certains environnements restreints, les images Docker de Supabase ne sont accessibles que via Docker Hub. On peut alors démarrer avec :

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npm run db:start
```
