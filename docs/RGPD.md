# RGPD et données personnelles

> Ce document décrit ce que fait la plateforme. Il ne remplace pas l'avis d'un professionnel (⚖️). Les pages légales (`/mentions-legales`, `/confidentialite`, `/cgu`) sont des modèles : les éléments entre crochets sont à compléter et à faire valider.

## Données traitées

| Catégorie | Exemples | Finalité | Base légale (à valider) |
|---|---|---|---|
| Compte | nom, e-mail professionnel, fonction, téléphone (facultatif) | accès au service, sécurité | exécution du contrat (CGU) |
| Entreprise | raison sociale, SIREN, ville, secteurs, compétences, logo | annuaire, mise en relation | exécution du contrat |
| Activité | opportunités, intérêts, réponses, messages, pipeline, favoris, alertes | service de mise en relation | exécution du contrat |
| Sécurité | journal d'audit, empreinte d'IP **hachée et salée** (limitation de débit) | prévention des abus | intérêt légitime |
| Statistiques | événements d'usage, **sans IP, sans cookie, sans identifiant publicitaire** | amélioration du service | intérêt légitime |
| Prospection | consentement marketing (case non cochée par défaut) | informations produit | consentement |

**Opportunités externes** (BOAMP, TED) : données publiées par des acheteurs publics sous licence ouverte. Elles peuvent contenir le nom d'un acheteur, une personne morale. Aucune donnée personnelle n'est recherchée ni enrichie.

## Droits des personnes, en libre-service

- **Accès et portabilité** : *Paramètres → Exporter mes données* (JSON : profil, entreprises, opportunités, réponses, messages envoyés, alertes, favoris, notifications).
- **Rectification** : profil et fiche entreprise modifiables à tout moment.
- **Effacement** : *Paramètres → Supprimer mon compte*. Une entreprise dont l'utilisateur est le seul membre est supprimée avec lui ; sinon, le rôle d'administrateur est transmis au membre le plus ancien. Les messages restent visibles du destinataire, sans lien vers le compte supprimé.
- **Opposition** : e-mails de notification désactivables ; chaque e-mail d'alerte contient un lien de désabonnement en un clic.

## Minimisation et conservation

- Coordonnées des entreprises visibles des seuls membres connectés.
- Limitation de débit : empreintes purgées au-delà de 2 jours.
- Jetons d'authentification envoyés par e-mail : jamais stockés par l'application.
- Données de démonstration : fictives, domaine réservé `demo.linkprob2b.test`, interdites en production.
- Durées de conservation à fixer dans la politique de confidentialité (⚖️), par exemple : comptes inactifs 3 ans, journaux de sécurité 1 an.

## Cookies

Uniquement des cookies **strictement nécessaires** : session d'authentification (Supabase) et entreprise active (`lp_company`). Aucun traceur publicitaire ni mesure d'audience tierce : pas de bandeau de consentement requis tant que cela reste vrai.

## Sous-traitants

| Prestataire | Rôle | Localisation des données |
|---|---|---|
| Supabase | base de données, authentification, fichiers, temps réel | région choisie à la création (recommandé : Paris, eu-west-3) |
| Vercel | hébergement de l'application | fonctions en région Paris (`cdg1`) ; réseau mondial pour les contenus statiques |
| Resend | envoi des e-mails | à vérifier selon l'offre et la région (⚖️) |

Les contrats de sous-traitance (DPA) de ces prestataires sont à accepter par l'éditeur du site (⚖️).

## Registre et sécurité

- Le registre des traitements est à tenir par l'éditeur (⚖️) ; ce document peut servir de base.
- Mesures de sécurité : voir [SECURITE.md](SECURITE.md).
- Violation de données : notification à la CNIL sous 72 h si elle présente un risque (⚖️). Les journaux Supabase, Vercel et `audit_logs` aident à l'analyse.
