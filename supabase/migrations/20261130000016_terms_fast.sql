-- Recherche par mots du métier : un seul motif (alternative) au lieu d'un passage par mot.
-- Même règle : mot seul dans l'intitulé ou le résumé ; expression aussi dans le descriptif.

create or replace function public.terms_pattern(p_terms text[], p_phrases boolean)
returns text language sql immutable parallel safe set search_path = '' as $$
  select '[^a-z0-9](' || string_agg(regexp_replace(trim(t), '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '|') || ')(s|x)?[^a-z0-9]'
    from unnest(coalesce(p_terms, '{}')) t
   where length(trim(t)) >= 2
     and (case when p_phrases then position(' ' in trim(t)) > 0 or position('-' in trim(t)) > 0 else true end)
$$;

create or replace function public.terms_match(p_terms text[], p_title text, p_summary text, p_description text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  with t as (
    select ' ' || regexp_replace(public.fold_text(coalesce(p_title, '') || ' ' || coalesce(p_summary, '')), '[^a-z0-9#+'' -]+', ' ', 'g') || ' ' as head,
           case when p_description is null then null
                else ' ' || regexp_replace(public.fold_text(left(p_description, 6000)), '[^a-z0-9#+'' -]+', ' ', 'g') || ' ' end as body,
           public.terms_pattern(p_terms, false) as all_terms,
           public.terms_pattern(p_terms, true) as phrases
  )
  select coalesce(t.all_terms is not null and t.head ~ t.all_terms, false)
      or coalesce(t.phrases is not null and t.body is not null and t.body ~ t.phrases, false)
    from t
$$;

create or replace function public.freelance_offers(p_terms text[], p_limit int default 24, p_offset int default 0, p_include_demo boolean default false, p_all_missions boolean default true)
returns table (
  id uuid, title text, summary text, type public.opportunity_type, origin public.opportunity_origin,
  sector_slug text, city text, department_code text, region text, response_deadline timestamptz,
  published_at timestamptz, buyer text, is_mission boolean, total_count bigint
) language sql stable security invoker set search_path = '' as $$
  with pat as (select public.terms_pattern(p_terms, false) as p),
  cand as (
    select o.*, (o.type::text = 'MISSION') as mission
      from public.opportunities o
     where o.status = 'PUBLISHED'
       and (o.response_deadline is null or o.response_deadline >= now())
       and (p_include_demo or not o.is_demo)
  ),
  hits as (
    select x.* from cand x, pat
     where (x.mission and p_all_missions)
        or (pat.p is not null
            and (' ' || regexp_replace(public.fold_text(coalesce(x.title, '') || ' ' || coalesce(x.summary, '')), '[^a-z0-9#+'' -]+', ' ', 'g') || ' ') ~ pat.p)
  )
  select h.id, h.title, h.summary, h.type, h.origin, h.sector_slug, h.city, h.department_code, h.region,
         h.response_deadline, h.published_at,
         coalesce(c.name, h.external_buyer_name) as buyer, h.mission, count(*) over () as total_count
    from hits h
    left join public.companies c on c.id = h.company_id
   order by h.mission desc, h.published_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 24), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;
