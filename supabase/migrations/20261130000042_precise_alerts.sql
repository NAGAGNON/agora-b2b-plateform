-- Alertes précises (au choix, en plus de l'alerte simple) : plusieurs métiers et départements, mots
-- à exclure, acheteurs ciblés, budget minimum, délai minimum pour répondre, codes CPV.
alter table public.alerts
  add column if not exists extra_sectors text[] not null default '{}',
  add column if not exists extra_departments text[] not null default '{}',
  add column if not exists exclude_keywords text,
  add column if not exists buyer_terms text[] not null default '{}',
  add column if not exists min_budget numeric,
  add column if not exists min_days_left int check (min_days_left is null or min_days_left between 0 and 120),
  add column if not exists cpv_prefixes text[] not null default '{}';

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
      -- Métiers : celui de l'alerte et les métiers ajoutés (alerte précise) ; les mots de compétence priment
      and ((a.sector_slug is null and cardinality(a.extra_sectors) = 0)
           or o.sector_slug = a.sector_slug or o.sector_slug = any(a.extra_sectors) or cardinality(a.match_terms) > 0)
      -- Un mot du descriptif ne compte que si l'offre est d'un métier de l'alerte (sinon : intitulé ou résumé)
      and (cardinality(a.match_terms) = 0 or public.terms_match(a.match_terms, o.title, o.summary,
           case when (a.sector_slug is null and cardinality(a.extra_sectors) = 0) or a.sector_slug = o.sector_slug or o.sector_slug = any(a.extra_sectors) then o.description end))
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

-- Nombre d'offres ouvertes correspondant aujourd'hui à une alerte (propriétaire seulement) : pour
-- vérifier que les critères ne sont ni trop larges ni trop stricts.
create or replace function public.alert_open_matches(p_alert_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.alerts a where a.id = p_alert_id and a.user_id = (select auth.uid()))
    then (select count(*)::int from public.opportunities o
           where o.status = 'PUBLISHED' and not o.is_demo
             and (o.response_deadline is null or o.response_deadline > now())
             and public.opportunity_matches_alert(o.id, p_alert_id))
    else 0 end;
$$;
revoke all on function public.alert_open_matches(uuid) from public, anon;
grant execute on function public.alert_open_matches(uuid) to authenticated;

-- Droits par colonne (comme les autres critères d'alerte)
grant insert (extra_sectors, extra_departments, exclude_keywords, buyer_terms, min_budget, min_days_left, cpv_prefixes),
  update (extra_sectors, extra_departments, exclude_keywords, buyer_terms, min_budget, min_days_left, cpv_prefixes)
  on public.alerts to authenticated;
grant select (extra_sectors, extra_departments, exclude_keywords, buyer_terms, min_budget, min_days_left, cpv_prefixes) on public.alerts to authenticated;
