-- =============================================================================
-- Moteur de stratégie (croissance des visites et des inscriptions)
-- -----------------------------------------------------------------------------
-- Chaque soir, après le bilan, le site mesure ce qui a marché sur les 14 derniers jours
-- (pages d'entrée, rebond, inscriptions, recherches Google, articles, prospection par secteur)
-- et adapte sa stratégie du lendemain. Données agrégées uniquement : aucune donnée personnelle.
-- =============================================================================

create table if not exists public.growth_snapshots (
  day date primary key,
  computed_at timestamptz not null default now(),
  metrics jsonb not null,
  strategy jsonb not null,
  changes jsonb not null default '[]'::jsonb
);
alter table public.growth_snapshots enable row level security;
drop policy if exists growth_snapshots_admin on public.growth_snapshots;
create policy growth_snapshots_admin on public.growth_snapshots for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.growth_snapshots from anon, authenticated;

-- Priorité d'envoi et de recherche d'adresse donnée par la stratégie (secteurs qui répondent le mieux d'abord)
alter table public.outreach_recipients add column if not exists priority int not null default 0;

create or replace function public.growth_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with pv as (
    select session_id, path, referrer_host, created_at
    from public.page_views where created_at >= p_from and created_at < p_to
  ),
  s as (
    select session_id,
      (array_agg(path order by created_at))[1] as entry,
      (array_agg(referrer_host order by created_at))[1] as ref,
      count(*) as pages,
      bool_or(path = '/inscription') as intent,
      bool_or(path like '/onboarding%') as signed
    from pv group by session_id
  ),
  g as (
    select *,
      case
        when entry = '/' then 'accueil'
        when entry = '/opportunites' then 'liste des opportunités'
        when entry like '/opportunites/selection/%' then 'sélections de prospection'
        when entry ~ '^/opportunites/[0-9a-f]{8}-' then 'fiches opportunité'
        when entry like '/opportunites/%' then 'pages régions et secteurs'
        when entry like '/analyses%' then 'articles (analyses)'
        when entry like '/acheteurs%' then 'pages acheteurs'
        when entry in ('/ingenieurs-affaires', '/fournisseurs', '/demandeurs') then 'pages par profil'
        when entry like '/entreprises%' then 'annuaire'
        when entry = '/inscription' then 'inscription'
        else 'autres pages'
      end as grp,
      coalesce(ref ~* '(google|bing|qwant|duckduckgo|ecosia|yahoo|yandex|startpage|search\.brave)', false) as from_search
    from s
  ),
  groups as (
    select grp, count(*) as visits, count(*) filter (where pages = 1) as bounces,
      count(*) filter (where intent) as intent, count(*) filter (where signed) as signups,
      count(*) filter (where from_search) as from_search
    from g group by grp
  ),
  search_landings as (
    select entry as path, count(*) as visits from g where from_search group by entry order by count(*) desc limit 50
  ),
  zones as (
    select split_part(path, '/', 3) as slug, count(*) as views
    from pv
    where path like '/opportunites/%' and path !~ '^/opportunites/[0-9a-f]{8}-' and path not like '/opportunites/selection/%'
    group by 1 order by 2 desc limit 100
  ),
  art as (
    select a.slug, a.topic_key, a.published_at,
      (select count(*) from pv where pv.path = '/analyses/' || a.slug) as views,
      (select count(*) from g where g.entry = '/analyses/' || a.slug and g.from_search) as search_visits
    from public.articles a
    where a.status = 'PUBLISHED' and a.published_at < p_to and a.published_at >= p_from - interval '30 days'
  ),
  sent as (
    select r.id, r.clicked_at, r.signed_up_at,
      (select o.sector_slug from public.outreach_recipient_opportunities ro join public.opportunities o on o.id = ro.opportunity_id
        where ro.recipient_id = r.id order by ro.position limit 1) as sector
    from public.outreach_recipients r
    where r.status = 'SENT' and r.sent_at >= p_from and r.sent_at < p_to
  ),
  sectors as (
    select sector, count(*) as sent, count(clicked_at) as clicks, count(signed_up_at) as signups
    from sent where sector is not null group by sector
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'visits', (select count(*) from g),
    'from_search', (select count(*) from g where from_search),
    'signups', (select count(*) from g where signed),
    'entry_groups', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from groups x), '[]'::jsonb),
    'search_landings', coalesce((select jsonb_agg(to_jsonb(x) order by x.visits desc) from search_landings x), '[]'::jsonb),
    'zones', coalesce((select jsonb_agg(to_jsonb(x) order by x.views desc) from zones x), '[]'::jsonb),
    'articles', coalesce((select jsonb_agg(to_jsonb(x) order by x.views desc) from art x), '[]'::jsonb),
    'outreach_sectors', coalesce((select jsonb_agg(to_jsonb(x) order by x.sent desc) from sectors x), '[]'::jsonb)
  );
$$;
revoke all on function public.growth_metrics(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.growth_metrics(timestamptz, timestamptz) to service_role;
