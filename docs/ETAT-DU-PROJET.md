# État du projet — LinkProB2B V1 (6 octobre 2026)

Légende : 🟢 terminé et fonctionnel · 🟡 nécessite une information ou un compte de votre part · 🔴 bloqué par l'environnement · ⚖️ validation juridique

## Accès

| | Où |
|---|---|
| **Application interactive (staging)** | URL publiée dans l'issue « Prévisualisation LinkProB2B » et dans l'onglet **Deployments** du dépôt. Elle est relancée à chaque commit marqué `[preview]` ou via **Actions → Prévisualisation → Run workflow**, et reste en ligne 5 h 30 au plus. |
| **Production** | après fusion de la PR vers `main` et un clic sur « Deploy with Vercel » ([DEPLOIEMENT.md](DEPLOIEMENT.md)) |
| Aperçu statique (archive) | artefact claude.ai, 27 écrans |

## 🟢 Terminé et fonctionnel

- Inscription avec confirmation d'e-mail, connexion, déconnexion, mot de passe oublié, double authentification ; rôles administrateur, modérateur, demandeur, fournisseur appliqués en base.
- Entreprises : création, fiche (secteurs, compétences, zone, coordonnées, site, présentation), membres et invitations, multi-entreprises.
- Besoins privés : publication en 6 étapes avec documents, modération, publication, expiration.
- Réponses : intérêt, réponse (prix, délai, validité, documents), confidentialité, présélection, comparaison, décision, clôture ; pipeline fournisseur ; tableau de bord demandeur.
- Messagerie et notifications en temps réel (lu / non lu, historique).
- Alertes (secteur, zone, ville + rayon, type, compétences, taille, mots-clés, externes ou non ; immédiate, quotidienne, hebdomadaire), déclenchées par les publications et par les collectes.
- Recommandations à score réel (sur 100) et explication « Pourquoi cette opportunité vous est proposée ».
- Opportunités externes BOAMP et TED : collecte, normalisation, classification, déduplication entre sources, mise à jour, expiration, journal. Vérifié sur les API réelles : 361 opportunités bretonnes, dont 116 doublons TED rattachés à l'avis BOAMP.
- Administration : vue d'ensemble, modération, opportunités, utilisateurs, entreprises, réponses (métadonnées), signalements, sources, synchronisations, secteurs et zones, e-mails, journal d'audit, paramètres.
- E-mails : 15 modèles (HTML + texte), file d'envoi avec réessais. Chaîne complète testée via la boîte de test.
- Séparation démo / réel : la production n'affiche que le réel et refuse le seed ; en staging, le réel et la démo sont affichés, la démo avec un indicateur clair.
- Sécurité : voir [SECURITE.md](SECURITE.md) (audit final).
- SEO, responsive (375 → 1440 px), accessibilité (axe-core WCAG 2.1 AA sur 23 pages).
- Déploiement : migrations transactionnelles au build, supervision `/api/sante`, tâche planifiée, domaine `linkprob2b.fr` préparé, PR vers `main` ouverte.

## 🟡 À fournir

1. **Compte Vercel et compte Supabase** : fusionner la PR, cliquer « Deploy with Vercel » et répondre aux 3 questions → URL de production permanente.
2. **`RESEND_API_KEY`** : il me faut cette clé pour activer l'envoi réel des e-mails. Le reste est opérationnel.
3. **Domaine `linkprob2b.fr`** : 2 enregistrements DNS (voir [DEPLOIEMENT.md](DEPLOIEMENT.md#domaine-linkprob2bfr)).

## 🔴 Bloqué par l'environnement

- Ce poste de développement ne peut pas joindre Vercel : le déploiement permanent nécessite vos comptes. L'application interactive tourne en attendant sur GitHub Actions.

## ⚖️ Validation juridique

- Mentions légales, CGU et politique de confidentialité : compléter les éléments entre crochets et faire valider ([RGPD.md](RGPD.md)).
- APProch : licence à confirmer (projets d'achats prévisionnels) ; source enregistrée, inactive.
