-- =============================================================================
-- Couverture nationale : collecte France entière, recherche par région / ville /
-- code postal / source, alertes et recommandations par région, statistiques.
-- Aucune donnée supprimée : les opportunités existantes (Bretagne) sont conservées.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sources : suppression des filtres géographiques bretons (les autres réglages
-- choisis en administration sont conservés) et volumes adaptés au national.
-- -----------------------------------------------------------------------------
update public.external_sources
set config = (coalesce(config, '{}'::jsonb) - 'departments')
  || jsonb_build_object('maxRecords', greatest(coalesce((config ->> 'maxRecords')::int, 0), 6000), 'lookbackDays', 14)
where code = 'boamp';

update public.external_sources
set config = (coalesce(config, '{}'::jsonb) - 'nuts')
  || jsonb_build_object('country', 'FRA', 'maxRecords', greatest(coalesce((config ->> 'maxRecords')::int, 0), 2000), 'lookbackDays', 14)
where code = 'ted';

-- Collecte nationale immédiate (au déploiement) sur la fenêtre initiale de 14 jours
update public.external_sources set next_sync_at = now(), last_success_at = null where code in ('boamp', 'ted');

-- -----------------------------------------------------------------------------
-- Référentiel des villes : population (tri, import des communes officielles)
-- -----------------------------------------------------------------------------
alter table public.places add column if not exists population int;
alter table public.places add column if not exists insee_code text;
create unique index if not exists places_insee_idx on public.places (insee_code) where insee_code is not null;
create index if not exists places_department_idx on public.places (department_code);

-- Région renseignée pour les opportunités existantes (déduite du département)
update public.opportunities o set region = d.region
from public.departments d
where o.region is null and o.department_code = d.code;

-- -----------------------------------------------------------------------------
-- Index pour un volume national (dizaines de milliers d'opportunités)
-- -----------------------------------------------------------------------------
create index if not exists opportunities_region_idx on public.opportunities (region);
create index if not exists opportunities_postal_idx on public.opportunities (postal_code);
create index if not exists opportunities_open_idx on public.opportunities (published_at desc) where status = 'PUBLISHED';
create index if not exists opportunities_external_ref_idx on public.opportunities (external_reference) where external_reference is not null;
create index if not exists opportunities_origin_deadline_idx on public.opportunities (origin, response_deadline);
create index if not exists opportunity_sources_opp_idx on public.opportunity_sources (opportunity_id, is_primary);

-- -----------------------------------------------------------------------------
-- Recherche nationale : filtres région, ville / code postal, source.
-- La source affichée n'est calculée que pour la page demandée.
-- -----------------------------------------------------------------------------
-- Comparaison de noms de villes sans accents ni casse (sans extension requise)
create or replace function public.unaccent_simple(p text)
returns text language sql immutable set search_path = '' as $$
  select translate(coalesce(p, ''),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ''’-',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY   ');
$$;

drop function if exists public.search_opportunities(text, text, text, text, int, public.opportunity_type[], text, public.opportunity_origin, date, date, public.company_size, text[], text, int, int, boolean);

create or replace function public.search_opportunities(
  p_q text default null,
  p_sector text default null,
  p_department text default null,
  p_place text default null,
  p_radius_km int default null,
  p_types public.opportunity_type[] default null,
  p_status text default 'OPEN',
  p_origin public.opportunity_origin default null,
  p_published_since date default null,
  p_deadline_before date default null,
  p_company_size public.company_size default null,
  p_skills text[] default null,
  p_sort text default 'recent',
  p_limit int default 12,
  p_offset int default 0,
  p_include_demo boolean default true,
  p_region text default null,
  p_city text default null,
  p_source text default null
) returns table (
  id uuid, title text, summary text, type public.opportunity_type, origin public.opportunity_origin,
  status public.opportunity_status, effective_status text, visibility public.opportunity_visibility,
  sector_slug text, city text, department_code text, budget_min numeric, budget_max numeric,
  budget_visible boolean, response_deadline timestamptz, published_at timestamptz, skills text[],
  company_id uuid, company_name text, company_slug text, company_verified boolean,
  external_buyer_name text, source_name text, is_demo boolean, distance_km double precision,
  rank real, total_count bigint, region text
) language sql stable security invoker set search_path = '' as $$
  with center as (
    select p.lat, p.lng from public.places p where p.slug = p_place limit 1
  ),
  q as (
    select case when coalesce(trim(p_q), '') = '' then null
                else websearch_to_tsquery('french', p_q) end as tsq
  ),
  src_filter as (
    select es.id from public.external_sources es where p_source is not null and es.code = p_source
  ),
  base as (
    select o.*,
      case
        when o.status = 'PUBLISHED' and o.response_deadline is not null and o.response_deadline < now() then 'EXPIRED'
        else o.status::text
      end as eff_status,
      case when (select lat from center) is not null and o.lat is not null then
        6371 * 2 * asin(sqrt(
          power(sin(radians(o.lat - (select lat from center)) / 2), 2) +
          cos(radians((select lat from center))) * cos(radians(o.lat)) *
          power(sin(radians(o.lng - (select lng from center)) / 2), 2)
        ))
      end as dist
    from public.opportunities o
    where o.status in ('PUBLISHED', 'CLOSED', 'EXPIRED')
      and (p_include_demo or not o.is_demo)
      and (p_region is null or o.region = p_region)
      and (p_department is null or o.department_code = p_department)
      and (p_sector is null or o.sector_slug = p_sector)
  ),
  filtered as (
    select b.*, c.name as c_name, c.slug as c_slug, (c.verified_at is not null) as c_verified, c.size as c_size,
      case when (select tsq from q) is null then 0 else ts_rank(b.search_vector, (select tsq from q)) end as rnk
    from base b
    left join public.companies c on c.id = b.company_id
    where (b.company_id is null or c.id is not null)
      and ((select tsq from q) is null or b.search_vector @@ (select tsq from q))
      and (p_types is null or cardinality(p_types) = 0 or b.type = any (p_types))
      and (p_origin is null or b.origin = p_origin)
      and (p_published_since is null or b.published_at >= p_published_since)
      and (p_deadline_before is null or b.response_deadline <= (p_deadline_before + 1))
      and (p_company_size is null or b.target_company_size = p_company_size or c.size = p_company_size)
      and (p_skills is null or cardinality(p_skills) = 0 or b.skills && p_skills)
      and (
        p_status is null or p_status = 'ALL'
        or (p_status = 'OPEN' and b.eff_status = 'PUBLISHED')
        or (p_status = 'CLOSED' and b.eff_status in ('CLOSED', 'EXPIRED'))
      )
      and (p_radius_km is null or (select lat from center) is null or (b.dist is not null and b.dist <= p_radius_km))
      and (p_city is null or trim(p_city) = ''
           or b.postal_code like (trim(p_city) || '%')
           or lower(public.unaccent_simple(b.city)) = lower(public.unaccent_simple(trim(p_city))))
      and (p_source is null or exists (
        select 1 from public.opportunity_sources os where os.opportunity_id = b.id and os.source_id in (select id from src_filter)))
  ),
  page as (
    select f.*, count(*) over () as total
    from filtered f
    order by
      case when p_sort = 'relevance' then f.rnk end desc nulls last,
      case when p_sort = 'deadline' then f.response_deadline end asc nulls last,
      case when p_sort = 'distance' then f.dist end asc nulls last,
      f.published_at desc nulls last,
      f.id
    limit least(greatest(coalesce(p_limit, 12), 1), 50)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select f.id, f.title, f.summary, f.type, f.origin, f.status, f.eff_status, f.visibility, f.sector_slug, f.city,
    f.department_code,
    case when f.budget_visible then f.budget_min end, case when f.budget_visible then f.budget_max end,
    f.budget_visible, f.response_deadline, f.published_at, f.skills, f.company_id, f.c_name, f.c_slug,
    coalesce(f.c_verified, false), f.external_buyer_name, src.name, f.is_demo, f.dist, f.rnk,
    f.total, f.region
  from page f
  left join lateral (
    select es.name from public.opportunity_sources os
    join public.external_sources es on es.id = os.source_id
    where os.opportunity_id = f.id
    order by os.is_primary desc, os.imported_at
    limit 1
  ) src on true
  order by
    case when p_sort = 'relevance' then f.rnk end desc nulls last,
    case when p_sort = 'deadline' then f.response_deadline end asc nulls last,
    case when p_sort = 'distance' then f.dist end asc nulls last,
    f.published_at desc nulls last,
    f.id;
$$;

-- -----------------------------------------------------------------------------
-- Alertes : région
-- -----------------------------------------------------------------------------
alter table public.alerts add column if not exists region text;
grant insert (region), update (region) on public.alerts to authenticated;

create or replace function public.opportunity_matches_alert(p_opportunity_id uuid, p_alert_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o
    cross join public.alerts a
    left join public.places pl on pl.slug = a.place_slug
    where o.id = p_opportunity_id and a.id = p_alert_id
      and o.status = 'PUBLISHED'
      and (o.response_deadline is null or o.response_deadline > now())
      and not o.is_demo
      and (a.include_external or o.origin = 'INTERNAL')
      and (a.sector_slug is null or a.sector_slug = o.sector_slug)
      and (a.region is null or a.region = o.region)
      and (a.department_code is null or a.department_code = o.department_code)
      and (a.type is null or a.type = o.type)
      and (a.company_size is null or o.target_company_size is null or o.target_company_size = a.company_size)
      and (cardinality(a.skills) = 0 or o.skills && a.skills
           or exists (select 1 from unnest(a.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)))
      and (pl.id is null or a.radius_km is null
           or (o.lat is not null and public.distance_km(pl.lat, pl.lng, o.lat, o.lng) <= a.radius_km))
      and (a.keywords is null or trim(a.keywords) = '' or o.search_vector @@ websearch_to_tsquery('french', a.keywords))
  );
$$;

-- -----------------------------------------------------------------------------
-- Recommandations : la région de l'entreprise compte aussi (hors de la zone d'intervention)
-- -----------------------------------------------------------------------------
create or replace function public.recommended_opportunities(p_company_id uuid, p_limit int default 6, p_include_demo boolean default true)
returns table (id uuid, title text, type public.opportunity_type, origin public.opportunity_origin,
  sector_slug text, city text, response_deadline timestamptz, published_at timestamptz, is_demo boolean,
  score int, reasons text[])
language sql stable security invoker set search_path = '' as $$
  with me as (
    select c.department_code, c.lat, c.lng, c.size, p.sectors, p.skills,
      coalesce(p.intervention_radius_km, 80) as radius,
      (select d.region from public.departments d where d.code = c.department_code) as region
    from public.companies c join public.company_profiles p on p.company_id = c.id
    where c.id = p_company_id and public.is_company_member(p_company_id)
  ),
  history as (
    select array_agg(distinct o.sector_slug) filter (where o.sector_slug is not null) as sectors
    from public.opportunities o
    where o.id in (
      select f.opportunity_id from public.favorites f where f.user_id = auth.uid() and f.opportunity_id is not null
      union select i.opportunity_id from public.interests i where i.company_id = p_company_id
      union select pi.opportunity_id from public.pipeline_items pi where pi.company_id = p_company_id
    )
  ),
  scored as (
    select o.*,
      (o.sector_slug = any (me.sectors)) as m_sector,
      (o.department_code = me.department_code) as m_dept,
      (me.region is not null and o.region = me.region) as m_region,
      (me.lat is not null and o.lat is not null and public.distance_km(me.lat, me.lng, o.lat, o.lng) <= me.radius) as m_zone,
      coalesce(cardinality(array(select unnest(o.skills) intersect select unnest(me.skills))), 0) as n_skills,
      exists (select 1 from unnest(me.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)) as m_keywords,
      (o.sector_slug = any (coalesce((select sectors from history), '{}'))) as m_history,
      (o.target_company_size is not null and o.target_company_size = me.size) as m_size
    from public.opportunities o, me
    where o.status = 'PUBLISHED'
      and (p_include_demo or not o.is_demo)
      and (o.response_deadline is null or o.response_deadline > now())
      and (o.company_id is null or o.company_id <> p_company_id)
      and not exists (select 1 from public.interests i where i.opportunity_id = o.id and i.company_id = p_company_id)
  )
  select s.id, s.title, s.type, s.origin, s.sector_slug, s.city, s.response_deadline, s.published_at, s.is_demo,
    (case when s.m_sector then 30 else 0 end
     + case when s.m_zone then 25 when s.m_dept then 15 when s.m_region then 8 else 0 end
     + least(s.n_skills * 10, 30)
     + case when s.m_keywords and s.n_skills = 0 then 10 else 0 end
     + case when s.m_history then 10 else 0 end
     + case when s.m_size then 5 else 0 end)::int as score,
    array_remove(array[
      case when s.m_sector then 'Votre secteur' end,
      case when s.m_zone then 'Dans votre zone d''intervention' when s.m_dept then 'Votre département' when s.m_region then 'Votre région' end,
      case when s.n_skills > 0 then s.n_skills || ' compétence(s) commune(s)' end,
      case when s.m_keywords and s.n_skills = 0 then 'Mots-clés de vos compétences' end,
      case when s.m_history then 'Proche de vos favoris et intérêts' end,
      case when s.m_size then 'Taille d''entreprise visée' end
    ], null) as reasons
  from scored s
  where s.m_sector or s.m_dept or s.m_zone or s.n_skills > 0 or s.m_keywords
  order by score desc, s.published_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 30);
$$;

-- -----------------------------------------------------------------------------
-- Statistiques publiques (pages régions / départements / secteurs) et d'administration
-- -----------------------------------------------------------------------------
-- Nombre d'opportunités ouvertes par région, département et secteur (pages SEO, sitemap).
create or replace function public.open_opportunity_counts()
returns table (dimension text, key text, n bigint)
language sql stable security definer set search_path = '' as $$
  with open as (
    select region, department_code, sector_slug from public.opportunities
    where status = 'PUBLISHED' and not is_demo and (response_deadline is null or response_deadline > now())
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
grant execute on function public.open_opportunity_counts() to anon, authenticated;

create or replace function public.admin_opportunity_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  return (
    with o as (
      select id, status, region, department_code, sector_slug, origin, published_at, created_at, updated_at, response_deadline, is_demo
      from public.opportunities where not is_demo
    ),
    active as (select * from o where status = 'PUBLISHED' and (response_deadline is null or response_deadline > now())),
    runs as (select * from public.source_sync_runs where started_at > now() - interval '7 days')
    select jsonb_build_object(
      'total', (select count(*) from o),
      'active', (select count(*) from active),
      'expired', (select count(*) from o where status = 'EXPIRED' or (status = 'PUBLISHED' and response_deadline <= now())),
      'external', (select count(*) from o where origin = 'EXTERNAL'),
      'internal', (select count(*) from o where origin = 'INTERNAL'),
      'new_24h', (select count(*) from o where created_at > now() - interval '24 hours'),
      'new_7d', (select count(*) from o where created_at > now() - interval '7 days'),
      'updated_7d', (select coalesce(sum(updated), 0) from runs),
      'duplicates_7d', (select coalesce(sum(duplicates), 0) from runs),
      'errors_7d', (select count(*) from runs where status in ('FAILED', 'PARTIAL')),
      'without_location', (select count(*) from active where region is null),
      'by_region', (select coalesce(jsonb_agg(jsonb_build_object('key', region, 'n', n) order by n desc), '[]') from (select region, count(*) n from active where region is not null group by region) x),
      'by_department', (select coalesce(jsonb_agg(jsonb_build_object('key', department_code, 'n', n) order by n desc), '[]') from (select department_code, count(*) n from active where department_code is not null group by department_code order by count(*) desc limit 25) x),
      'by_sector', (select coalesce(jsonb_agg(jsonb_build_object('key', sector_slug, 'n', n) order by n desc), '[]') from (select coalesce(sector_slug, '(non classé)') sector_slug, count(*) n from active group by 1) x),
      'by_source', (select coalesce(jsonb_agg(jsonb_build_object('key', name, 'n', n) order by n desc), '[]') from (
          select es.name, count(*) n from active a join public.opportunity_sources os on os.opportunity_id = a.id join public.external_sources es on es.id = os.source_id
          group by es.name) x),
      'next_sync_at', (select min(next_sync_at) from public.external_sources where is_active and status = 'APPROVED' and connector <> 'manual')
    )
  );
end;
$$;
revoke execute on function public.admin_opportunity_overview() from public, anon;
grant execute on function public.admin_opportunity_overview() to authenticated;
