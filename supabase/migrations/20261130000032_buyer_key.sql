-- Pages acheteurs : l'adresse de chaque acheteur était recalculée sur toutes les opportunités à chaque
-- affichage (~0,8 s, des milliers d'appels par jour par les moteurs de recherche) et saturait la base.
-- Elle est désormais calculée une fois, à l'écriture, et indexée.
alter table public.opportunities
  add column if not exists buyer_key text generated always as (public.buyer_slug(external_buyer_name)) stored;
create index if not exists opportunities_buyer_key_idx on public.opportunities (buyer_key) where buyer_key is not null;

create or replace function public.buyer_opportunities(p_slug text, p_limit integer default 100)
returns table(id uuid, title text, city text, department_code text, region text, sector_slug text, response_deadline timestamptz,
              published_at timestamptz, is_open boolean, buyer_name text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.title, o.city, o.department_code, o.region, o.sector_slug, o.response_deadline, o.published_at,
         (o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline > now())) as is_open,
         o.external_buyer_name
  from public.opportunities o
  where o.buyer_key = p_slug
    and not o.is_demo and o.visibility = 'PUBLIC'
    and o.status in ('PUBLISHED', 'EXPIRED', 'CLOSED')
  order by (o.status = 'PUBLISHED' and (o.response_deadline is null or o.response_deadline > now())) desc,
           o.published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;

create or replace function public.public_buyers(p_limit integer default 5000, p_offset integer default 0)
returns table(name text, slug text, open_count bigint, total_count bigint, region text, last_published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with o as (
    select buyer_key as slug, external_buyer_name as name, region, published_at,
           (response_deadline is null or response_deadline > now()) and status = 'PUBLISHED' as is_open
    from public.opportunities
    where buyer_key is not null and not is_demo and visibility = 'PUBLIC'
      and status in ('PUBLISHED', 'EXPIRED', 'CLOSED')
  )
  select (array_agg(name order by published_at desc nulls last))[1],
         slug,
         count(*) filter (where is_open),
         count(*),
         (array_agg(region order by published_at desc nulls last) filter (where region is not null))[1],
         max(published_at)
  from o
  group by slug
  having count(*) filter (where is_open) > 0
  order by count(*) filter (where is_open) desc, max(published_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 5000), 20000)) offset greatest(0, coalesce(p_offset, 0));
$$;
