# Architecture

```
Navigateur ──► Caddy (HTTPS) ──► Next.js 16 (UI, proxy /api/*) ──► FastAPI ──► PostgreSQL
                                                                    │  └─ APScheduler (tâches planifiées, même processus)
                                                                    └─ API Claude (budgetée, cachée)
```

- **Frontend** : Next.js 16 (App Router), TypeScript, Tailwind 4, lucide-react, Recharts. `src/proxy.ts` (ex-middleware) redirige vers `/login` sans cookie ; l'autorisation réelle est faite par l'API. `/api/*` est relayé vers FastAPI (même origine ⇒ cookie de session `HttpOnly`).
- **Backend** : FastAPI + SQLAlchemy 2 + Alembic. Une transaction par requête (commit avant l'envoi de la réponse). Authentification : mot de passe unique → cookie signé HMAC ; clés API chiffrées (Fernet) et jamais renvoyées.
- **Planification** : APScheduler dans l'API (1 seul worker). Choix assumé : mono-utilisateur, pas de Redis/Celery à opérer. Pour passer à Celery, `services/automation.JOBS` contient des fonctions pures `fn(db)` directement réutilisables comme tâches.

## Règles financières (`core/`, `services/finance.py`)

- Tout en `Decimal`, arrondi commercial au centime ; frais de commande répartis par plus grand reste (somme exacte).
- Coût total = achat + livraison fournisseur + emballage + frais opérationnels + autres. Bénéfice net = prix encaissé − coût total − frais vendeur − remboursements/pertes. Marge = bénéfice net / prix de vente (exemple : 12 € + 4 € → vente 29 € → 13 € = 44,8 %).
- **Achats de stock capitalisés** : ils sortent de la trésorerie à la commande mais ne deviennent coût qu'à la vente de l'article. Journal `expenses` : `purchase_order_id` ⇒ achat de stock ; `sale_id` ⇒ coût de vente (déjà dans le bénéfice de la vente) ; sinon charge d'exploitation. Aucun double comptage.
- Trésorerie = capital initial + versements reçus − sorties. Capital disponible pour achats = trésorerie − achats validés non commandés.
- Les écritures annulées sont marquées (`voided_at`), jamais supprimées.

## Score d'opportunité

Marge 40 · bénéfice 20 · demande 15 · concurrence 10 · risque 10 · preuves de prix 5. Prix de revente = médiane des ventes observées > médiane des annonces observées > estimation manuelle. Sans prix de revente : pas de score. Inconnu ⇒ note neutre et confiance réduite. Produit non rentable ⇒ score ≤ 20 puis écarté par le Profit Manager (passation). `forbidden` ⇒ 0.

## IA

`services/ai.py` : contrôle budget (global + agent) avant chaque appel, cache SHA-256, enregistrement tokens/coût. `services/chat.py` : boucle d'outils sur liste blanche (`TOOLS`), résultats réels renvoyés au modèle, erreurs d'outil visibles, journal d'audit (`actor=ai`).

## Tests (`backend/tests`, 44)

Calculs financiers et allocation exacte, scoring, workflow achat/stock/vente/remboursement/annulation, trésorerie et bilans, API complète (flux de bout en bout, auth, SSRF, import CSV, conformité, photos, documents), bus d'agents, calendrier, boucle Claude réelle du SDK sur faux serveur HTTP (aucun coût).
