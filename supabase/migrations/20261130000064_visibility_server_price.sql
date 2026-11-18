-- Sécurité : le prix d'une offre de visibilité est calculé par la base, plus jamais repris du navigateur.
-- Avant, une entreprise pouvait appeler la fonction directement avec p_price_ht = 0 (sans effet pendant la
-- phase gratuite, mais une demande payante aurait affiché le prix choisi par le client). Le paramètre
-- p_price_ht est conservé pour compatibilité et ignoré.
-- Corrige aussi « column "x" does not exist » (filtre des tailles et types d'entreprise), qui faisait échouer
-- toute demande de visibilité depuis le ciblage.
CREATE OR REPLACE FUNCTION public.request_visibility_boost(p_company_id uuid, p_target text, p_opportunity_id uuid, p_daily integer, p_featured_days integer, p_duration_days integer, p_price_ht numeric, p_targeting jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_free boolean := public.free_launch(); v_t jsonb;
  v_day numeric; v_full numeric; v_left int; v_covered int := 0; v_price numeric;
begin
  if not public.is_company_admin(p_company_id) then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if p_target = 'NEED' and not exists (
    select 1 from public.opportunities o where o.id = p_opportunity_id and o.company_id = p_company_id and o.status = 'PUBLISHED' and o.origin = 'INTERNAL'
  ) then raise exception 'Besoin introuvable ou non publié' using errcode = 'P0001'; end if;
  -- Prix calculé ici, jamais repris du navigateur : tarif par palier, moins les présentations incluses
  -- dans l'abonnement (Pro 100, Business 400 par mois) ; la mise en avant « À la une » reste à 1 € HT par jour.
  v_day := case p_daily when 0 then 0 when 5 then 1.5 when 10 then 2.5 when 20 then 4 when 40 then 7 when 80 then 13 end;
  if v_day is null then raise exception 'Choix invalide' using errcode = 'P0001'; end if;
  v_full := round(v_day * p_duration_days + coalesce(p_featured_days, 0), 2);
  v_left := greatest(0, (case public.company_plan(p_company_id) when 'BUSINESS' then 400 when 'PRO' then 100 else 0 end)
    - coalesce((select sum(b.included_presentations) from public.visibility_boosts b
                 where b.company_id = p_company_id and b.created_at >= date_trunc('month', now())
                   and b.status not in ('REJECTED', 'CANCELLED')), 0))::int;
  if p_daily > 0 then v_covered := least(v_left, p_daily * p_duration_days); end if;
  v_price := greatest(0, round(v_full - case when p_daily > 0 then v_covered * v_day / p_daily else 0 end, 2));
  v_t := jsonb_strip_nulls(jsonb_build_object(
    'sectors', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'sectors', '[]')) x limit 40) s),
    'regions', (select jsonb_agg(x) from (select jsonb_array_elements_text(coalesce(p_targeting -> 'regions', '[]')) x limit 40) s),
    'sizes', (select jsonb_agg(x) from jsonb_array_elements_text(coalesce(p_targeting -> 'sizes', '[]')) x where x in ('INDEPENDANT', 'TPE', 'PME', 'ETI', 'GE')),
    'kinds', (select jsonb_agg(x) from jsonb_array_elements_text(coalesce(p_targeting -> 'kinds', '[]')) x where x in ('SUPPLIER', 'BUYER', 'BOTH'))
  ));
  insert into public.visibility_boosts (company_id, target, opportunity_id, daily_presentations, featured_days, duration_days, price_ht, included_presentations, free_launch, requested_by, targeting,
                                        status, starts_at, ends_at, featured_until, reviewed_at, note)
  values (p_company_id, p_target, case when p_target = 'NEED' then p_opportunity_id end, p_daily, p_featured_days, p_duration_days,
          case when v_free then 0 else v_price end, v_covered, v_free, auth.uid(), coalesce(v_t, '{}'::jsonb),
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
$function$;
