# Reseller AI OS

Outil de pilotage d'une activité de revente sur Vinted : **détecter → analyser → acheter → réceptionner → publier → vendre → expédier → encaisser → analyser les bénéfices.**
Application web mono-utilisateur (propriétaire), reliée à une vraie base PostgreSQL : aucun chiffre n'est fictif, un tableau de bord vide affiche des zéros.

> Projet autonome dans `reseller-ai-os/`. Il n'a aucun lien avec l'application Linkprob2B présente à la racine du dépôt, qui n'est pas modifiée.

## Ce qui est fonctionnel

| Domaine | Contenu |
|---|---|
| **Tableau de bord** | CA jour/semaine/mois, bénéfice net, dépenses, investi, stock, en attente/encaissé, trésorerie ; 6 graphiques sur 12 mois ; alertes calculées en direct ; timeline |
| **Sources & opportunités** | Import CSV (détection automatique des colonnes, aperçu), flux CSV/JSON distants autorisés (protection SSRF, clé API chiffrée), dédoublonnage ; score /100 transparent, filtres marge/bénéfice/score/prix/fournisseur/catégorie |
| **Rentabilité (sans IA)** | Coût total → bénéfice brut/net → marge ; simulateur avant achat ; budgets quotidien/mensuel/par achat ; arithmétique `Decimal` au centime |
| **Achats** | Workflow `à étudier → recommandé → en attente de validation → validée → commandée → expédiée → reçue / annulée` ; **validation explicite obligatoire** ; dépense comptabilisée automatiquement ; frais de commande répartis au centime sur les articles ; import facture/commande (PDF, .eml, texte, CSV) avec confirmation |
| **Stock** | Une ligne par unité, 11 statuts avec transitions contrôlées ; un article non reçu n'est jamais « en stock » ; alerte « reçu non publié » |
| **Annonces** | Titre/description/prix/mots-clés générés sans IA, contrôle de conformité Vinted (termes interdits, coordonnées, photos réelles, longueurs), reformulation IA optionnelle ; retouche photo (recadrage, rotation, luminosité, contraste, couleurs, auto) ; visuels de présentation **étiquetés** et jamais comptés comme photo réelle |
| **Vinted** | Mode assisté complet (pack de publication, copie, ZIP photos, ouverture de Vinted, enregistrement du lien), compte, incidents, historique. Connecteur API officiel : voir limites |
| **Ventes & expéditions** | Vente → retrait du stock, CA, bénéfice prévisionnel, tâche d'expédition, notification ; paiement, expédition, livraison, versement, annulation, remboursement (avec/sans remise en stock) |
| **Finance** | Trésorerie détaillée, P&L jour/semaine/mois/année, dépenses par catégorie, bénéfice par vente, **bilans mensuels automatiques** |
| **Agents & automatisation** | 12 agents (mission, objectifs, statut, budget IA, tâches, historique) ; passations dédoublonnées ; Operations Manager qui détecte et relance les erreurs ; 9 tâches planifiées à fréquence configurable + calendrier |
| **Centre de contrôle IA** | Claude pilote l'app par une **liste blanche** d'outils (lecture + actions réversibles). Il ne peut ni valider, ni payer, ni supprimer. Chaque appel est journalisé |
| **Coûts IA** | Budgets quotidien/mensuel/par agent, cache des réponses, modèle économique par défaut (Haiku), Claude Sonnet seulement pour le raisonnement ; marges/stocks/stats = 0 token |

## Lancer en local (développement)

Prérequis : Python 3.12+, Node 22, PostgreSQL 16.

```bash
# Base
createdb reseller   # utilisateur reseller / mot de passe reseller (voir backend/.env.example)

# API
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env        # puis ajuster
alembic upgrade head
uvicorn app.main:app --port 8000

# Interface (autre terminal)
cd frontend && npm install && npm run dev      # http://localhost:3000
```

Tests : `cd backend && pytest` (nécessite une base `reseller_test`).

## Déployer sur un VPS (Docker)

```bash
cp .env.example .env     # renseigner POSTGRES_PASSWORD, ADMIN_PASSWORD, SECRET_KEY, DOMAIN
docker compose up -d --build
```

Caddy fournit le HTTPS automatique si `DOMAIN` pointe vers le VPS. Les sauvegardes (base + photos, rétention 14 jours) arrivent dans `./backups`. Journaux : `docker compose logs -f backend` ; santé : `GET /api/health`.
Restauration : `gunzip -c backups/db-AAAAMMJJ-HHMMSS.sql.gz | docker compose exec -T db psql -U reseller reseller`.
> La configuration Docker n'a pas pu être exécutée dans l'environnement de développement (pas de démon Docker) : la syntaxe est validée, la chaîne migrations + API + interface standalone a été testée à la main. Faites un premier `docker compose up` de contrôle.

## Premiers pas

1. **Paramètres** : capital de départ, budgets, marge/bénéfice minimaux, clé Claude (optionnelle).
2. **Sources & fournisseurs** : créez un fournisseur et une source « Fichier CSV », importez son catalogue.
3. **Opportunités** : « Analyser tout ». Ajoutez des **prix observés** (ventes réelles comparables) pour obtenir un score fiable.
4. Créez/validez une commande, passez-la chez le fournisseur, marquez « J'ai passé la commande » puis « Réceptionner ».
5. Stock → photos → « Préparer l'annonce » → publier sur Vinted → coller le lien.
6. Enregistrer la vente → expédier → « J'ai reçu le paiement » → Finance.

## Limites assumées (volontairement non simulées)

- **API Vinted Pro Integrations** : l'accès doit vous être accordé par Vinted et sa documentation n'est pas publique. L'application n'invente aucun appel : tant que l'accès n'est pas effectif, `/vinted` indique « non accordé », aucune opération API n'est tentée, le mode assisté reste actif. Le connecteur est à implémenter sur la documentation fournie avec l'accès.
- **Pas de scraping de Vinted ni de contournement.** Les prix de revente viennent de **vos observations** ; l'IA ne fournit que des estimations étiquetées, exclues du score.
- **SHEIN** : pas de collecte de pages (interdite par ses conditions). Utilisez des exports/flux d'affiliation ou partenaires autorisés (CSV/JSON).
- **Détourage d'arrière-plan** : non fourni (aucun service autorisé configuré) ; les autres retouches sont réelles.
- **Détection des ventes en mode assisté** : manuelle (vous enregistrez la vente) ; la notification automatique suppose l'API.
- **Notifications « temps réel »** : actualisation toutes les 20 s dans l'interface (pas de websocket) ; e-mail si SMTP configuré.
- **Paiement des achats** : jamais effectué par l'application, par conception.
- **Tarifs IA** : le coût en euros se calcule à partir des tarifs par million de tokens inscrits dans les paramètres (valeurs par défaut = tarifs publics connus à la rédaction) ; les tokens, eux, sont exacts. Vérifiez-les sur la page de tarification d'Anthropic.
- **Frais vendeur Vinted** : 0 % par défaut, modifiable (à vérifier selon votre compte).
- **Réception partielle** d'une commande : non gérée (réception totale ; ajustez le stock à la main si le fournisseur livre moins).

Détails techniques : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
