-- Offre Gratuit : 2 candidatures par mois (décision du fondateur du 26/11, d'après l'usage réel :
-- sur 30 jours, 12 entreprises sur 18 ont commencé 1 candidature, 6 en ont commencé 2 ou plus).
-- Réglage seulement : les crédits restent éteints.
update public.platform_settings set value = value || '{"FREE": 2}'::jsonb where key = 'billing.credits_plan';
update public.platform_settings set value = value || '{"then_credits": 2}'::jsonb where key = 'billing.legacy_gift';
