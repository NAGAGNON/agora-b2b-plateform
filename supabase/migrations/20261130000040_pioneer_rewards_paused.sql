-- Récompense « membres pionniers » (3 mois offerts) suspendue : décision du propriétaire, qui ne l'avait
-- pas validée. Aucune nouvelle attribution ni aucun e-mail tant qu'elle n'est pas validée de nouveau.
insert into public.platform_settings (key, value, description)
values ('pioneer_rewards.enabled', 'false'::jsonb, 'Récompense membres pionniers (3 mois offerts) : suspendue, en attente de validation du propriétaire')
on conflict (key) do update set value = 'false'::jsonb, updated_at = now();

create or replace function public.process_pioneer_rewards(p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Suspendue : aucune nouvelle récompense tant que le propriétaire ne l'a pas validée
  return jsonb_build_object('suspendu', true);
end;
$$;
revoke execute on function public.process_pioneer_rewards(int) from public, anon, authenticated;
grant execute on function public.process_pioneer_rewards(int) to service_role;
