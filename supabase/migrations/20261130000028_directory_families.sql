-- Annuaire : filtre par famille de métiers (plusieurs secteurs) et nombre d'entreprises par secteur
-- pour les tuiles « Explorer par domaine ». Mêmes règles de visibilité que la recherche.
drop function if exists public.search_companies(text, text, text, public.company_kind, public.company_size, text[], int, int, boolean);
create or replace function public.search_companies(
  p_q text default null,
  p_sector text default null,
  p_department text default null,
  p_kind public.company_kind default null,
  p_size public.company_size default null,
  p_skills text[] default null,
  p_limit int default 12,
  p_offset int default 0,
  p_include_demo boolean default true,
  p_sectors text[] default null
) returns table (
  id uuid, slug text, name text, kind public.company_kind, size public.company_size, city text,
  department_code text, logo_path text, tagline text, sectors text[], skills text[], verified boolean,
  is_demo boolean, total_count bigint
) language sql stable security invoker set search_path = '' as $$
  select c.id, c.slug, c.name, c.kind, c.size, c.city, c.department_code, c.logo_path, p.tagline, p.sectors,
    p.skills, c.verified_at is not null, c.is_demo, count(*) over ()
  from public.companies c
  join public.company_profiles p on p.company_id = c.id
  where c.status = 'ACTIVE' and p.is_public
    and (p_include_demo or not c.is_demo)
    and (coalesce(trim(p_q), '') = '' or p.search_vector @@ websearch_to_tsquery('french', p_q)
         or c.name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%')
    and (p_sector is null or p_sector = any (p.sectors))
    and (p_sectors is null or cardinality(p_sectors) = 0 or p.sectors && p_sectors)
    and (p_department is null or c.department_code = p_department)
    and (p_kind is null or c.kind = p_kind or c.kind = 'BOTH')
    and (p_size is null or c.size = p_size)
    and (p_skills is null or cardinality(p_skills) = 0 or p.skills && p_skills)
  order by (c.verified_at is not null) desc, (c.logo_path is not null) desc, c.is_demo asc, c.name
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.search_companies(text, text, text, public.company_kind, public.company_size, text[], int, int, boolean, text[]) to anon, authenticated;

-- p_families : {"famille": ["secteur", ...]} ; une entreprise compte une fois par famille.
create or replace function public.directory_family_counts(p_families jsonb, p_include_demo boolean default true)
returns table (family text, companies bigint)
language sql stable security invoker set search_path = '' as $$
  select f.key, count(distinct c.id)
  from jsonb_each(coalesce(p_families, '{}'::jsonb)) f
  join public.company_profiles p
    on p.is_public and p.sectors && array(select jsonb_array_elements_text(f.value))
  join public.companies c on c.id = p.company_id
  where c.status = 'ACTIVE' and (p_include_demo or not c.is_demo)
  group by f.key;
$$;
grant execute on function public.directory_family_counts(jsonb, boolean) to anon, authenticated;
