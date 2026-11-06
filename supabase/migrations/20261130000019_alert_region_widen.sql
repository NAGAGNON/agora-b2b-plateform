-- Alertes d'un département où le métier publie peu (moins d'une offre par semaine) : élargies
-- automatiquement à la région, en gardant exactement le même métier (secteur, mots du métier,
-- type…). Sans cela, l'inscrit ne reçoit presque rien et oublie le site. Le nom de l'alerte le dit.
alter table public.alerts add column if not exists widen_region text;

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
      -- Département, ou toute sa région quand l'alerte a été élargie (département trop peu actif)
      and (a.department_code is null or a.department_code = o.department_code or (a.widen_region is not null and o.region = a.widen_region))
      and (a.type is null or a.type = o.type)
      and (a.company_size is null or o.target_company_size is null or o.target_company_size = a.company_size)
      and (cardinality(a.skills) = 0 or o.skills && a.skills
           or exists (select 1 from unnest(a.skills) sk where o.search_vector @@ plainto_tsquery('french', sk)))
      and (pl.id is null or a.radius_km is null
           or (o.lat is not null and public.distance_km(pl.lat, pl.lng, o.lat, o.lng) <= a.radius_km))
      and (a.keywords is null or trim(a.keywords) = '' or o.search_vector @@ websearch_to_tsquery('french', a.keywords))
  );
$$;

-- Passage quotidien : alertes actives d'un département sans rayon autour d'une ville, encore non
-- élargies, qui auraient reçu moins de 4 offres sur les 28 derniers jours.
create or replace function public.widen_sparse_alerts()
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; hits int;
begin
  for r in
    select a.id, a.name, a.department_code, d.region
      from public.alerts a join public.departments d on d.code = a.department_code
     where a.is_active and a.widen_region is null and a.region is null and a.place_slug is null
       and a.created_at < now() - interval '1 hour'
  loop
    select count(*) into hits
      from public.opportunities o
     where o.department_code = r.department_code
       and o.status = 'PUBLISHED' and not o.is_demo
       and o.published_at > now() - interval '28 days'
       and public.opportunity_matches_alert(o.id, r.id);
    if hits < 4 then
      update public.alerts
         set widen_region = r.region,
             name = left(r.name || ' + région ' || r.region, 120)
       where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.widen_sparse_alerts() from public, anon, authenticated;
grant execute on function public.widen_sparse_alerts() to service_role;

-- Département modifié par l'inscrit : l'élargissement repart de zéro (réévalué au prochain passage)
create or replace function public.alerts_reset_widen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.department_code is distinct from old.department_code then new.widen_region := null; end if;
  return new;
end;
$$;
drop trigger if exists alerts_reset_widen on public.alerts;
create trigger alerts_reset_widen before update on public.alerts for each row execute function public.alerts_reset_widen();
