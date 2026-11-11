-- Pages acheteurs : les plus visitées depuis Google (« neotoa appel d'offre », « cdc habitat appel
-- d'offre »…). Elles restent listées (annuaire des acheteurs, plan du site) quand leurs marchés se
-- terminent, dès que l'acheteur a au moins 2 annonces enregistrées : historique réel, prochains
-- marchés à suivre par alerte. Sans cela, une page bien classée disparaissait de Google.
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
  having count(*) filter (where is_open) > 0 or count(*) >= 2
  order by count(*) filter (where is_open) desc, max(published_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 5000), 20000)) offset greatest(0, coalesce(p_offset, 0));
$$;
