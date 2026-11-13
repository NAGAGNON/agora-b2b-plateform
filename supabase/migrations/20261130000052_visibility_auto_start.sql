-- Offre « Visibilité » : plus aucune validation manuelle. Pendant la phase gratuite, toute demande démarre
-- immédiatement (durée, mise en avant, présentations). L'équipe est prévenue et peut arrêter une offre à tout
-- moment depuis l'administration. Une fois le lancement payant activé, la demande reste en attente du paiement.

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
  v_t := jsonb_strip_nulls(jsonb_build_object(
    'sectors', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'sectors', '[]')) x limit 40) s),
    'regions', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'regions', '[]')) x limit 40) s),
    'sizes', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'sizes', '[]')) x where x in ('INDEPENDANT', 'TPE', 'PME', 'ETI', 'GE')) s),
    'kinds', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'kinds', '[]')) x where x in ('SUPPLIER', 'BUYER', 'BOTH')) s)
  ));
  insert into public.visibility_boosts (company_id, target, opportunity_id, daily_presentations, featured_days, duration_days, price_ht, free_launch, requested_by, targeting,
                                        status, starts_at, ends_at, featured_until, reviewed_at, note)
  values (p_company_id, p_target, case when p_target = 'NEED' then p_opportunity_id end, p_daily, p_featured_days, p_duration_days,
          case when v_free then 0 else greatest(p_price_ht, 0) end, v_free, auth.uid(), coalesce(v_t, '{}'::jsonb),
          case when v_free then 'ACTIVE' else 'PENDING' end,
          case when v_free then now() end,
          case when v_free then now() + make_interval(days => p_duration_days) end,
          case when v_free and p_featured_days > 0 then now() + make_interval(days => p_featured_days) end,
          case when v_free then now() end,
          case when v_free then 'Démarrage automatique' end)
  returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when v_free then 'visibility.started_auto' else 'visibility.requested' end, 'company', p_company_id,
          jsonb_build_object('boost_id', v_id, 'target', p_target, 'daily', p_daily, 'featured_days', p_featured_days, 'days', p_duration_days, 'targeting', v_t));
  perform public.notify_user(u.id, 'visibility_pending',
      case when v_free then 'Nouvelle offre de visibilité démarrée' else 'Demande de visibilité en attente de paiement' end,
      (select name from public.companies where id = p_company_id), '/admin/visibilite', false)
     from public.users u where u.platform_role in ('ADMIN', 'SUPER_ADMIN') and u.status = 'ACTIVE';
  return v_id;
exception when unique_violation then
  raise exception 'Une offre est déjà en cours pour cette cible' using errcode = 'P0001';
end;
$$;
revoke all on function public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric, jsonb) from public, anon;
grant execute on function public.request_visibility_boost(uuid, text, uuid, int, int, int, numeric, jsonb) to authenticated;

-- Arrêt par l'équipe d'une offre en cours (en cas de souci) : plus de présentations ni de mise en avant
create or replace function public.stop_visibility_boost(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  if not public.is_admin() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  update public.visibility_boosts
     set status = 'CANCELLED', ends_at = least(coalesce(ends_at, now()), now()), featured_until = case when featured_until is not null then least(featured_until, now()) end,
         reviewed_by = auth.uid(), reviewed_at = now(), note = coalesce(nullif(trim(p_note), ''), 'Arrêtée par l''équipe')
   where id = p_id and status in ('PENDING', 'ACTIVE')
  returning * into b;
  if b.id is null then raise exception 'Offre introuvable ou déjà terminée' using errcode = 'P0001'; end if;
  -- Plus aucun e-mail de présentation pour cette offre
  update public.outreach_campaigns set status = 'CANCELLED' where boost_id = p_id and status in ('BUILDING', 'READY', 'VALIDATED', 'SENDING');
  update public.outreach_recipients r set status = 'EXCLUDED'
    from public.outreach_campaigns c where c.id = r.campaign_id and c.boost_id = p_id and r.status in ('PENDING', 'QUEUED');
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'visibility.stopped', 'company', b.company_id, jsonb_build_object('boost_id', p_id, 'note', p_note));
end;
$$;
revoke all on function public.stop_visibility_boost(uuid, text) from public, anon;
grant execute on function public.stop_visibility_boost(uuid, text) to authenticated;

-- Demandes restées en attente pendant la phase gratuite : démarrage immédiat
update public.visibility_boosts b
   set status = 'ACTIVE', starts_at = now(), ends_at = now() + make_interval(days => b.duration_days),
       featured_until = case when b.featured_days > 0 then now() + make_interval(days => b.featured_days) end,
       reviewed_at = now(), note = 'Démarrage automatique'
 where b.status = 'PENDING' and b.free_launch;
