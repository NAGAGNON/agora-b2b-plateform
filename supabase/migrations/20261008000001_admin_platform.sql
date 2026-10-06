-- =============================================================================
-- LinkProB2B — Compléments d'administration et d'environnement
-- =============================================================================

-- Vue d'ensemble des réponses pour le personnel : MÉTADONNÉES UNIQUEMENT.
-- Le contenu des réponses (message, prix, documents) reste confidentiel entre
-- le demandeur et le fournisseur ; le personnel n'y a pas accès.
create or replace function public.admin_proposals_overview(p_status public.proposal_status default null, p_limit int default 200)
returns table (
  id uuid, opportunity_id uuid, opportunity_title text, opportunity_status public.opportunity_status,
  buyer_name text, supplier_name text, supplier_slug text, status public.proposal_status,
  submitted_at timestamptz, updated_at timestamptz, documents bigint, is_demo boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id, o.id, o.title, o.status, bc.name, sc.name, sc.slug, p.status, p.submitted_at, p.updated_at,
    (select count(*) from public.proposal_documents d where d.proposal_id = p.id), (o.is_demo or sc.is_demo)
  from public.proposals p
  join public.opportunities o on o.id = p.opportunity_id
  join public.companies sc on sc.id = p.company_id
  left join public.companies bc on bc.id = o.company_id
  where public.is_staff() and (p_status is null or p.status = p_status)
  order by p.submitted_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke execute on function public.admin_proposals_overview(public.proposal_status, int) from public, anon;
grant execute on function public.admin_proposals_overview(public.proposal_status, int) to authenticated;

-- Annuaire : exclusion possible des données de démonstration (production).
drop function if exists public.search_companies(text, text, text, public.company_kind, public.company_size, text[], int, int);
create or replace function public.search_companies(
  p_q text default null,
  p_sector text default null,
  p_department text default null,
  p_kind public.company_kind default null,
  p_size public.company_size default null,
  p_skills text[] default null,
  p_limit int default 12,
  p_offset int default 0,
  p_include_demo boolean default true
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
    and (p_department is null or c.department_code = p_department)
    and (p_kind is null or c.kind = p_kind or c.kind = 'BOTH')
    and (p_size is null or c.size = p_size)
    and (p_skills is null or cardinality(p_skills) = 0 or p.skills && p_skills)
  order by (c.verified_at is not null) desc, c.is_demo asc, c.name
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.search_companies(text, text, text, public.company_kind, public.company_size, text[], int, int, boolean) to anon, authenticated;

-- Visibilité des données de démonstration (hors production), explicite.
update public.platform_settings set value = value || '{"visible": true}'::jsonb where key = 'demo' and not (value ? 'visible');
