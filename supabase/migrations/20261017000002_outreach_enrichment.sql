-- LinkProB2B Outreach — recherche des coordonnées professionnelles (migration additive).
-- Site officiel (API de recherche Brave ou Dropcontact), puis adresse GÉNÉRIQUE
-- (contact@, info@…) lue sur la page Contact du site, en respectant robots.txt.
-- Aucune adresse nominative n'est conservée.

alter table public.outreach_prospects
  add column if not exists enrichment_status text not null default 'PENDING'
    check (enrichment_status in ('PENDING', 'FOUND', 'NO_WEBSITE', 'NO_EMAIL', 'BLOCKED', 'ERROR')),
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_note text;
create index if not exists outreach_prospects_enrichment_idx on public.outreach_prospects (enrichment_status, enriched_at);

alter table public.outreach_settings
  add column if not exists enrichment_enabled boolean not null default true,
  add column if not exists enrichment_daily_limit int not null default 100 check (enrichment_daily_limit between 0 and 5000);

-- Décision du propriétaire : envoi réel automatique (sans simulation ni validation manuelle).
-- Ne modifie pas des réglages déjà changés depuis le tableau de bord (updated_by renseigné).
alter table public.outreach_settings alter column dry_run set default false;
alter table public.outreach_settings alter column require_validation set default false;
update public.outreach_settings set dry_run = false, require_validation = false, updated_at = now() where id and updated_by is null;
