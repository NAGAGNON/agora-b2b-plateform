# LinkProB2B Outreach

Outil de prospection B2B fondé sur les nouvelles opportunités publiées chaque jour sur LinkProB2B.

```
Sources → LinkProB2B → nouvelles opportunités → Outreach → entreprises concernées
        → 1 e-mail personnalisé par entreprise → sélection personnalisée → inscription LinkProB2B
```

## Accès

- Application : `https://outreach.linkprob2b.com` (ou `https://www.linkprob2b.com/outreach` tant que le sous-domaine n'est pas branché).
- Réservée aux **administrateurs** de la plateforme (même compte que l'administration).
- Brancher le sous-domaine : Vercel → projet → *Settings → Domains* → ajouter `outreach.linkprob2b.com`
  (si le domaine est géré chez un autre registrar : enregistrement `CNAME outreach → cname.vercel-dns.com`).
  Le code redirige automatiquement `/` vers le tableau de bord et renvoie toute autre page vers le site public.

## Fonctionnement quotidien (`/api/cron/outreach`, 07:00 UTC, après la collecte de 06:00)

1. Synchronisation des opportunités publiées (publiques, réelles) : **nouvelle / traitée / modifiée / expirée**.
   Une opportunité clôturée, retirée ou dont la date limite est trop proche n'est **jamais** proposée.
2. Analyse du besoin : métiers concernés et codes NAF (`src/lib/outreach/profiles.ts`), à partir du texte réel.
3. Découverte d'entreprises : API publique *Recherche d'entreprises* (SIRENE, Licence Ouverte), par code NAF ×
   département, mise en cache 30 jours. Les dirigeants ne sont pas conservés ; les entrepreneurs individuels sont
   exclus par défaut. **Cette source ne fournit pas d'e-mail.**
4. Score de pertinence 0–100 (activité, localisation, compétences, historique), raisons affichées.
   Sans activité correspondante : score 0. Seuil par défaut : **70/100** (Paramètres).
5. Regroupement : **un seul e-mail par entreprise**, avec ses opportunités les plus pertinentes (6 max. par défaut).
6. Garde-fous : liste « Ne plus contacter » (e-mail, domaine, SIREN), entreprises déjà inscrites exclues,
   délai minimum entre deux e-mails, nombre max. sur 30 jours, limite quotidienne d'envoi.
7. Campagne en **prévisualisation** : entreprises, scores, opportunités, e-mail, landing page ; exclusion d'une
   entreprise ou d'une opportunité, modification de l'objet et de l'introduction, simulation (dry-run) ou validation.
8. Envoi (Resend), suivi : ouverture (indicative), clic, landing page, opportunité consultée, inscription,
   conversion (abonnement payant), désinscription.

## Origine des adresses e-mail

Outreach n'invente aucune adresse et ne collecte rien automatiquement sur des sites. Une entreprise devient
contactable quand une adresse professionnelle d'origine autorisée est ajoutée :
- import CSV (fichier B2B acquis légalement, export CRM, contacts de salon…) avec origine déclarée ;
- saisie manuelle sur la fiche, avec l'origine de l'adresse.
Les entreprises sélectionnées sans adresse apparaissent dans l'onglet « Sans e-mail » de chaque campagne.

## Envoi réel : garde-fous (tous requis)

| Condition | Où |
| --- | --- |
| Mode simulation désactivé | Outreach → Paramètres |
| `OUTREACH_SEND_ENABLED=true` | Vercel → variables d'environnement |
| `RESEND_API_KEY` | déjà utilisé par LinkProB2B |
| Identification complète de l'expéditeur | `src/lib/legal.ts` (dénomination, forme, adresse, SIRET, contact) |
| Recommandé : `OUTREACH_EMAIL_FROM` | ex. `LinkProB2B Veille <veille@linkprob2b.com>` (domaine vérifié dans Resend) |
| Facultatif : `OUTREACH_TOKEN_SECRET` | secret des liens personnalisés (sinon dérivé de la clé Supabase) |

## Données

Tables `outreach_*` (migration `20261017000001_outreach.sql`, additive) : réglages, prospects, liste d'exclusion,
états des opportunités, campagnes, destinataires, opportunités par destinataire, événements, cache de découverte.
RLS : lecture et écriture réservées aux administrateurs ; les pages publiques (sélection, suivi, désinscription)
passent par le serveur après vérification d'un jeton signé (HMAC).

## Conformité (prospection B2B)

- Message en lien avec l'activité professionnelle du destinataire, expéditeur identifié, raison de l'envoi expliquée.
- Désinscription simple : lien dans chaque e-mail, page sans compte, en-têtes `List-Unsubscribe` (un clic).
- Liste globale d'exclusion, historique conservé, origine des données sur chaque fiche et dans l'e-mail.
- Aucune collecte automatisée de sites, aucun contournement de CAPTCHA, d'authentification ou de protection.
