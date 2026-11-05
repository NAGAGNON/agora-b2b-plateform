-- Indépendants : type « Mission courte » (publié par une entreprise inscrite) et liste des offres
-- ouvertes dans les métiers exercés par des indépendants (mots du métier dans l'intitulé ou le résumé).
alter type public.opportunity_type add value if not exists 'MISSION' after 'NEED';

-- p_all_missions : toutes les missions courtes (vue générale) ; sinon seulement celles du métier demandé.
-- Les missions courtes d'abord, puis les offres des métiers demandés, les plus récentes en premier.
-- (Le nouveau type est comparé en texte : il ne peut pas être utilisé dans la transaction qui le crée.)
create or replace function public.freelance_offers(p_terms text[], p_limit int default 24, p_offset int default 0, p_include_demo boolean default false, p_all_missions boolean default true)
returns table (
  id uuid, title text, summary text, type public.opportunity_type, origin public.opportunity_origin,
  sector_slug text, city text, department_code text, region text, response_deadline timestamptz,
  published_at timestamptz, buyer text, is_mission boolean, total_count bigint
) language sql stable security invoker set search_path = '' as $$
  with cand as (
    select o.*, (o.type::text = 'MISSION') as mission
      from public.opportunities o
     where o.status = 'PUBLISHED'
       and (o.response_deadline is null or o.response_deadline >= now())
       and (p_include_demo or not o.is_demo)
  ),
  hits as (
    select x.* from cand x
     where (x.mission and p_all_missions) or public.terms_match(p_terms, x.title, x.summary, null)
  )
  select h.id, h.title, h.summary, h.type, h.origin, h.sector_slug, h.city, h.department_code, h.region,
         h.response_deadline, h.published_at,
         coalesce(c.name, h.external_buyer_name) as buyer, h.mission, count(*) over () as total_count
    from hits h
    left join public.companies c on c.id = h.company_id
   order by h.mission desc, h.published_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 24), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.freelance_offers(text[], int, int, boolean, boolean) to anon, authenticated;
