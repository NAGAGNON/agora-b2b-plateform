-- Comptes internes (propriétaire, essais) : exclus des statistiques, de la facturation et des compteurs.
alter table public.users add column if not exists is_internal boolean not null default false;
alter table public.companies add column if not exists is_internal boolean not null default false;

-- Comptes personnels du propriétaire et entreprise de test créée avec eux
update public.users set is_internal = true
where lower(email) in ('yeoaguyroland@gmail.com', 'yeobguyroland@gmail.com', 'yeocguyroland@gmail.com');
update public.companies c set is_internal = true
where exists (select 1 from public.company_members m where m.company_id = c.id)
  and not exists (
    select 1 from public.company_members m join public.users u on u.id = m.user_id
    where m.company_id = c.id and not u.is_internal
  );


create or replace function public.admin_billing_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return (
    with live as (
      select distinct on (s.company_id) s.* from public.subscriptions s
      join public.companies c on c.id = s.company_id and not c.is_internal
      where s.status in ('active', 'trialing', 'past_due')
      order by s.company_id, s.updated_at desc
    )
    select jsonb_build_object(
      'companies_free', (select count(*) from public.companies where not is_internal and status = 'ACTIVE' and is_demo = false and plan_code not in ('PRO', 'BUSINESS')),
      'companies_pro', (select count(*) from public.companies where not is_internal and plan_code = 'PRO' and is_demo = false),
      'companies_business', (select count(*) from public.companies where not is_internal and plan_code = 'BUSINESS' and is_demo = false),
      'mrr_cents', (select coalesce(sum(case when billing_interval = 'year' then unit_amount_cents / 12 else unit_amount_cents end), 0) from live),
      'past_due', (select count(*) from live where status = 'past_due'),
      'cancel_scheduled', (select count(*) from live where cancel_at_period_end),
      'new_30d', (select count(*) from public.subscriptions where company_id not in (select id from public.companies where is_internal) and started_at > now() - interval '30 days'),
      'new_pro_30d', (select count(*) from public.subscriptions where company_id not in (select id from public.companies where is_internal) and plan_code = 'PRO' and started_at > now() - interval '30 days'),
      'new_business_30d', (select count(*) from public.subscriptions where company_id not in (select id from public.companies where is_internal) and plan_code = 'BUSINESS' and started_at > now() - interval '30 days'),
      'churned_30d', (select count(*) from public.subscriptions where company_id not in (select id from public.companies where is_internal) and ended_at > now() - interval '30 days'),
      'companies_total', (select count(*) from public.companies where not is_internal and is_demo = false),
      'ever_paid_pro', (select count(distinct company_id) from public.subscriptions where company_id not in (select id from public.companies where is_internal) and plan_code = 'PRO'),
      'ever_paid_business', (select count(distinct company_id) from public.subscriptions where company_id not in (select id from public.companies where is_internal) and plan_code = 'BUSINESS'),
      'revenue_30d_cents', (select coalesce(sum(amount_paid_cents), 0) from public.invoices where company_id not in (select id from public.companies where is_internal) and status = 'paid' and created_at > now() - interval '30 days')
    )
  );
end;
$$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  o record;
  a record;
begin
  perform public.require_staff();
  select
    count(*) filter (where status = 'PUBLISHED' and origin = 'INTERNAL') as published,
    count(*) filter (where status = 'PUBLISHED' and origin = 'EXTERNAL') as external,
    count(*) filter (where status = 'PENDING_REVIEW') as pending,
    count(*) filter (where status = 'EXPIRED') as expired,
    count(*) filter (where type in ('PRIVATE_CONSULTATION', 'PRIVATE_TENDER', 'QUOTE_REQUEST') and status <> 'DRAFT') as consultations,
    count(*) filter (where is_demo) as demo
  into o from public.opportunities;
  select
    count(distinct company_id) as companies_active,
    count(*) filter (where event_name = 'search_opportunities') as searches,
    count(*) filter (where event_name = 'view_opportunity') as views,
    count(*) filter (where event_name = 'source_outbound_clicked') as outbound,
    count(*) filter (where event_name = 'express_interest') as interests
  into a from public.analytics_events where created_at > now() - interval '30 days';
  return jsonb_build_object(
    'users_total', (select count(*) from public.users where status <> 'DELETED' and not is_internal),
    'users_active_30d', (select count(*) from public.users where not is_internal and last_seen_at > now() - interval '30 days'),
    'users_suspended', (select count(*) from public.users where status = 'SUSPENDED'),
    'companies_total', (select count(*) from public.companies where not is_internal),
    'companies_completed', (select count(*) from public.company_profiles p
        where coalesce(p.description, '') <> '' and cardinality(p.sectors) > 0 and cardinality(p.skills) > 0),
    'companies_active', a.companies_active,
    'companies_verified', (select count(*) from public.companies where verified_at is not null),
    'opportunities_published', o.published,
    'opportunities_external', o.external,
    'opportunities_pending', o.pending,
    'opportunities_expired', o.expired,
    'consultations', o.consultations,
    'interests', (select count(*) from public.interests),
    'proposals', (select count(*) from public.proposals where status <> 'WITHDRAWN'),
    'conversations', (select count(*) from public.conversations),
    'reports_open', (select count(*) from public.reports where status in ('OPEN', 'REVIEWING')),
    'sources_total', (select count(*) from public.external_sources),
    'sources_approved', (select count(*) from public.external_sources where status = 'APPROVED'),
    'searches_30d', a.searches,
    'views_30d', a.views,
    'outbound_clicks_30d', a.outbound,
    'interests_30d', a.interests,
    'contact_messages_open', (select count(*) from public.contact_messages where not handled),
    'demo_records', o.demo + (select count(*) from public.companies where is_demo)
  );
end;
$$;

create or replace function public.seo_snapshot(p_now timestamptz default now())
returns jsonb language sql stable security definer set search_path = '' as $$
  with bounds as (
    select ((p_now at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris' as today,
           (((p_now at time zone 'Europe/Paris')::date) - 1)::timestamp at time zone 'Europe/Paris' as yesterday,
           (((p_now at time zone 'Europe/Paris')::date) - 6)::timestamp at time zone 'Europe/Paris' as week
  ),
  -- Première page de chaque visite des 7 derniers jours : la visite « vient de Google » si cette
  -- première page a été ouverte depuis Google
  firsts as (
    select distinct on (pv.session_id) pv.session_id, pv.path, pv.referrer_host, pv.created_at
    from public.page_views pv, bounds b
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
    left join public.page_views pv on pv.path = '/analyses/' || a.slug and pv.created_at <= p_now
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
$$;

create or replace function public.public_platform_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with open as (
    select o.id, o.region, o.department_code, o.published_at, o.created_at
    from public.opportunities o
    where o.status = 'PUBLISHED' and o.visibility = 'PUBLIC' and not o.is_demo
      and (o.response_deadline is null or o.response_deadline > now())
  ), members as (
    select u.created_at from public.users u
    join auth.users au on au.id = u.id and au.email_confirmed_at is not null
    where u.status = 'ACTIVE' and not u.is_demo and not u.is_internal
  )
  select jsonb_build_object(
    'active', (select count(*) from open),
    -- Ajoutées sur LinkProB2B (collecte ou publication) au cours des dernières 24 h / 7 jours
    'new_24h', (select count(*) from open where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from open where created_at > now() - interval '7 days'),
    'regions', (select count(distinct region) from open where region is not null),
    'departments', (select count(distinct department_code) from open where department_code is not null),
    'last_sync_at', (select max(last_success_at) from public.external_sources where status = 'APPROVED' and is_active),
    'sources', (select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from public.external_sources
                where status = 'APPROVED' and is_active and connector <> 'manual'),
    'companies', (select count(*) from public.companies c join public.company_profiles p on p.company_id = c.id
                  where c.status = 'ACTIVE' and not c.is_demo and not c.is_internal and p.is_public),
    -- Inscrits (adresse confirmée, compte actif) et entreprises inscrites : des nombres, jamais de noms
    'members', (select count(*) from members),
    'members_7d', (select count(*) from members where created_at > now() - interval '7 days'),
    'members_30d', (select count(*) from members where created_at > now() - interval '30 days'),
    'registered_companies', (select count(*) from public.companies c where c.status = 'ACTIVE' and not c.is_demo and not c.is_internal)
  );
$$;

-- Inscriptions de l'audience : hors comptes internes
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
$$;
