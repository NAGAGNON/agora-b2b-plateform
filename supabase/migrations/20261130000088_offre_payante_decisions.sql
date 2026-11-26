-- Offre payante : décisions du fondateur du 26/11 (réglages seulement, tout reste éteint).
-- Gratuit 5 crédits · Pro 29 € HT, 20 crédits · Business 59 € HT, illimité.
-- Essai de 3 jours (carte demandée) : Pro = 20 crédits pendant 3 jours, Business = illimité pendant 3 jours.
-- Anciens inscrits : 3 jours offerts avec les crédits de Pro, puis choix d'une formule (Gratuit par défaut, jamais de paiement automatique).
update public.platform_settings
   set value = value || '{"FREE": 5, "PRO": 20, "TRIAL": 20, "BUSINESS": null, "BUSINESS_TRIAL": null, "trial_days": 3}'::jsonb
 where key = 'billing.credits_plan';
update public.platform_settings set value = value || '{"days": 3}'::jsonb where key = 'billing.card_trial';
insert into public.platform_settings (key, value, description)
values ('billing.legacy_gift', '{"plan": "PRO", "days": 3, "credits": 20, "then": "FREE"}'::jsonb,
        'Anciens inscrits au lancement : crédits de Pro offerts 3 jours, puis Gratuit sauf souscription volontaire')
on conflict (key) do nothing;
insert into public.platform_settings (key, value, description)
values ('billing.legacy_founder', '{"plan": "PRO", "price_ht": 14.5, "months": 3}'::jsonb,
        'Anciens inscrits : Pro au tarif fondateur (14,50 € HT les 3 premiers mois) s''ils souscrivent')
on conflict (key) do nothing;
-- Prix de référence alignés sur le site (29 € et 59 € HT par mois)
update public.plans set monthly_price_cents = 2900 where code = 'PRO';
update public.plans set monthly_price_cents = 5900 where code = 'BUSINESS';
-- Alertes (1 / 3 / illimitées) : appliquées avec les crédits au lancement, pas avant (aucun changement aujourd'hui)
