-- =============================================================================
-- Pages « acheteurs publics » (/acheteurs, /acheteurs/<slug>) : une page par acheteur ayant
-- publié des appels d'offres (communes, départements, hôpitaux…), à partir des seules annonces
-- publiques réelles. Additif : fonctions de lecture et index, aucune donnée modifiée.
-- =============================================================================

create or replace function public.buyer_slug(p text)
returns text language sql immutable set search_path = '' as $$
  -- Adresse lisible, 80 caractères au plus (noms d'acheteurs parfois très longs)
  select nullif(trim(both '-' from left(trim(both '-' from regexp_replace(replace(replace(lower(public.unaccent_simple(trim(coalesce(p, '')))), 'œ', 'oe'), 'æ', 'ae'), '[^a-z0-9]+', '-', 'g')), 80)), '');
$$;

create index if not exists opportunities_buyer_slug_idx on public.opportunities (public.buyer_slug(external_buyer_name))
  where external_buyer_name is not null;

-- Acheteurs avec au moins une annonce ouverte (ou toutes les annonces publiques avec p_all)
create or replace function public.public_buyers(p_limit int default 5000, p_offset int default 0)
returns table (name text, slug text, open_count bigint, total_count bigint, region text, last_published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with o as (
    select public.buyer_slug(external_buyer_name) as slug, external_buyer_name as name, region, published_at,
           (response_deadline is null or response_deadline > now()) and status = 'PUBLISHED' as is_open
    from public.opportunities
    where external_buyer_name is not null and not is_demo and visibility = 'PUBLIC'
      and status in ('PUBLISHED', 'EXPIRED', 'CLOSED')
  )
  select (array_agg(name order by published_at desc nulls last))[1],
         slug,
         count(*) filter (where is_open),
         count(*),
         (array_agg(region order by published_at desc nulls last) filter (where region is not null))[1],
         max(published_at)
  from o
  where slug is not null
  group by slug
  having count(*) filter (where is_open) > 0
  order by count(*) filter (where is_open) desc, max(published_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 5000), 20000)) offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.public_buyers(int, int) to anon, authenticated;

-- Annonces publiques d'un acheteur (ouvertes d'abord, puis les plus récentes)
create or replace function public.buyer_opportunities(p_slug text, p_limit int default 100)
returns table (id uuid, title text, city text, department_code text, region text, sector_slug text,
               response_deadline timestamptz, published_at timestamptz, is_open boolean, buyer_name text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.title, o.city, o.department_code, o.region, o.sector_slug, o.response_deadline, o.published_at,
         (o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline > now())) as is_open,
         o.external_buyer_name
  from public.opportunities o
  where public.buyer_slug(o.external_buyer_name) = p_slug
    and not o.is_demo and o.visibility = 'PUBLIC'
    and o.status in ('PUBLISHED', 'EXPIRED', 'CLOSED')
  order by (o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline > now())) desc,
           o.published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;
grant execute on function public.buyer_opportunities(text, int) to anon, authenticated;
