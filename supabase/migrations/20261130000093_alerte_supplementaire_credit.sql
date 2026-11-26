-- Alertes (fondateur, 26/11) : 1re alerte incluse partout, 3 incluses en Pro, illimitées en Business.
-- Chaque alerte au-delà coûte 1 crédit, une seule fois, à sa création. Alertes existantes : gratuites.
-- Éteint tant que les crédits ne sont pas lancés (spend_credits ne débite rien en sommeil).
insert into public.platform_settings (key, value, description)
values ('billing.alert_rules', '{"included": {"FREE": 1, "PRO": 3, "BUSINESS": null}, "extra_cost": 1}'::jsonb,
        'Alertes incluses par formule ; chaque alerte en plus coûte 1 crédit à sa création')
on conflict (key) do update set value = excluded.value;

create or replace function public.charge_extra_alert(p_alert_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_plan text; v_included int; v_count int; r jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not exists (select 1 from public.alerts where id = p_alert_id and user_id = v_uid) then
    raise exception 'Alerte introuvable' using errcode = 'P0002';
  end if;
  v_plan := public.user_plan(v_uid);
  select (value -> 'included' ->> v_plan)::int into v_included from public.platform_settings where key = 'billing.alert_rules';
  if v_included is null then return jsonb_build_object('ok', true, 'charged', 0, 'included', true); end if;
  select count(*) into v_count from public.alerts where user_id = v_uid and is_active;
  if v_count <= v_included then return jsonb_build_object('ok', true, 'charged', 0, 'included', true); end if;
  r := public.spend_credits('ALERT_ACTIVATION', 1, null, p_alert_id, null, 'alert:' || p_alert_id);
  return r;
end;
$$;
revoke all on function public.charge_extra_alert(uuid) from public, anon;
grant execute on function public.charge_extra_alert(uuid) to authenticated;
