-- Pages « métier × département » (/opportunites/<région>/<département>/<secteur>) : nombre
-- d'opportunités ouvertes par couple département / secteur, pour n'indexer et ne lier que les
-- pages qui ont un contenu réel. Remplace la fonction en ajoutant la dimension « department_sector ».
create or replace function public.open_opportunity_counts()
returns table (dimension text, key text, n bigint)
language sql stable security definer set search_path = '' as $$
  with open as (
    select region, department_code, sector_slug from public.opportunities
    where status = 'PUBLISHED' and not is_demo and visibility = 'PUBLIC'
      and (company_id is null or public.is_company_active(company_id))
      and (response_deadline is null or response_deadline > now())
  )
  select 'region', region, count(*) from open where region is not null group by region
  union all
  select 'department', department_code, count(*) from open where department_code is not null group by department_code
  union all
  select 'sector', sector_slug, count(*) from open where sector_slug is not null group by sector_slug
  union all
  select 'region_sector', region || '|' || sector_slug, count(*) from open where region is not null and sector_slug is not null group by region, sector_slug
  union all
  select 'department_sector', department_code || '|' || sector_slug, count(*) from open where department_code is not null and sector_slug is not null group by department_code, sector_slug
  union all
  select 'total', null, count(*) from open;
$$;
