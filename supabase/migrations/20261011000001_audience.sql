-- =============================================================================
-- Mesure d'audience interne (sans cookie, sans IP, sans identifiant utilisateur)
-- -----------------------------------------------------------------------------
-- Une ligne par page vue. session_id : identifiant aléatoire propre à l'onglet
-- (sessionStorage), qui disparaît à sa fermeture. Aucun lien avec le compte.
-- Écriture uniquement par le serveur (route /api/audience, clé secrète) ;
-- lecture réservée à l'équipe via admin_audience_stats(). Conservation : 13 mois.
-- =============================================================================

create table public.page_views (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  path text not null check (char_length(path) between 1 and 300),
  referrer_host text check (char_length(referrer_host) <= 120),
  device text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  duration_ms int not null default 0 check (duration_ms between 0 and 1800000),
  created_at timestamptz not null default now()
);
create index page_views_created_idx on public.page_views (created_at desc);
create index page_views_session_idx on public.page_views (session_id);

alter table public.page_views enable row level security;
-- Aucune politique : ni lecture ni écriture via l'API publique.
revoke all on public.page_views from anon, authenticated;

create or replace function public.admin_audience_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_since timestamptz;
begin
  perform public.require_staff();
  v_since := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  return (
    with pv as (
      select * from public.page_views where created_at >= v_since
    ),
    sessions as (
      select session_id, count(*) as pages, sum(duration_ms) as total_ms, min(created_at) as started_at,
             (array_agg(referrer_host order by created_at))[1] as referrer_host,
             (array_agg(device order by created_at))[1] as device
      from pv group by session_id
    ),
    ev as (
      select event_name, count(*) as n from public.analytics_events
      where created_at >= v_since group by event_name
    )
    select jsonb_build_object(
      'days', greatest(1, least(coalesce(p_days, 30), 365)),
      'visits', (select count(*) from sessions),
      'page_views', (select count(*) from pv),
      'avg_duration_s', (select coalesce(round(avg(total_ms) / 1000.0), 0) from sessions),
      'pages_per_visit', (select coalesce(round(avg(pages)::numeric, 1), 0) from sessions),
      'bounce_rate', (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where pages = 1) / count(*)) end from sessions),
      'visits_today', (select count(*) from sessions where started_at >= date_trunc('day', now())),
      'signups', coalesce((select n from ev where event_name = 'create_account'), 0),
      'interests', coalesce((select n from ev where event_name = 'express_interest'), 0),
      'proposals', coalesce((select n from ev where event_name = 'submit_proposal'), 0),
      'published', coalesce((select n from ev where event_name = 'publish_opportunity'), 0),
      'alerts', coalesce((select n from ev where event_name = 'create_alert'), 0),
      'outbound', coalesce((select n from ev where event_name = 'source_outbound_clicked'), 0),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', d::date, 'visits', coalesce(s.n, 0)) order by d)
        from generate_series(date_trunc('day', v_since), date_trunc('day', now()), interval '1 day') d
        left join (select date_trunc('day', started_at) as day, count(*) as n from sessions group by 1) s on s.day = d
      ), '[]'::jsonb),
      'top_pages', coalesce((
        select jsonb_agg(t) from (
          select path, count(*) as views, count(distinct session_id) as visits
          from pv group by path order by count(*) desc limit 10
        ) t
      ), '[]'::jsonb),
      'referrers', coalesce((
        select jsonb_agg(t) from (
          select coalesce(referrer_host, 'Accès direct') as source, count(*) as visits
          from sessions group by 1 order by count(*) desc limit 8
        ) t
      ), '[]'::jsonb),
      'devices', coalesce((
        select jsonb_object_agg(device, n) from (select device, count(*) as n from sessions group by device) t
      ), '{}'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_audience_stats(int) from public, anon;
grant execute on function public.admin_audience_stats(int) to authenticated;

-- Purge (appelée par la tâche planifiée quotidienne)
create or replace function public.purge_page_views()
returns int language sql security definer set search_path = '' as $$
  with d as (delete from public.page_views where created_at < now() - interval '13 months' returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.purge_page_views() from public, anon, authenticated;
