-- Visites de robots retirées des chiffres d'audience (administration, bilan du soir, stratégie).
-- Robot : visite d'une seule page, 0 seconde de lecture, sur ordinateur, terminée depuis plus de 30 minutes
-- (constaté le 20-21/11 : visites « depuis Google » toutes les 2 heures, à heure fixe, sans aucune lecture).
-- Aucune donnée supprimée : la table page_views reste intacte, seuls les calculs lisent cette vue.
create or replace view public.page_views_human with (security_invoker = true) as
select pv.*
from public.page_views pv
where not (
  coalesce(pv.duration_ms, 0) = 0
  and pv.device = 'desktop'
  and pv.created_at < now() - interval '30 minutes'
  and not exists (select 1 from public.page_views o where o.session_id = pv.session_id and o.id <> pv.id)
);

revoke all on public.page_views_human from anon, authenticated;
grant select on public.page_views_human to service_role;

create index if not exists page_views_session_idx on public.page_views (session_id);

CREATE OR REPLACE FUNCTION public.admin_audience_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_since timestamptz;
begin
  perform public.require_staff();
  -- « Aujourd'hui » = depuis minuit (heure de Paris) ; sinon N jours calendaires, aujourd'hui inclus
  v_since := (((now() at time zone 'Europe/Paris')::date - (greatest(1, least(coalesce(p_days, 30), 365)) - 1))::timestamp at time zone 'Europe/Paris');
  return (
    with pv as (
      select * from public.page_views_human where created_at >= v_since
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
      'signups', (select count(*) from public.users u where u.created_at >= v_since and u.platform_role = 'USER' and not u.is_internal),
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
$function$

;
CREATE OR REPLACE FUNCTION public.audience_window(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with pv as (
    select * from public.page_views_human where created_at >= p_from and created_at < p_to
  ),
  sessions as (
    select session_id, count(*) as pages, sum(duration_ms) as total_ms, min(created_at) as started_at,
           (array_agg(referrer_host order by created_at))[1] as referrer_host,
           (array_agg(path order by created_at))[1] as landing,
           (array_agg(source order by created_at))[1] as source
    from pv group by session_id
  ),
  classified as (
    select s.*,
      case
        when s.landing like '/opportunites/selection/%' then 'Outreach (e-mails de prospection)'
        -- Assistants IA (ChatGPT, Perplexity…) : souvent sans site d'origine, mais avec un lien étiqueté
        when coalesce(s.referrer_host, '') ~* '(chatgpt|openai|perplexity|copilot|gemini|claude|mistral|deepseek|you\.com)'
          or coalesce(s.source, '') ~* '(chatgpt|openai|perplexity|copilot|gemini|claude|mistral|deepseek)' then 'Assistants IA (ChatGPT, Perplexity…)'
        when s.referrer_host is null then 'Accès direct'
        when s.referrer_host ~ '(^|\.)(google|bing|duckduckgo|qwant|ecosia|yahoo|yandex|startpage|lilo|baidu|search\.brave)\.' then 'Moteurs de recherche (référencement naturel)'
        when s.referrer_host ~ '(^|\.)(linkedin|lnkd|facebook|fb|instagram|twitter|t|x|youtube|tiktok|pinterest)\.' then 'Réseaux sociaux'
        when s.referrer_host ~ '(mail|outlook|webmail|messagerie)' then 'Messageries'
        when s.referrer_host ~ '(^|\.)(g2|capterra|getapp|softwareadvice|crunchbase|producthunt|appvizer)\.' then 'Annuaires (G2, Capterra, Crunchbase…)'
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
                                          'seo', coalesce(v.seo, 0), 'outreach', coalesce(v.outreach, 0), 'ai', coalesce(v.ai, 0)) order by d)
      from generate_series((p_from at time zone 'Europe/Paris')::date, ((p_to - interval '1 second') at time zone 'Europe/Paris')::date, interval '1 day') g(d0)
      cross join lateral (select g.d0::date as d) dd
      left join (
        select (started_at at time zone 'Europe/Paris')::date as day, count(*) as visits,
               count(*) filter (where channel like 'Moteurs%') as seo,
               count(*) filter (where channel like 'Outreach%') as outreach,
               count(*) filter (where channel like 'Assistants IA%') as ai
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
    'ai_assistants', coalesce((
      select jsonb_agg(t order by t.visits desc) from (
        select coalesce(nullif(source, ''), referrer_host) as assistant, count(*) as visits
        from classified where channel like 'Assistants IA%' group by 1 limit 8
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
$function$

;
CREATE OR REPLACE FUNCTION public.growth_metrics(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with pv as (
    select session_id, path, referrer_host, created_at
    from public.page_views_human where created_at >= p_from and created_at < p_to
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
$function$

;
CREATE OR REPLACE FUNCTION public.seo_snapshot(p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with bounds as (
    select ((p_now at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris' as today,
           (((p_now at time zone 'Europe/Paris')::date) - 1)::timestamp at time zone 'Europe/Paris' as yesterday,
           (((p_now at time zone 'Europe/Paris')::date) - 6)::timestamp at time zone 'Europe/Paris' as week
  ),
  -- Première page de chaque visite des 7 derniers jours : la visite « vient de Google » si cette
  -- première page a été ouverte depuis Google
  firsts as (
    select distinct on (pv.session_id) pv.session_id, pv.path, pv.referrer_host, pv.created_at
    from public.page_views_human pv, bounds b
    where pv.created_at >= b.week and pv.created_at <= p_now
    order by pv.session_id, pv.created_at, pv.id
  ),
  google as (
    select f.* from firsts f where f.referrer_host ~ '(^|\.)google\.'
  ),
  arts as (
    select a.id, a.title, a.slug, a.published_at
    from public.articles a, bounds b
    where a.status = 'PUBLISHED' and a.published_at >= b.yesterday and a.published_at <= p_now
  ),
  art_views as (
    select a.slug,
           count(pv.id) filter (where pv.created_at >= b.today) as views_today,
           count(pv.id) filter (where pv.created_at >= b.yesterday and pv.created_at < b.today) as views_yesterday,
           count(pv.id) as views_total,
           count(distinct pv.session_id) as visitors_total,
           count(distinct pv.session_id) filter (where g.session_id is not null) as visitors_from_google
    from arts a
    cross join bounds b
    left join public.page_views_human pv on pv.path = '/analyses/' || a.slug and pv.created_at <= p_now
    left join google g on g.session_id = pv.session_id
    group by a.slug
  ),
  signups as (
    select u.id, u.full_name, u.created_at,
           (select c.name from public.company_members m join public.companies c on c.id = m.company_id where m.user_id = u.id order by m.created_at limit 1) as company,
           exists (select 1 from public.outreach_events e where e.type = 'SIGNUP' and e.user_id = u.id) as from_outreach,
           case when exists (select 1 from public.outreach_events e where e.type = 'SIGNUP' and e.user_id = u.id) then 'Prospection (e-mail)'
                else public.visit_origin(u.signup_visit) end as origin
    from public.users u, bounds b
    where u.created_at >= b.today and u.created_at <= p_now and not u.is_demo and not u.is_internal
  )
  select jsonb_build_object(
    'google', jsonb_build_object(
      'today', (select count(*) from google g, bounds b where g.created_at >= b.today),
      'yesterday', (select count(*) from google g, bounds b where g.created_at >= b.yesterday and g.created_at < b.today),
      'last_7_days', (select count(*) from google),
      'landing_today', coalesce((
        select jsonb_agg(x order by x.visits desc, x.path) from (
          select g.path, count(*) as visits from google g, bounds b where g.created_at >= b.today group by g.path order by 2 desc, 1 limit 8
        ) x), '[]'::jsonb)
    ),
    'articles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', a.title, 'slug', a.slug, 'published_at', a.published_at,
        'published', case when a.published_at >= b.today then 'today' else 'yesterday' end,
        'views_today', v.views_today, 'views_yesterday', v.views_yesterday, 'views_total', v.views_total,
        'visitors_total', v.visitors_total, 'visitors_from_google', v.visitors_from_google
      ) order by a.published_at desc)
      from arts a cross join bounds b join art_views v on v.slug = a.slug), '[]'::jsonb),
    'signups', jsonb_build_object(
      'today', (select count(*) from signups),
      'from_outreach', (select count(*) from signups where from_outreach),
      'by_origin', coalesce((select jsonb_agg(jsonb_build_object('origin', x.origin, 'count', x.n) order by x.n desc, x.origin) from (select origin, count(*) n from signups group by origin) x), '[]'::jsonb),
      'list', coalesce((
        select jsonb_agg(jsonb_build_object('name', nullif(s.full_name, ''), 'company', s.company, 'at', s.created_at, 'from_outreach', s.from_outreach, 'origin', s.origin) order by s.created_at desc)
        from (select * from signups order by created_at desc limit 50) s), '[]'::jsonb)
    )
  );
$function$

;
