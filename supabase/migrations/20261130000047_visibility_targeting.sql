-- Offre « Visibilité » : ciblage choisi par l'entreprise (métiers, régions, tailles, type d'entreprise).
-- Les présentations du jour ne vont qu'aux entreprises inscrites qui correspondent à TOUS les critères choisis.
alter table public.visibility_boosts add column if not exists targeting jsonb not null default '{}'::jsonb;

drop function if exists public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric);
create or replace function public.request_visibility_boost(
  p_company_id uuid, p_target text, p_opportunity_id uuid, p_daily int, p_featured_days int, p_duration_days int, p_price_ht numeric,
  p_targeting jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_free boolean := public.free_launch(); v_t jsonb;
begin
  if not public.is_company_admin(p_company_id) then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if p_target = 'NEED' and not exists (
    select 1 from public.opportunities o where o.id = p_opportunity_id and o.company_id = p_company_id and o.status = 'PUBLISHED' and o.origin = 'INTERNAL'
  ) then raise exception 'Besoin introuvable ou non publié' using errcode = 'P0001'; end if;
  -- Ciblage : listes de textes uniquement (au plus 40 valeurs chacune)
  v_t := jsonb_strip_nulls(jsonb_build_object(
    'sectors', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'sectors', '[]')) x limit 40) s),
    'regions', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'regions', '[]')) x limit 40) s),
    'sizes', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'sizes', '[]')) x where x in ('INDEPENDANT', 'TPE', 'PME', 'ETI', 'GE')) s),
    'kinds', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'kinds', '[]')) x where x in ('SUPPLIER', 'BUYER', 'BOTH')) s)
  ));
  insert into public.visibility_boosts (company_id, target, opportunity_id, daily_presentations, featured_days, duration_days, price_ht, free_launch, requested_by, targeting)
  values (p_company_id, p_target, case when p_target = 'NEED' then p_opportunity_id end, p_daily, p_featured_days, p_duration_days,
          case when v_free then 0 else greatest(p_price_ht, 0) end, v_free, auth.uid(), coalesce(v_t, '{}'::jsonb))
  returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'visibility.requested', 'company', p_company_id, jsonb_build_object('boost_id', v_id, 'target', p_target, 'daily', p_daily, 'featured_days', p_featured_days, 'days', p_duration_days, 'targeting', v_t));
  perform public.notify_user(u.id, 'visibility_pending', 'Demande de visibilité à valider', (select name from public.companies where id = p_company_id), '/admin/visibilite', false)
     from public.users u where u.platform_role in ('ADMIN', 'SUPER_ADMIN') and u.status = 'ACTIVE';
  return v_id;
exception when unique_violation then
  raise exception 'Une demande est déjà en cours pour cette cible' using errcode = 'P0001';
end;
$$;
revoke all on function public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric, jsonb) from public, anon;
grant execute on function public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric, jsonb) to authenticated;

-- Entreprise inscrite correspondant au ciblage d'une offre (critère vide = tout le monde)
create or replace function public.boost_target_matches(p_targeting jsonb, p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.companies c left join public.company_profiles cp on cp.company_id = c.id
     where c.id = p_company_id
       and (jsonb_array_length(coalesce(p_targeting -> 'sectors', '[]')) = 0
            or coalesce(cp.sectors, '{}') && array(select jsonb_array_elements_text(p_targeting -> 'sectors')))
       and (jsonb_array_length(coalesce(p_targeting -> 'regions', '[]')) = 0
            or c.region = any(array(select jsonb_array_elements_text(p_targeting -> 'regions'))))
       and (jsonb_array_length(coalesce(p_targeting -> 'sizes', '[]')) = 0
            or c.size::text = any(array(select jsonb_array_elements_text(p_targeting -> 'sizes'))))
       and (jsonb_array_length(coalesce(p_targeting -> 'kinds', '[]')) = 0
            or c.kind::text = any(array(select jsonb_array_elements_text(p_targeting -> 'kinds'))))
  );
$$;
revoke all on function public.boost_target_matches(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.boost_target_matches(jsonb, uuid) to service_role;

-- Nombre d'entreprises inscrites correspondant à un ciblage (aperçu avant la demande ; aucune donnée nominative)
create or replace function public.boost_audience_count(p_company_id uuid, p_targeting jsonb default '{}'::jsonb)
returns int language sql stable security definer set search_path = '' as $$
  select case when public.is_company_member(p_company_id) then (
    select count(*)::int from public.companies c
     where c.status = 'ACTIVE' and not c.is_demo and c.id <> p_company_id and public.boost_target_matches(p_targeting, c.id)
  ) else 0 end;
$$;
revoke all on function public.boost_audience_count(uuid, jsonb) from public, anon;
grant execute on function public.boost_audience_count(uuid, jsonb) to authenticated;

-- Traitement quotidien : comme avant, en ne retenant que les entreprises qui correspondent au ciblage
create or replace function public.process_visibility_boosts(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b record;
  r record;
  v_ended int := 0;
  v_presented int := 0;
  v_name text;
  v_city text;
  v_slug text;
  v_sectors text[];
  v_region text;
  v_done int;
begin
  with ended as (
    update public.visibility_boosts set status = 'ENDED' where status = 'ACTIVE' and ends_at <= now() returning id
  )
  select count(*) into v_ended from ended;

  for b in
    select * from public.visibility_boosts where status = 'ACTIVE' and target = 'COMPANY' and daily_presentations > 0 order by starts_at limit p_limit
  loop
    select count(*) into v_done from public.boost_presentations p
     where p.boost_id = b.id and (p.created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
    if v_done >= b.daily_presentations then continue; end if;
    select c.name, c.city, c.slug, c.region, coalesce(cp.sectors, '{}') into v_name, v_city, v_slug, v_region, v_sectors
      from public.companies c left join public.company_profiles cp on cp.company_id = c.id where c.id = b.company_id;
    for r in
      select c.id,
             (exists (select 1 from public.opportunities o where o.company_id = c.id and o.origin = 'INTERNAL' and o.sector_slug = any(v_sectors)))::int * 2
             + (c.region is not distinct from v_region)::int as score
        from public.companies c
       where c.status = 'ACTIVE' and not c.is_demo and c.id <> b.company_id
         and public.boost_target_matches(b.targeting, c.id)
         and not exists (select 1 from public.boost_presentations p where p.boost_id = b.id and p.presented_to = c.id)
         and not exists (select 1 from public.boost_presentations p where p.presented_to = c.id and p.created_at > now() - interval '3 days')
       order by score desc, c.created_at desc
       limit b.daily_presentations - v_done
    loop
      insert into public.boost_presentations (boost_id, presented_to) values (b.id, r.id) on conflict do nothing;
      if not found then continue; end if;
      v_presented := v_presented + 1;
      perform public.notify_user(m.user_id, 'company_spotlight', 'Entreprise à découvrir : ' || v_name,
        'Une entreprise inscrite sur LinkProB2B' || coalesce(' à ' || v_city, '') || ' qui pourrait vous intéresser. Consultez sa fiche et contactez-la directement.',
        '/entreprises/' || v_slug, false)
        from public.company_members m where m.company_id = r.id;
    end loop;
  end loop;
  return jsonb_build_object('terminees', v_ended, 'presentations', v_presented);
end;
$$;
revoke all on function public.process_visibility_boosts(int) from public, anon, authenticated;
grant execute on function public.process_visibility_boosts(int) to service_role;
