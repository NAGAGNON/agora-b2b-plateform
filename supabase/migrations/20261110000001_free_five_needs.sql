-- Offre gratuite : jusqu'à 5 besoins actifs (au lieu de 1).
update public.plans set features = jsonb_set(features, '{active_needs}', '5'::jsonb) where code = 'FREE';
