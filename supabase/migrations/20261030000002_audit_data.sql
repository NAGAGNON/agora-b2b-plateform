-- Audit : données affichées.
-- 1. Audience (administration) : « visites aujourd'hui » et courbe quotidienne en jours de Paris
--    (et non en jours UTC : les visites de 0 h à 2 h du matin étaient comptées la veille).
-- 2. Comptes d'opportunités ouvertes (plan du site, pages régions / secteurs) : uniquement ce qu'un
--    visiteur voit réellement (publiques, entreprise active), comme les pages elles-mêmes.

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
      'visits_today', (select count(*) from sessions where started_at >= (date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')),
      'signups', coalesce((select n from ev where event_name = 'create_account'), 0),
      'interests', coalesce((select n from ev where event_name = 'express_interest'), 0),
      'proposals', coalesce((select n from ev where event_name = 'submit_proposal'), 0),
      'published', coalesce((select n from ev where event_name = 'publish_opportunity'), 0),
      'alerts', coalesce((select n from ev where event_name = 'create_alert'), 0),
      'outbound', coalesce((select n from ev where event_name = 'source_outbound_clicked'), 0),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', d::date, 'visits', coalesce(s.n, 0)) order by d)
        from generate_series((v_since at time zone 'Europe/Paris')::date, (now() at time zone 'Europe/Paris')::date, interval '1 day') d
        left join (select (started_at at time zone 'Europe/Paris')::date as day, count(*) as n from sessions group by 1) s on s.day = d::date
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

create or replace function public.open_opportunity_counts()
returns table (dimension text, key text, n bigint)
language sql stable security definer set search_path = '' as $$
  with open as (
    select region, department_code, sector_slug from public.opportunities
    where status = 'PUBLISHED' and not is_demo and visibility = 'PUBLIC'
      and (company_id is null or public.is_company_active(company_id))
      and (response_deadline is null or response_deadline > now())
  )
  select 'region', region, count(*) from open where region is not null group by region
  union all
  select 'department', department_code, count(*) from open where department_code is not null group by department_code
  union all
  select 'sector', sector_slug, count(*) from open where sector_slug is not null group by sector_slug
  union all
  select 'region_sector', region || '|' || sector_slug, count(*) from open where region is not null and sector_slug is not null group by region, sector_slug
  union all
  select 'total', null, count(*) from open;
$$;
