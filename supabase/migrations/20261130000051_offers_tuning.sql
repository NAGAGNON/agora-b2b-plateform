-- 1. Offre Gratuite (appliquée seulement après la phase de lancement gratuite) : 5 recherches par JOUR,
--    3 favoris, 20 demandes de contact par mois (environ une par jour ouvré).
update public.plans set features = features || '{"searches_day": 5, "searches_week": null, "favorites": 3, "contact_requests_month": 20}'::jsonb where code = 'FREE';
update public.plans set features = features || '{"searches_day": null}'::jsonb where code in ('PRO', 'BUSINESS');

create or replace function public.count_search()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_day jsonb; v_week jsonb; v_used int; v_plan text;
begin
  if auth.uid() is null then return true; end if;
  v_plan := public.user_plan(auth.uid());
  v_day := public.plan_feature(v_plan, 'searches_day');
  v_week := public.plan_feature(v_plan, 'searches_week');
  if v_day is not null and jsonb_typeof(v_day) <> 'null' then
    select coalesce(sum(searches), 0) into v_used from public.search_usage where user_id = auth.uid() and day = current_date;
    if v_used >= (v_day)::int then return false; end if;
  elsif v_week is not null and jsonb_typeof(v_week) <> 'null' then
    select coalesce(sum(searches), 0) into v_used from public.search_usage where user_id = auth.uid() and day > current_date - 7;
    if v_used >= (v_week)::int then return false; end if;
  else
    return true;
  end if;
  insert into public.search_usage (user_id, day, searches) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set searches = public.search_usage.searches + 1;
  return true;
end;
$$;
revoke all on function public.count_search() from public, anon;
grant execute on function public.count_search() to authenticated;

-- 2. Ciblage « Visibilité » par métier : métiers enregistrés OU codes NAF de ces métiers (la plupart des
--    entreprises de la base n'ont pas de métier enregistré, mais un code NAF)
create or replace function public.boost_prospect_matches(p_targeting jsonb, p_prospect_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.outreach_prospects p
     where p.id = p_prospect_id and p.status = 'ACTIVE' and coalesce(p.email, '') <> '' and p.linkprob2b_company_id is null
       and not exists (select 1 from public.outreach_suppressions s
                        where (s.kind = 'EMAIL' and s.value = lower(p.email)) or (s.kind = 'DOMAIN' and s.value = lower(split_part(p.email, '@', 2)))
                           or (s.kind = 'SIREN' and s.value = p.siren))
       and (jsonb_array_length(coalesce(p_targeting -> 'sectors', '[]')) = 0
            or p.sectors && array(select jsonb_array_elements_text(p_targeting -> 'sectors'))
            or p.naf_code = any(array(select jsonb_array_elements_text(coalesce(p_targeting -> 'nafs', '[]')))))
       and (jsonb_array_length(coalesce(p_targeting -> 'regions', '[]')) = 0
            or p.region = any(array(select jsonb_array_elements_text(p_targeting -> 'regions'))))
       and (jsonb_array_length(coalesce(p_targeting -> 'sizes', '[]')) = 0
            or public.prospect_size(p.size_range, p.is_individual_entrepreneur) = any(array(select jsonb_array_elements_text(p_targeting -> 'sizes'))))
  );
$$;

create or replace function public.boost_audience(p_company_id uuid, p_targeting jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_members int; v_prospects int; t jsonb := coalesce(p_targeting, '{}'::jsonb);
begin
  if not public.is_company_member(p_company_id) then return jsonb_build_object('members', 0, 'prospects', 0); end if;
  select count(*)::int into v_members from public.companies c
   where c.status = 'ACTIVE' and not c.is_demo and c.id <> p_company_id and public.boost_target_matches(t, c.id);
  select count(*)::int into v_prospects from public.outreach_prospects p
   where p.status = 'ACTIVE' and coalesce(p.email, '') <> '' and p.linkprob2b_company_id is null
     and (jsonb_array_length(coalesce(t -> 'sectors', '[]')) = 0
          or p.sectors && array(select jsonb_array_elements_text(t -> 'sectors'))
          or p.naf_code = any(array(select jsonb_array_elements_text(coalesce(t -> 'nafs', '[]')))))
     and (jsonb_array_length(coalesce(t -> 'regions', '[]')) = 0 or p.region = any(array(select jsonb_array_elements_text(t -> 'regions'))))
     and (jsonb_array_length(coalesce(t -> 'sizes', '[]')) = 0
          or public.prospect_size(p.size_range, p.is_individual_entrepreneur) = any(array(select jsonb_array_elements_text(t -> 'sizes'))))
     and not exists (select 1 from public.outreach_suppressions s where (s.kind = 'EMAIL' and s.value = lower(p.email)) or (s.kind = 'SIREN' and s.value = p.siren));
  return jsonb_build_object('members', v_members, 'prospects', v_prospects);
end;
$$;
revoke all on function public.boost_audience(uuid, jsonb) from public, anon;
grant execute on function public.boost_audience(uuid, jsonb) to authenticated;

-- 3. Taille réelle de la base (argument commercial de l'offre « Visibilité ») : entreprises référencées et
--    entreprises joignables par e-mail. Chiffres seulement, aucune donnée nominative.
create or replace function public.public_prospect_reach()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.outreach_prospects),
    'reachable', (select count(*) from public.outreach_prospects p where p.status = 'ACTIVE' and coalesce(p.email, '') <> '' and p.linkprob2b_company_id is null)
  );
$$;
revoke all on function public.public_prospect_reach() from public;
grant execute on function public.public_prospect_reach() to anon, authenticated;

-- 4. Sélection quotidienne des entreprises de la base (offre « Visibilité ») : conditions directes, pour
--    profiter des index sur les 100 000 entreprises (au lieu d'une fonction appelée pour chacune).
create or replace function public.boost_pick_prospects(p_boost_id uuid, p_limit int, p_min_days int default 7)
returns table (id uuid, email text) language sql stable security definer set search_path = '' as $$
  with b as (select v.targeting as t, v.id, c.region as home from public.visibility_boosts v join public.companies c on c.id = v.company_id where v.id = p_boost_id)
  select p.id, lower(p.email)
    from b, public.outreach_prospects p
   where p.status = 'ACTIVE' and coalesce(p.email, '') <> '' and p.linkprob2b_company_id is null
     and (jsonb_array_length(coalesce(b.t -> 'sectors', '[]')) = 0
          or p.sectors && array(select jsonb_array_elements_text(b.t -> 'sectors'))
          or p.naf_code = any(array(select jsonb_array_elements_text(coalesce(b.t -> 'nafs', '[]')))))
     and (jsonb_array_length(coalesce(b.t -> 'regions', '[]')) = 0 or p.region = any(array(select jsonb_array_elements_text(b.t -> 'regions'))))
     and (jsonb_array_length(coalesce(b.t -> 'sizes', '[]')) = 0
          or public.prospect_size(p.size_range, p.is_individual_entrepreneur) = any(array(select jsonb_array_elements_text(b.t -> 'sizes'))))
     and (p.last_contacted_at is null or p.last_contacted_at < now() - make_interval(days => p_min_days))
     and not exists (select 1 from public.outreach_suppressions s
                      where (s.kind = 'EMAIL' and s.value = lower(p.email)) or (s.kind = 'DOMAIN' and s.value = lower(split_part(p.email, '@', 2)))
                         or (s.kind = 'SIREN' and s.value = p.siren))
     and not exists (select 1 from public.boost_presentations x where x.boost_id = b.id and x.prospect_id = p.id)
     and not exists (select 1 from public.outreach_recipients r where r.prospect_id = p.id and r.status in ('PENDING', 'QUEUED', 'SENDING'))
   order by (p.region is not distinct from b.home) desc, p.last_contacted_at nulls first
   limit greatest(0, least(p_limit, 200));
$$;
revoke all on function public.boost_pick_prospects(uuid, int, int) from public, anon, authenticated;
grant execute on function public.boost_pick_prospects(uuid, int, int) to service_role;
