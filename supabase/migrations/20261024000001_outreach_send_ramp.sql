-- =============================================================================
-- Outreach : montée en charge automatique des envois (objectif 200 e-mails par jour)
-- -----------------------------------------------------------------------------
-- Chaque semaine, la limite quotidienne monte d'un palier (75 → 100 → 150 → 200) seulement si
-- les rebonds et désinscriptions de la semaine restent faibles ; elle redescend d'un palier si
-- les rebonds deviennent trop nombreux. Réglable (ou désactivable) dans Outreach → Paramètres.
-- Additif : les limites ne sont relevées que si elles sont encore aux valeurs de départ.
-- =============================================================================

alter table public.outreach_settings
  add column if not exists send_ramp_enabled boolean not null default true,
  add column if not exists send_ramp_target int not null default 200 check (send_ramp_target between 0 and 10000),
  add column if not exists send_ramp_last_at timestamptz;

-- Premier palier (75 par jour, 40 par heure) si les limites sont encore celles de départ
update public.outreach_settings set total_daily_send_cap = 75, send_ramp_last_at = now() where id and total_daily_send_cap = 50;
update public.outreach_settings set hourly_send_cap = 40 where id and hourly_send_cap = 20;
