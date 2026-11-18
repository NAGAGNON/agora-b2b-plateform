-- Alertes plus précises : une offre d'un AUTRE métier que celui de l'alerte n'est retenue que sur une
-- expression de plusieurs mots (« transport de marchandises »), jamais sur un mot seul trop courant
-- (« livraison » faisait remonter « Fabrication et livraison des imprimés… » dans une alerte Transport).
-- Dans le métier de l'alerte (ou sans métier choisi), les mots seuls comptent comme avant.
create or replace function public.opportunity_matches_alert(p_opportunity_id uuid, p_alert_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o
    cross join public.alerts a
    left join public.places pl on pl.slug = a.place_slug
    cross join lateral (
      select (a.sector_slug is null and cardinality(a.extra_sectors) = 0)
             or a.sector_slug = o.sector_slug or o.sector_slug = any(a.extra_sectors) as same_trade
    ) t
    where o.id = p_opportunity_id and a.id = p_alert_id
      and o.status = 'PUBLISHED'
      and (o.response_deadline is null or o.response_deadline > now())
      and not o.is_demo
      and (a.include_external or o.origin = 'INTERNAL')
      -- Métiers : celui de l'alerte et les métiers ajoutés (alerte précise) ; les mots de compétence priment
      and (t.same_trade or cardinality(a.match_terms) > 0)
      -- Autre métier : expressions de plusieurs mots seulement, dans l'intitulé ou le résumé ;
      -- même métier : tous les mots, descriptif compris
      and (cardinality(a.match_terms) = 0 or public.terms_match(
             case when t.same_trade then a.match_terms
                  else coalesce((select array_agg(m) from unnest(a.match_terms) m where btrim(m) like '% %'), '{}'::text[]) end,
             o.title, o.summary, case when t.same_trade then o.description end))
      and (a.region is null or a.region = o.region)
      -- Département(s), ou toute la région quand l'alerte a été élargie (département trop peu actif)
      and ((a.department_code is null and cardinality(a.extra_departments) = 0)
           or o.department_code = a.department_code or o.department_code = any(a.extra_departments)
           or (a.widen_region is not null and o.region = a.widen_region))
      and (a.type is null or a.type = o.type)
      and (a.company_size is null or o.target_company_size is null or o.target_company_size = a.company_size)
      and (cardinality(a.skills) = 0 or o.skills && a.skills
           or exists (select 1 from unnest(a.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)))
      and (pl.id is null or a.radius_km is null
           or (o.lat is not null and public.distance_km(pl.lat, pl.lng, o.lat, o.lng) <= a.radius_km))
      and (a.keywords is null or trim(a.keywords) = '' or o.search_vector @@ public.search_tsquery(a.keywords))
      -- Alerte précise
      and (a.exclude_keywords is null or trim(a.exclude_keywords) = '' or not (o.search_vector @@ public.search_tsquery(a.exclude_keywords)))
      and (cardinality(a.buyer_terms) = 0
           or exists (select 1 from unnest(a.buyer_terms) b where lower(public.unaccent_simple(coalesce(o.external_buyer_name, ''))) like '%' || lower(public.unaccent_simple(b)) || '%'))
      -- Budget : les offres sans budget publié restent proposées (beaucoup d'avis ne l'indiquent pas)
      and (a.min_budget is null or o.budget_max is null or o.budget_max >= a.min_budget)
      and (a.min_days_left is null or o.response_deadline is null or o.response_deadline >= now() + make_interval(days => a.min_days_left))
      and (cardinality(a.cpv_prefixes) = 0
           or exists (select 1 from unnest(coalesce(o.cpv_codes, '{}')) c, unnest(a.cpv_prefixes) p where c like p || '%'))
  );
$$;
