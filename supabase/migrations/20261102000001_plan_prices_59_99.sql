-- Nouveaux prix publics (décision du propriétaire, 21/10/2026) : Pro 59 € HT/mois, Business 99 € HT/mois.
-- Ne modifie que le prix affiché des offres ; aucun abonnement ni aucune donnée n'est supprimé.
-- Le montant réellement facturé vient du prix Stripe (STRIPE_PRO_PRICE_ID / STRIPE_BUSINESS_PRICE_ID).
update public.plans set monthly_price_cents = 5900 where code = 'PRO';
update public.plans set monthly_price_cents = 9900 where code = 'BUSINESS';
