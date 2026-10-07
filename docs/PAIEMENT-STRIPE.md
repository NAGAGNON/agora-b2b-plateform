# Paiement Stripe (abonnements Pro et Business)

Offres : **Gratuit** (0 €), **Pro** (29 € HT/mois), **Business** (59 € HT/mois), TVA 20 % en sus.
Les limites sont appliquées **en base de données** (table `plans` + déclencheurs), jamais seulement dans l'interface.

## Fonctionnement

| Étape | Où | Détail |
|---|---|---|
| Souscription | `/dashboard/abonnement` | Case « J'accepte les conditions d'abonnement… » non pré-cochée, vérifiée côté serveur, puis redirection vers **Stripe Checkout** |
| Activation | Webhook `POST /api/stripe/webhook` | Signature vérifiée (`STRIPE_WEBHOOK_SECRET`), événement traité une seule fois (`billing_events`) |
| Retour de paiement | `/dashboard/abonnement?paiement=succes` | Relecture de la session Checkout chez Stripe (appartenance à l'entreprise vérifiée) → « 🎉 Bienvenue sur LinkProB2B Pro. » |
| Gestion | Portail client Stripe | Moyen de paiement, factures, changement Pro ↔ Business, résiliation |
| Échec de paiement | `invoice.payment_failed` | Statut `past_due` : accès **conservé** pendant les relances Stripe, bandeau « Votre paiement n'a pas pu être traité » |
| Fin d'abonnement | `customer.subscription.deleted` | Retour à l'offre Gratuite, **aucune donnée supprimée**, nouveaux ajouts au-delà des limites bloqués |

Garde-fou : une clé `sk_live_…` est refusée tant que `STRIPE_ALLOW_LIVE=1` n'est pas défini.

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Valeur | Où la trouver (Stripe, **mode Test** activé) |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` | Developers → API keys → Secret key |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (facultative) | Developers → API keys → Publishable key |
| `STRIPE_PRO_PRICE_ID` | `price_…` | Product catalog → produit « LinkProB2B Pro » → prix 29 € mensuel récurrent |
| `STRIPE_BUSINESS_PRICE_ID` | `price_…` | Product catalog → produit « LinkProB2B Business » → prix 59 € mensuel récurrent |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Developers → Webhooks → endpoint créé → Signing secret |
| `STRIPE_TAX_RATE_ID` | `txr_…` (facultative) | Product catalog → Tax rates → TVA 20 % « exclusive » |

Webhook : `https://www.linkprob2b.com/api/stripe/webhook`, événements
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

Vérification : `https://www.linkprob2b.com/api/sante` → `configuration.stripe.checkoutReady: true`, `mode: "test"`.

## Tests

- `tests/integration/billing.test.ts` : webhooks avec vraies signatures, signature invalide, idempotence, Gratuit → Pro → Business → échec → paiement → résiliation → Gratuit, limites, données conservées.
- `tests/e2e/billing-legal.spec.ts` : Tarifs, Mon abonnement, case non pré-cochée, paywall, pages légales.
