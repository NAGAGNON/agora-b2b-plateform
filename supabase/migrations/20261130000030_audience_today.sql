-- Audience : période « Aujourd'hui » depuis minuit (Paris) et périodes en jours calendaires ;
-- inscriptions comptées sur les comptes réellement créés.
create or replace function public.admin_audience_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_since timestamptz;
begin
  perform public.require_staff();
  -- « Aujourd'hui » = depuis minuit (heure de Paris) ; sinon N jours calendaires, aujourd'hui inclus
  v_since := (((now() at time zone 'Europe/Paris')::date - (greatest(1, least(coalesce(p_days, 30), 365)) - 1))::timestamp at time zone 'Europe/Paris');
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
      -- Comptes réellement créés sur la période (hors équipe), quel que soit le parcours d'inscription
      'signups', (select count(*) from public.users u where u.created_at >= v_since and u.platform_role = 'USER'),
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
