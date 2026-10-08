-- =============================================================================
-- Tableau de bord détaillé + bilan du jour (additif, sans modification des données)
-- -----------------------------------------------------------------------------
-- audience_window : audience détaillée d'une fenêtre (jours/heures de Paris, canaux
--   d'acquisition, rubriques, pages, pages d'entrée). Réservée au serveur (clé secrète).
-- admin_audience_detail : même calcul pour l'équipe connectée (N derniers jours).
-- daily_reports : bilan quotidien (faits calculés + analyse rédigée), lecture admin.
-- =============================================================================

create or replace function public.audience_window(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with pv as (
    select * from public.page_views where created_at >= p_from and created_at < p_to
  ),
  sessions as (
    select session_id, count(*) as pages, sum(duration_ms) as total_ms, min(created_at) as started_at,
           (array_agg(referrer_host order by created_at))[1] as referrer_host,
           (array_agg(path order by created_at))[1] as landing
    from pv group by session_id
  ),
  classified as (
    select s.*,
      case
        when s.landing like '/opportunites/selection/%' then 'Outreach (e-mails de prospection)'
        when s.referrer_host is null then 'Accès direct'
        when s.referrer_host ~ '(^|\.)(google|bing|duckduckgo|qwant|ecosia|yahoo|yandex|startpage|lilo|baidu|search\.brave)\.' then 'Moteurs de recherche (référencement naturel)'
        when s.referrer_host ~ '(^|\.)(linkedin|lnkd|facebook|fb|instagram|twitter|t|x|youtube|tiktok|pinterest)\.' then 'Réseaux sociaux'
        when s.referrer_host ~ '(mail|outlook|webmail|messagerie)' then 'Messageries'
        else 'Autres sites'
      end as channel
    from sessions s
  ),
  sectioned as (
    select pv.*,
      case
        when path = '/' then 'Accueil'
        when path like '/opportunites/selection/%' then 'Sélections Outreach'
        when path = '/opportunites' then 'Recherche d''opportunités'
        when path ~ '^/opportunites/[0-9a-f]{8}-[0-9a-f]{4}-' then 'Fiches opportunités'
        when path like '/opportunites/%' then 'Pages régions / départements / secteurs'
        when path = '/analyses' or path like '/analyses/%' then 'Analyses (articles)'
        when path = '/ressources' or path like '/ressources/%' then 'Ressources'
        when path = '/entreprises' or path like '/entreprises/%' or path like '/fournisseurs%' or path like '/demandeurs%' then 'Annuaire des entreprises'
        when path like '/tarifs%' then 'Tarifs'
        when path like '/inscription%' or path like '/connexion%' or path like '/onboarding%' then 'Inscription / connexion'
        when path like '/dashboard%' or path like '/alertes%' or path like '/publier%' then 'Espace membre'
        else 'Autres pages'
      end as section
    from pv
  ),
  ev as (
    select event_name, count(*) as n from public.analytics_events
    where created_at >= p_from and created_at < p_to group by event_name
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'visits', (select count(*) from sessions),
    'page_views', (select count(*) from pv),
    'avg_duration_s', (select coalesce(round(avg(total_ms) / 1000.0), 0) from sessions),
    'pages_per_visit', (select coalesce(round(avg(pages)::numeric, 1), 0) from sessions),
    'bounce_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where pages = 1) / count(*)) end from sessions),
    'signups', coalesce((select n from ev where event_name = 'create_account'), 0),
    'interests', coalesce((select n from ev where event_name = 'express_interest'), 0),
    'proposals', coalesce((select n from ev where event_name = 'submit_proposal'), 0),
    'alerts', coalesce((select n from ev where event_name = 'create_alert'), 0),
    'outbound', coalesce((select n from ev where event_name = 'source_outbound_clicked'), 0),
    'searches', coalesce((select n from ev where event_name = 'search_opportunities'), 0),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'visits', coalesce(v.visits, 0), 'page_views', coalesce(p.views, 0),
                                          'seo', coalesce(v.seo, 0), 'outreach', coalesce(v.outreach, 0)) order by d)
      from generate_series((p_from at time zone 'Europe/Paris')::date, ((p_to - interval '1 second') at time zone 'Europe/Paris')::date, interval '1 day') g(d0)
      cross join lateral (select g.d0::date as d) dd
      left join (
        select (started_at at time zone 'Europe/Paris')::date as day, count(*) as visits,
               count(*) filter (where channel like 'Moteurs%') as seo,
               count(*) filter (where channel like 'Outreach%') as outreach
        from classified group by 1
      ) v on v.day = dd.d
      left join (select (created_at at time zone 'Europe/Paris')::date as day, count(*) as views from pv group by 1) p on p.day = dd.d
    ), '[]'::jsonb),
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'visits', coalesce(n, 0)) order by h)
      from generate_series(0, 23) h
      left join (select extract(hour from started_at at time zone 'Europe/Paris')::int as hr, count(*) as n from sessions group by 1) x on x.hr = h
    ), '[]'::jsonb),
    'channels', coalesce((
      select jsonb_agg(t order by t.visits desc) from (
        select channel, count(*) as visits,
               round(avg(pages)::numeric, 1) as pages_per_visit,
               round(100.0 * count(*) filter (where pages = 1) / count(*)) as bounce_rate
        from classified group by channel
      ) t
    ), '[]'::jsonb),
    'search_engines', coalesce((
      select jsonb_agg(t order by t.visits desc) from (
        select referrer_host as engine, count(*) as visits from classified where channel like 'Moteurs%' group by 1 limit 8
      ) t
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(t order by t.views desc) from (
        select section, count(*) as views, count(distinct session_id) as visits, round(avg(duration_ms) / 1000.0) as avg_duration_s
        from sectioned group by section
      ) t
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as views, count(distinct session_id) as visits, round(avg(duration_ms) / 1000.0) as avg_duration_s
        from pv group by path order by count(*) desc limit 30
      ) t
    ), '[]'::jsonb),
    'landing', coalesce((
      select jsonb_agg(t) from (
        select landing as path, count(*) as visits, round(100.0 * count(*) filter (where pages = 1) / count(*)) as bounce_rate
        from sessions group by landing order by count(*) desc limit 10
      ) t
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.audience_window(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.admin_audience_detail(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365));
begin
  perform public.require_staff();
  -- Fenêtre en jours calendaires de Paris, aujourd'hui inclus
  return public.audience_window(
    ((now() at time zone 'Europe/Paris')::date - (v_days - 1))::timestamp at time zone 'Europe/Paris',
    now()
  );
end;
$$;
revoke all on function public.admin_audience_detail(int) from public, anon;
grant execute on function public.admin_audience_detail(int) to authenticated;

-- Bilan du jour : un par jour (le plus récent écrase le précédent de la même journée)
create table if not exists public.daily_reports (
  day date primary key,
  generated_at timestamptz not null default now(),
  facts jsonb not null,
  summary jsonb,
  model text,
  note text,
  error text
);
alter table public.daily_reports enable row level security;
drop policy if exists daily_reports_admin on public.daily_reports;
create policy daily_reports_admin on public.daily_reports for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.daily_reports from anon, authenticated;
