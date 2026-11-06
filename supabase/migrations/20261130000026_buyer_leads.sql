-- Suivre un acheteur avec sa seule adresse e-mail (sans compte) : l'alerte e-mail existante gagne un
-- critère « acheteur ». Double confirmation et désinscription en un clic, comme les autres alertes.
alter table public.alert_leads
  add column if not exists buyer_slug text check (buyer_slug is null or buyer_slug ~ '^[a-z0-9-]{1,80}$'),
  add column if not exists buyer_name text check (buyer_name is null or char_length(buyer_name) <= 200);

drop index if exists public.alert_leads_unique_idx;
create unique index if not exists alert_leads_unique_idx
  on public.alert_leads (email, coalesce(sector_slug, ''), coalesce(department_code, ''), coalesce(buyer_slug, ''));
