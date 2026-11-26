-- Recommandations acceptées par le fondateur (26/11). Offre payante toujours éteinte : rien ne change pour les utilisateurs avant le lancement.
-- 1. Essai avec carte : 7 jours (au lieu de 3)
update public.platform_settings set value = value || '{"trial_days": 7}'::jsonb where key = 'billing.credits_plan';
update public.platform_settings set value = value || '{"days": 7}'::jsonb where key = 'billing.card_trial';
-- 2. Gratuit : on garde 2 candidatures, mais notes et journal sans limite, et l'alerte chaque matin
update public.platform_settings
   set value = value || '{"alert_frequency": "daily", "notes_per_application": null, "journal_days": null}'::jsonb
 where key = 'billing.free_limits';
-- 3. Alertes comprises dans la formule (Gratuit 1, Pro 3, Business illimité), plus jamais payées en crédits
update public.platform_settings
   set value = value || '{"extra_cost": null}'::jsonb,
       description = 'Alertes incluses par formule (au-delà : passer à la formule supérieure, aucun crédit)'
 where key = 'billing.alert_rules';
-- 4. Offre fondateur : valable 30 jours après le lancement (date affichée)
update public.platform_settings set value = value || '{"deadline_days": 30}'::jsonb where key = 'billing.legacy_founder';

-- Une alerte au-delà de la formule n'est plus débitée : la fonction répond « non incluse » sans toucher aux crédits
create or replace function public.charge_extra_alert(p_alert_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_plan text; v_included int; v_count int;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not exists (select 1 from public.alerts where id = p_alert_id and user_id = v_uid) then
    raise exception 'Alerte introuvable' using errcode = 'P0002';
  end if;
  v_plan := public.user_plan(v_uid);
  select (value -> 'included' ->> v_plan)::int into v_included from public.platform_settings where key = 'billing.alert_rules';
  if v_included is null then return jsonb_build_object('ok', true, 'charged', 0, 'included', true); end if;
  select count(*) into v_count from public.alerts where user_id = v_uid and is_active;
  return jsonb_build_object('ok', true, 'charged', 0, 'included', v_count <= v_included, 'limit', v_included);
end;
$$;
revoke all on function public.charge_extra_alert(uuid) from public, anon;
grant execute on function public.charge_extra_alert(uuid) to authenticated;
