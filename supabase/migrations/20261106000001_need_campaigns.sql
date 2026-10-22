-- Mise en relation automatique pour chaque besoin publié par une entreprise inscrite :
-- analyse du besoin, entreprises inscrites correspondantes (notification ciblée), campagne de
-- prospection dédiée (e-mail « Envoyer un message ») et suivi des résultats réels.

-- 1. Campagnes de prospection dédiées à un besoin (réutilise la file d'envoi, les limites et les exclusions)
alter table public.outreach_campaigns drop constraint if exists outreach_campaigns_kind_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_kind_check check (kind in ('AUTO', 'MANUAL', 'NEED'));
alter table public.outreach_campaigns add column if not exists opportunity_id uuid references public.opportunities (id) on delete cascade;
create unique index if not exists outreach_campaigns_need_key on public.outreach_campaigns (opportunity_id) where kind = 'NEED';

-- 2. Une campagne de mise en relation par besoin
create table if not exists public.need_campaigns (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities (id) on delete cascade,
  status text not null default 'ANALYZED' check (status in ('ANALYZED', 'RUNNING', 'CLOSED', 'SKIPPED', 'FAILED')),
  analysis jsonb not null default '{}'::jsonb,
  members_identified int not null default 0,
  members_relevant int not null default 0,
  members_notified int not null default 0,
  prospects_identified int not null default 0,
  prospects_relevant int not null default 0,
  outreach_campaign_id uuid references public.outreach_campaigns (id) on delete set null,
  note text,
  error text,
  runs int not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.need_campaigns enable row level security;
drop policy if exists need_campaigns_admin on public.need_campaigns;
create policy need_campaigns_admin on public.need_campaigns for select to authenticated using (public.is_admin());
revoke all on public.need_campaigns from anon;
grant select on public.need_campaigns to authenticated;
grant all on public.need_campaigns to service_role;

-- 3. Entreprises inscrites correspondant au besoin (score justifié, notification une seule fois, une relance au plus)
create table if not exists public.need_matches (
  id uuid primary key default gen_random_uuid(),
  need_campaign_id uuid not null references public.need_campaigns (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  score int not null,
  reasons text[] not null default '{}',
  status text not null default 'IDENTIFIED' check (status in ('IDENTIFIED', 'NOTIFIED', 'REMINDED', 'RESPONDED', 'SKIPPED')),
  skip_reason text,
  notified_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (opportunity_id, company_id)
);
create index if not exists need_matches_company_idx on public.need_matches (company_id, notified_at desc);
alter table public.need_matches enable row level security;
drop policy if exists need_matches_admin on public.need_matches;
create policy need_matches_admin on public.need_matches for select to authenticated using (public.is_admin());
revoke all on public.need_matches from anon;
grant select on public.need_matches to authenticated;
grant all on public.need_matches to service_role;

-- 4. Entreprises inscrites susceptibles de répondre à un besoin (service uniquement).
-- Même logique que les recommandations, vue du côté du besoin : secteur, compétences, zone
-- d'intervention, taille visée ; seules les données réellement renseignées comptent.
create or replace function public.need_member_candidates(p_opportunity_id uuid, p_limit int default 50)
returns table (company_id uuid, name text, score int, reasons text[], members int)
language sql stable security definer set search_path = '' as $$
  with o as (
    select op.*, (select d.region from public.departments d where d.code = op.department_code) as dep_region
    from public.opportunities op where op.id = p_opportunity_id
  ),
  scored as (
    select c.id, c.name, c.size, p.sectors, p.skills,
      (o.sector_slug is not null and o.sector_slug = any (p.sectors)) as m_sector,
      (o.department_code is not null and c.department_code = o.department_code) as m_dept,
      (coalesce(o.region, o.dep_region) is not null and (select d.region from public.departments d where d.code = c.department_code) = coalesce(o.region, o.dep_region)) as m_region,
      (c.lat is not null and o.lat is not null and public.distance_km(c.lat, c.lng, o.lat, o.lng) <= coalesce(p.intervention_radius_km, 80)) as m_zone,
      (p.intervention_zone ~* '(france|national|toute la france|hexagone)') as m_national,
      coalesce(cardinality(array(select lower(unnest(o.skills)) intersect select lower(unnest(p.skills)))), 0) as n_skills,
      exists (select 1 from unnest(p.skills) sk where length(trim(sk)) >= 3 and o.search_vector @@ plainto_tsquery('french', sk)) as m_keywords,
      (o.target_company_size is not null and o.target_company_size = c.size) as m_size,
      (select count(*) from public.company_members m join public.users u on u.id = m.user_id and u.status = 'ACTIVE' where m.company_id = c.id)::int as members
    from public.companies c
    join public.company_profiles p on p.company_id = c.id
    cross join o
    where c.id <> o.company_id
      and c.is_demo = false
      and c.status = 'ACTIVE'
      and c.kind in ('SUPPLIER', 'BOTH')
      and not exists (select 1 from public.interests i where i.opportunity_id = o.id and i.company_id = c.id and i.status <> 'WITHDRAWN')
      and not exists (select 1 from public.proposals pr where pr.opportunity_id = o.id and pr.company_id = c.id)
  )
  select s.id, s.name,
    (case when s.m_sector then 35 else 0 end
     + case when s.m_zone then 25 when s.m_dept then 20 when s.m_region then 12 when s.m_national then 8 else 0 end
     + least(s.n_skills * 10, 30)
     + case when s.m_keywords and s.n_skills = 0 then 12 else 0 end
     + case when s.m_size then 5 else 0 end)::int as score,
    array_remove(array[
      case when s.m_sector then 'Même secteur d''activité' end,
      case when s.m_zone then 'Dans sa zone d''intervention' when s.m_dept then 'Même département' when s.m_region then 'Même région' when s.m_national then 'Intervient dans toute la France' end,
      case when s.n_skills > 0 then s.n_skills || ' compétence(s) demandée(s) dans son profil' end,
      case when s.m_keywords and s.n_skills = 0 then 'Ses compétences apparaissent dans la description du besoin' end,
      case when s.m_size then 'Taille d''entreprise visée' end
    ], null) as reasons,
    s.members
  from scored s
  -- Activité d'abord : sans secteur ni compétence en commun, la seule proximité ne suffit pas
  where (s.m_sector or s.n_skills > 0 or s.m_keywords) and s.members > 0
  order by score desc, s.name
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke execute on function public.need_member_candidates(uuid, int) from public, anon, authenticated;
grant execute on function public.need_member_candidates(uuid, int) to service_role;

-- 5. Mesure des clics « Envoyer un message » et des partages d'un besoin
create or replace function public.track_event(p_event_name text, p_properties jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_event_name not in (
    'view_opportunity', 'search_opportunities', 'create_account', 'create_company', 'publish_opportunity',
    'express_interest', 'submit_proposal', 'save_favorite', 'create_alert', 'contact_company',
    'source_outbound_clicked', 'profile_completed', 'view_company', 'search_companies',
    'need_message_click', 'need_share_click'
  ) then
    raise exception 'Événement inconnu' using errcode = '22023';
  end if;
  if pg_column_size(p_properties) > 2000 then
    raise exception 'Propriétés trop volumineuses' using errcode = '22023';
  end if;
  insert into public.analytics_events (event_name, user_id, properties)
  values (p_event_name, auth.uid(), coalesce(p_properties, '{}'::jsonb));
end;
$$;

create index if not exists analytics_events_opportunity_idx on public.analytics_events ((properties->>'opportunity_id'), event_name) where properties ? 'opportunity_id';
