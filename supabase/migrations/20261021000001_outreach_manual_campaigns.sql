-- =============================================================================
-- Outreach : campagnes lancées manuellement, sans limite de nombre par jour (additif)
-- -----------------------------------------------------------------------------
-- La campagne automatique reste unique par jour (index partiel) ; les campagnes
-- manuelles s'ajoutent sans la modifier.
-- =============================================================================
alter table public.outreach_campaigns
  add column if not exists kind text not null default 'AUTO' check (kind in ('AUTO', 'MANUAL')),
  add column if not exists launched_by uuid references public.users (id) on delete set null;

alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_campaign_date_key;
create unique index if not exists outreach_campaigns_auto_date_key on public.outreach_campaigns (campaign_date) where kind = 'AUTO';
create index if not exists outreach_campaigns_date_idx on public.outreach_campaigns (campaign_date desc, created_at desc);
