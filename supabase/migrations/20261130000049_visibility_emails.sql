-- Offre « Visibilité » : présentation par e-mail aux entreprises de la base de prospection, via la file
-- d'envoi de l'Outreach (mêmes garde-fous : désinscription, liste d'opposition, délai entre deux contacts,
-- limites quotidiennes et horaires, pause du week-end). Une campagne par offre validée.
alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_kind_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_kind_check check (kind in ('AUTO', 'MANUAL', 'NEED', 'BOOST'));
alter table public.outreach_campaigns add column if not exists boost_id uuid references public.visibility_boosts (id) on delete cascade;
create unique index if not exists outreach_campaigns_boost_key on public.outreach_campaigns (boost_id) where kind = 'BOOST';

-- Entreprises de la base à présenter aujourd'hui : correspondent au ciblage, jamais présentées pour cette
-- offre, pas contactées depuis p_min_days jours, aucun envoi en attente.
create or replace function public.boost_pick_prospects(p_boost_id uuid, p_limit int, p_min_days int default 7)
returns table (id uuid, email text) language sql stable security definer set search_path = '' as $$
  select p.id, lower(p.email)
    from public.visibility_boosts b
    join public.outreach_prospects p on public.boost_prospect_matches(b.targeting, p.id)
   where b.id = p_boost_id
     and (p.last_contacted_at is null or p.last_contacted_at < now() - make_interval(days => p_min_days))
     and not exists (select 1 from public.boost_presentations x where x.boost_id = b.id and x.prospect_id = p.id)
     and not exists (select 1 from public.outreach_recipients r where r.prospect_id = p.id and r.status in ('PENDING', 'QUEUED', 'SENDING'))
   order by (p.region is not distinct from (select region from public.companies where id = b.company_id)) desc, p.last_contacted_at nulls first
   limit greatest(0, least(p_limit, 200));
$$;
revoke all on function public.boost_pick_prospects(uuid, int, int) from public, anon, authenticated;
grant execute on function public.boost_pick_prospects(uuid, int, int) to service_role;
