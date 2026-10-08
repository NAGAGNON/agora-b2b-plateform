-- =============================================================================
-- Outreach : limites relevées à la demande du propriétaire (recherche d'adresses et envois)
-- Valeurs modifiables ensuite dans Outreach → Paramètres. Ne fait que relever (jamais baisser).
-- =============================================================================
alter table public.outreach_settings drop constraint if exists outreach_settings_enrichment_daily_limit_check;
alter table public.outreach_settings add constraint outreach_settings_enrichment_daily_limit_check check (enrichment_daily_limit between 0 and 50000);

alter table public.outreach_settings alter column daily_send_cap set default 300;
alter table public.outreach_settings alter column enrichment_daily_limit set default 20000;
update public.outreach_settings
set daily_send_cap = greatest(daily_send_cap, 300),
    enrichment_daily_limit = greatest(enrichment_daily_limit, 20000),
    updated_at = now()
where id;
