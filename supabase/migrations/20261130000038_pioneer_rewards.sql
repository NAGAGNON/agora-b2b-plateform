-- Membres pionniers : récompense des membres les plus fidèles (revenus au moins 3 jours différents),
-- 3 mois de l'offre Pro offerts sur leur entreprise (fiche synthèse des appels d'offres, alertes et
-- favoris illimités, pipeline…). Rien n'est facturé : la période se termine simplement. Une seule fois
-- par membre ; si le membre n'a pas encore d'entreprise, la récompense s'applique dès qu'il en crée une.
create table if not exists public.pioneer_rewards (
  user_id uuid primary key references public.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  pro_until timestamptz not null,
  applied_company_id uuid references public.companies (id) on delete set null,
  reason text
);
alter table public.pioneer_rewards enable row level security;
revoke all on public.pioneer_rewards from anon, authenticated;
-- Le membre voit sa propre récompense (tableau de bord)
create policy pioneer_rewards_own on public.pioneer_rewards for select to authenticated using (user_id = (select auth.uid()));
grant select on public.pioneer_rewards to authenticated;

create or replace function public.process_pioneer_rewards(p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u record;
  r record;
  v_company uuid;
  n_new int := 0;
  n_applied int := 0;
begin
  -- 1. Nouveaux pionniers
  for u in
    select us.id, us.email, us.full_name, us.notify_email
      from public.users us
     where us.status = 'ACTIVE' and not us.is_internal and not us.is_demo and us.platform_role = 'USER'
       and (select count(*) from public.user_visits v where v.user_id = us.id) >= 3
       and not exists (select 1 from public.pioneer_rewards p where p.user_id = us.id)
     order by (select count(*) from public.user_visits v where v.user_id = us.id) desc
     limit p_limit
  loop
    insert into public.pioneer_rewards (user_id, pro_until, reason)
    values (u.id, now() + interval '90 days', 'Revenu au moins 3 jours différents')
    on conflict do nothing;
    if not found then continue; end if;
    n_new := n_new + 1;
    perform public.notify_user(u.id, 'pioneer_reward', 'Merci : 3 mois de Pro offerts',
      'Vous faites partie des membres les plus fidèles de LinkProB2B. Pour vous remercier, nous vous offrons 3 mois de l''offre Pro : fiche synthèse de chaque appel d''offres, alertes et favoris illimités, pipeline commercial. Rien à payer, aucune carte bancaire.',
      '/dashboard', false);
    if u.notify_email and u.email is not null then
      insert into public.email_outbox (user_id, to_email, template, subject, payload)
      values (u.id, u.email, 'pioneer_reward', 'Merci ! 3 mois de LinkProB2B Pro offerts',
        jsonb_build_object(
          'type', 'pioneer_reward',
          'title', 'Merci pour votre fidélité',
          'paragraphs', jsonb_build_array(
            'Bonjour' || coalesce(' ' || nullif(split_part(trim(u.full_name), ' ', 1), ''), '') || ',',
            'Vous faites partie des membres qui utilisent le plus LinkProB2B. Pour vous remercier, nous vous offrons 3 mois de l''offre Pro.',
            'Concrètement : la fiche synthèse de chaque appel d''offres (ce que veut l''acheteur, les critères, les pièces à fournir), des alertes et des favoris illimités, et le pipeline pour suivre vos réponses.',
            'Rien à payer, aucune carte bancaire demandée : à la fin des 3 mois, votre compte repasse simplement en offre gratuite.'
          ),
          'link', '/dashboard'));
    end if;
  end loop;

  -- 2. Application sur l'entreprise (dès qu'elle existe), sans jamais raccourcir une période en cours
  for r in
    select p.user_id, p.pro_until from public.pioneer_rewards p
     where p.applied_company_id is null and p.pro_until > now()
  loop
    select m.company_id into v_company
      from public.company_members m join public.companies c on c.id = m.company_id
     where m.user_id = r.user_id and c.status = 'ACTIVE' and not c.is_demo
     order by m.created_at limit 1;
    if v_company is null then continue; end if;
    update public.companies
       set trial_started_at = coalesce(trial_started_at, now()),
           trial_ends_at = greatest(coalesce(trial_ends_at, now()), r.pro_until)
     where id = v_company and plan_code not in ('PRO', 'BUSINESS');
    update public.pioneer_rewards set applied_company_id = v_company where user_id = r.user_id;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'billing.pioneer_reward', 'company', v_company, jsonb_build_object('user_id', r.user_id, 'pro_until', r.pro_until));
    n_applied := n_applied + 1;
  end loop;
  return jsonb_build_object('nouveaux', n_new, 'appliques', n_applied);
end;
$$;
revoke execute on function public.process_pioneer_rewards(int) from public, anon, authenticated;
grant execute on function public.process_pioneer_rewards(int) to service_role;
