-- Décision du propriétaire : pas de limite quotidienne pratique à la recherche d'adresses e-mail.
-- 5000 = valeur maximale autorisée ; la vraie limite devient le temps de chaque tâche (5 minutes).
alter table public.outreach_settings alter column enrichment_daily_limit set default 5000;
update public.outreach_settings set enrichment_daily_limit = 5000, updated_at = now() where id;
