-- Alertes par compétences (ciblage précis) : mots du métier (catalogue ou saisie précise) recherchés
-- sans tenir compte des accents. Un mot seul doit figurer dans l'intitulé ou le résumé de l'offre ;
-- une expression (plusieurs mots) peut figurer aussi dans le descriptif d'une offre du même secteur. Quand une alerte a des mots
-- de compétence, le secteur choisi n'est plus exigé (il est parfois mal choisi à l'inscription).

create or replace function public.fold_text(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(translate(replace(replace(replace(replace(coalesce(p, ''), 'œ', 'oe'), 'Œ', 'oe'), 'æ', 'ae'), '’', ''''),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ',
    'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy'))
$$;

create or replace function public.terms_match(p_terms text[], p_title text, p_summary text, p_description text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  with t as (
    select ' ' || regexp_replace(public.fold_text(coalesce(p_title, '') || ' ' || coalesce(p_summary, '')), '[^a-z0-9#+'' -]+', ' ', 'g') || ' ' as head,
           ' ' || regexp_replace(public.fold_text(left(coalesce(p_description, ''), 6000)), '[^a-z0-9#+'' -]+', ' ', 'g') || ' ' as body
  )
  select exists (
    select 1 from t, unnest(coalesce(p_terms, '{}')) term
    where length(trim(term)) >= 2
      and (case when position(' ' in trim(term)) > 0 or position('-' in trim(term)) > 0 then t.head || t.body else t.head end)
          ~ ('[^a-z0-9]' || regexp_replace(trim(term), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '(s|x)?[^a-z0-9]')
  )
$$;

alter table public.alerts add column if not exists match_terms text[] not null default '{}';

create or replace function public.opportunity_matches_alert(p_opportunity_id uuid, p_alert_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o
    cross join public.alerts a
    left join public.places pl on pl.slug = a.place_slug
    where o.id = p_opportunity_id and a.id = p_alert_id
      and o.status = 'PUBLISHED'
      and (o.response_deadline is null or o.response_deadline > now())
      and not o.is_demo
      and (a.include_external or o.origin = 'INTERNAL')
      -- Mots de compétence : ils priment sur le secteur choisi
      and (a.sector_slug is null or a.sector_slug = o.sector_slug or cardinality(a.match_terms) > 0)
      -- Un mot du descriptif ne compte que si l'offre est du même secteur que l'alerte (sinon : intitulé ou résumé)
      and (cardinality(a.match_terms) = 0 or public.terms_match(a.match_terms, o.title, o.summary,
           case when a.sector_slug is null or a.sector_slug = o.sector_slug then o.description end))
      and (a.region is null or a.region = o.region)
      and (a.department_code is null or a.department_code = o.department_code)
      and (a.type is null or a.type = o.type)
      and (a.company_size is null or o.target_company_size is null or o.target_company_size = a.company_size)
      and (cardinality(a.skills) = 0 or o.skills && a.skills
           or exists (select 1 from unnest(a.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)))
      and (pl.id is null or a.radius_km is null
           or (o.lat is not null and public.distance_km(pl.lat, pl.lng, o.lat, o.lng) <= a.radius_km))
      and (a.keywords is null or trim(a.keywords) = '' or o.search_vector @@ websearch_to_tsquery('french', a.keywords))
  );
$$;
