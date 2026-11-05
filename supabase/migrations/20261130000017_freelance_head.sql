-- Missions freelance : intitulé + résumé déjà normalisés (sans accents ni ponctuation), calculés une
-- fois à l'écriture, pour que la recherche sur tous les métiers tienne dans le délai d'un visiteur (3 s).
alter table public.opportunities
  add column if not exists search_head text
  generated always as (' ' || regexp_replace(public.fold_text(coalesce(title, '') || ' ' || coalesce(summary, '')), '[^a-z0-9#+'' -]+', ' ', 'g') || ' ') stored;

-- Lecture publique uniquement (annonces publiées, visibles de tous) : exécutée avec les droits du
-- propriétaire pour éviter le coût des règles d'accès ligne par ligne.
create or replace function public.freelance_offers(p_terms text[], p_limit int default 24, p_offset int default 0, p_include_demo boolean default false, p_all_missions boolean default true)
returns table (
  id uuid, title text, summary text, type public.opportunity_type, origin public.opportunity_origin,
  sector_slug text, city text, department_code text, region text, response_deadline timestamptz,
  published_at timestamptz, buyer text, is_mission boolean, total_count bigint
) language sql stable security definer set search_path = '' as $$
  with pat as (select public.terms_pattern(p_terms, false) as p),
  hits as (
    select o.id, o.title, o.summary, o.type, o.origin, o.sector_slug, o.city, o.department_code, o.region,
           o.response_deadline, o.published_at, o.company_id, o.external_buyer_name,
           (o.type::text = 'MISSION') as mission
      from public.opportunities o, pat
     where o.status = 'PUBLISHED'
       and o.visibility = 'PUBLIC'
       and (o.response_deadline is null or o.response_deadline >= now())
       and (p_include_demo or not o.is_demo)
       and ((o.type::text = 'MISSION' and p_all_missions) or (pat.p is not null and o.search_head ~ pat.p))
  )
  select h.id, h.title, h.summary, h.type, h.origin, h.sector_slug, h.city, h.department_code, h.region,
         h.response_deadline, h.published_at,
         coalesce(c.name, h.external_buyer_name) as buyer, h.mission, count(*) over () as total_count
    from hits h
    left join public.companies c on c.id = h.company_id
   order by h.mission desc, h.published_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 24), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;
revoke all on function public.freelance_offers(text[], int, int, boolean, boolean) from public;
grant execute on function public.freelance_offers(text[], int, int, boolean, boolean) to anon, authenticated, service_role;
