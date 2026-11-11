-- Recherche des opportunités : sans tenir compte des accents (« electricite » = « électricité ») et
-- en trouvant les mots en cours de frappe (« mainte » trouve « maintenance »).

-- Index de recherche : forme d'origine + forme sans accents (les recherches existantes restent valables)
create or replace function public.opportunities_search_vector()
returns trigger language plpgsql set search_path = '' as $f$
declare
  t_a text := coalesce(new.title, '');
  t_b1 text := array_to_string(new.skills, ' ') || ' ' || array_to_string(new.keywords, ' ');
  t_b2 text := coalesce(new.summary, '') || ' ' || coalesce(new.external_buyer_name, '') || ' ' || coalesce(new.city, '');
  t_c text := coalesce(new.description, '') || ' ' || coalesce(new.services, '');
begin
  new.search_vector :=
    setweight(to_tsvector('french', t_a), 'A') || setweight(to_tsvector('french', public.unaccent_simple(t_a)), 'A') ||
    setweight(to_tsvector('french', t_b1), 'B') || setweight(to_tsvector('french', public.unaccent_simple(t_b1)), 'B') ||
    setweight(to_tsvector('french', t_b2), 'B') || setweight(to_tsvector('french', public.unaccent_simple(t_b2)), 'B') ||
    setweight(to_tsvector('french', t_c), 'C') || setweight(to_tsvector('french', public.unaccent_simple(t_c)), 'C');
  return new;
end;
$f$;

-- Recalcul de l'index existant, sans déclencher les autres règles (date de mise à jour, notifications)
set session_replication_role = replica;
update public.opportunities o set search_vector =
  setweight(to_tsvector('french', coalesce(o.title, '')), 'A') || setweight(to_tsvector('french', public.unaccent_simple(coalesce(o.title, ''))), 'A') ||
  setweight(to_tsvector('french', array_to_string(o.skills, ' ') || ' ' || array_to_string(o.keywords, ' ')), 'B') ||
  setweight(to_tsvector('french', public.unaccent_simple(array_to_string(o.skills, ' ') || ' ' || array_to_string(o.keywords, ' '))), 'B') ||
  setweight(to_tsvector('french', coalesce(o.summary, '') || ' ' || coalesce(o.external_buyer_name, '') || ' ' || coalesce(o.city, '')), 'B') ||
  setweight(to_tsvector('french', public.unaccent_simple(coalesce(o.summary, '') || ' ' || coalesce(o.external_buyer_name, '') || ' ' || coalesce(o.city, ''))), 'B') ||
  setweight(to_tsvector('french', coalesce(o.description, '') || ' ' || coalesce(o.services, '')), 'C') ||
  setweight(to_tsvector('french', public.unaccent_simple(coalesce(o.description, '') || ' ' || coalesce(o.services, ''))), 'C');
set session_replication_role = origin;

-- Requête de recherche : sans accents ; le dernier mot est aussi cherché comme début de mot
create or replace function public.search_tsquery(p text)
returns tsquery language plpgsql immutable set search_path = '' as $f$
declare
  u text := btrim(public.unaccent_simple(coalesce(p, '')));
  words text[];
  last text;
  head tsquery;
  pre tsquery;
  -- Syntaxe avancée conservée (exclusion « -mot », guillemets) : accents retirés lettre par lettre seulement
  q_full tsquery := websearch_to_tsquery('french', translate(coalesce(p, ''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'));
begin
  words := regexp_split_to_array(u, '\s+');
  last := regexp_replace(words[array_length(words, 1)], '[^[:alnum:]]', '', 'g');
  -- Syntaxe avancée (guillemets, exclusion, « or ») ou mot trop court : recherche exacte seulement
  if coalesce(p, '') ~ '["]' or coalesce(p, '') ~* '(^|\s)(-|or\s)' or length(last) < 3 then
    return q_full;
  end if;
  pre := to_tsquery('french', last || ':*');
  if numnode(pre) = 0 then
    return q_full;
  end if;
  if array_length(words, 1) > 1 then
    head := websearch_to_tsquery('french', array_to_string(words[1:array_length(words, 1) - 1], ' '));
    if numnode(head) > 0 then
      pre := head && pre;
    end if;
  end if;
  return case when numnode(q_full) = 0 then pre else q_full || pre end;
end;
$f$;
grant execute on function public.search_tsquery(text) to anon, authenticated;

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
  rank real, total_count bigint, region text, company_logo_path text
) language sql stable security invoker set search_path = '' as $$
  with center as (
    select p.lat, p.lng from public.places p where p.slug = p_place limit 1
  ),
  q as (
    select case when coalesce(trim(p_q), '') = '' then null
                else public.search_tsquery(p_q) end as tsq
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
      -- Annonces ouvertes (cas le plus fréquent) : l'historique expiré n'est pas parcouru
      and (coalesce(p_status, 'ALL') <> 'OPEN' or (o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline >= now())))
      and (p_include_demo or not o.is_demo)
      and (p_region is null or o.region = p_region)
      and (p_department is null or o.department_code = p_department)
      and (p_sector is null or o.sector_slug = p_sector)
  ),
  filtered as (
    select b.*, c.name as c_name, c.slug as c_slug, c.logo_path as c_logo, (c.verified_at is not null) as c_verified, c.size as c_size,
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
    f.total, f.region, f.c_logo
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
