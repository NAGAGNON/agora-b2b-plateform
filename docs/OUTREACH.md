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

Outreach n'invente aucune adresse. Une entreprise devient contactable de trois façons :
- **recherche automatique** (chaque jour, et bouton « Rechercher l'adresse e-mail » sur la fiche) :
  1. site officiel trouvé via l'**API Brave Search** (`BRAVE_SEARCH_API_KEY`) ou **Dropcontact** (`DROPCONTACT_API_KEY`) —
     services payants dont les conditions autorisent cet usage ; aucun moteur de recherche n'est lu sans API ;
  2. lecture de l'accueil, de la page Contact et des mentions légales de **ce site uniquement**, agent identifié
     (`LinkProB2B-Outreach/1.0`), **robots.txt respecté**, abandon si le site refuse (403, CAPTCHA, anti-robot) ;
  3. seule une **adresse générique** de l'entreprise est retenue (contact@, info@, accueil@, devis@…), jamais une adresse
     nominative ; l'origine (page consultée, date, service) est notée sur la fiche et rappelée dans l'e-mail ;
  priorité aux entreprises sélectionnées sans e-mail de la campagne du jour, limite quotidienne réglable (100 par défaut) ;
- import CSV (fichier B2B acquis légalement, export CRM, contacts de salon…) avec origine déclarée ;
- saisie manuelle sur la fiche, avec l'origine de l'adresse.
Les entreprises sélectionnées sans adresse apparaissent dans l'onglet « Sans e-mail » de chaque campagne.

## Envoi réel

Par décision du propriétaire, Outreach fonctionne **en réel et automatiquement** (pas de simulation, pas de
validation manuelle, SIRET non exigé).

| Condition | Où |
| --- | --- |
| Mode simulation désactivé (par défaut) | Outreach → Paramètres |
| `RESEND_API_KEY` | déjà utilisé par LinkProB2B |
| Coupure d'urgence : `OUTREACH_SEND_ENABLED=false` | Vercel → variables d'environnement |

L'expéditeur est identifié dans chaque e-mail (LinkProB2B, site, page Contact ; dénomination, adresse et SIRET
ajoutés automatiquement dès qu'ils sont renseignés dans `src/lib/legal.ts`).
| Expéditeur : par défaut l'adresse des e-mails d'inscription (`notifications@linkprob2b.com`), nom « LinkProB2B » | `OUTREACH_EMAIL_FROM` pour en changer |
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
