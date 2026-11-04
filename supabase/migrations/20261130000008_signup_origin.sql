-- Provenance des inscrits : d'où arrivent vraiment les personnes qui s'inscrivent.
-- page_views.source : étiquette de provenance des liens du site (utm_source des e-mails de prospection,
--   de veille et de suivi), jusqu'ici ignorée — ces visites étaient comptées en « accès direct ».
-- users.signup_visit : identifiant de la visite pendant laquelle le compte a été créé (sans cookie :
--   identifiant de l'onglet), pour retrouver la première page et la provenance de cette visite.
-- Additif : aucune donnée existante modifiée.

alter table public.page_views add column if not exists source text check (source is null or char_length(source) <= 60);
alter table public.users add column if not exists signup_visit uuid;

-- Provenance lisible d'une visite, d'après sa première page (rien n'est deviné au-delà de ce qui est enregistré)
create or replace function public.visit_origin(p_session uuid)
returns text language sql stable security definer set search_path = '' as $$
  with f as (
    select pv.path, pv.referrer_host, pv.source
    from public.page_views pv where pv.session_id = p_session
    order by pv.created_at, pv.id limit 1
  )
  select case
    when p_session is null or not exists (select 1 from f) then 'Inconnue (visite non mesurée)'
    else (select case
      when f.source ilike '%outreach%' then 'Prospection (e-mail)'
      when f.source = 'veille' then 'E-mail de veille'
      when f.source = 'suivi' then 'E-mail de suivi'
      when f.source is not null then 'Lien étiqueté : ' || f.source
      when f.referrer_host ~ '(^|\.)google\.' then 'Google (recherche)'
      when f.referrer_host ~ '(^|\.)(bing|qwant|duckduckgo|ecosia|yahoo|lilo|brave)\.' then 'Autre moteur : ' || f.referrer_host
      when f.referrer_host ~ '(linkedin|lnkd)' then 'LinkedIn'
      when f.referrer_host ~ '(facebook|instagram|whatsapp|t\.co|twitter|x\.com)' then 'Réseau social : ' || f.referrer_host
      when f.referrer_host ~ '(mail|outlook|gm$)' then 'Messagerie : ' || f.referrer_host
      when f.referrer_host is not null then 'Autre site : ' || f.referrer_host
      when f.path = '/' then 'Sans provenance — page d''accueil (adresse tapée, favori, lien d''une application)'
      when f.path like '/inscription%' or f.path like '/connexion%' then 'Sans provenance — lien direct vers l''inscription'
      when f.path ~ '^/(opportunites|acheteurs|analyses|ressources|entreprises)/' then 'Sans provenance — page d''offre ou de secteur (souvent un moteur de recherche)'
      else 'Sans provenance — ' || f.path end from f)
  end;
$$;
revoke all on function public.visit_origin(uuid) from public, anon, authenticated;

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
    where u.created_at >= b.today and u.created_at <= p_now and not u.is_demo
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
revoke all on function public.seo_snapshot(timestamptz) from public, anon, authenticated;
