-- =============================================================================
-- Lancement des offres payantes (préparé, INACTIF tant que launch_paid_offer() n'est pas appelée)
-- -----------------------------------------------------------------------------
--  - Essai Pro sans carte : 30 jours offerts à toutes les entreprises existantes au lancement ;
--    14 jours à la demande ensuite (une seule fois par entreprise).
--  - Nouvelles limites de l'offre Gratuite : recherches par semaine, historique des acheteurs.
--  - Tarif de lancement (« fondateur ») : nombre de places limité, compté sur les abonnements réels.
-- =============================================================================

alter table public.companies add column if not exists trial_ends_at timestamptz;
alter table public.companies add column if not exists trial_started_at timestamptz;
alter table public.subscriptions add column if not exists founder boolean not null default false;

-- Offre effective : abonnement payant, sinon essai Pro en cours, sinon Gratuit.
create or replace function public.company_plan(p_company_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when c.plan_code in ('PRO', 'BUSINESS') then c.plan_code
      when c.trial_ends_at > now() then 'PRO'
      else 'FREE' end
    from public.companies c where c.id = p_company_id
  ), 'FREE');
$$;

create or replace function public.user_plan(p_user_id uuid default auth.uid())
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p from (
      select case when c.plan_code in ('PRO', 'BUSINESS') then c.plan_code when c.trial_ends_at > now() then 'PRO' end as p
      from public.company_members m join public.companies c on c.id = m.company_id
      where m.user_id = p_user_id and c.status = 'ACTIVE'
    ) x where p is not null
    order by case p when 'BUSINESS' then 2 else 1 end desc limit 1
  ), 'FREE');
$$;

-- Nouvelles limites (effectives seulement quand la phase de lancement gratuite est terminée)
update public.plans set features = features || '{"searches_week": 15, "buyer_history": 5, "digest_items": 3, "early_needs": false}'::jsonb where code = 'FREE';
update public.plans set features = features || '{"searches_week": null, "buyer_history": null, "digest_items": null, "early_needs": true}'::jsonb where code in ('PRO', 'BUSINESS');

-- Recherches de la semaine (offre Gratuite) : comptées par utilisateur
create table if not exists public.search_usage (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null default current_date,
  searches int not null default 0,
  primary key (user_id, day)
);
alter table public.search_usage enable row level security;
drop policy if exists search_usage_own on public.search_usage;
create policy search_usage_own on public.search_usage for select to authenticated using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.search_usage from anon, authenticated;

-- Compte une recherche et indique si elle est permise (true) ou bloquée par la limite (false).
create or replace function public.count_search()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_used int;
begin
  if auth.uid() is null then return true; end if;
  v_limit := public.plan_feature(public.user_plan(auth.uid()), 'searches_week');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return true; end if;
  select coalesce(sum(searches), 0) into v_used from public.search_usage where user_id = auth.uid() and day > current_date - 7;
  if v_used >= (v_limit)::int then return false; end if;
  insert into public.search_usage (user_id, day, searches) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set searches = public.search_usage.searches + 1;
  return true;
end;
$$;
revoke all on function public.count_search() from public, anon;
grant execute on function public.count_search() to authenticated;

-- Essai Pro de 14 jours, une seule fois par entreprise, pendant l'offre de lancement, offre Gratuite.
create or replace function public.start_pro_trial(p_company_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_end timestamptz;
begin
  if not public.is_company_member(p_company_id) then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if not coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'founder_offer'), false) then
    raise exception 'Essai indisponible' using errcode = 'P0001';
  end if;
  update public.companies
     set trial_started_at = now(), trial_ends_at = now() + interval '14 days'
   where id = p_company_id and trial_started_at is null and plan_code not in ('PRO', 'BUSINESS')
  returning trial_ends_at into v_end;
  if v_end is null then raise exception 'Essai déjà utilisé' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'billing.trial_started', 'company', p_company_id, jsonb_build_object('days', 14));
  return v_end;
end;
$$;
revoke all on function public.start_pro_trial(uuid) from public, anon;
grant execute on function public.start_pro_trial(uuid) to authenticated;

-- Étapes des e-mails de lancement
alter table public.founder_offer_sends drop constraint if exists founder_offer_sends_step_check;
alter table public.founder_offer_sends add constraint founder_offer_sends_step_check check (step in ('ANNONCE', 'RAPPEL', 'FIN_ESSAI', 'DERNIER'));

-- LANCEMENT (appelé uniquement sur décision du propriétaire) : fin de la gratuité totale, essai Pro de
-- 30 jours pour toutes les entreprises actives, tarif de lancement jusqu'à p_ends_at, p_seats places.
create or replace function public.launch_paid_offer(p_ends_at timestamptz, p_seats int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_trials int;
begin
  update public.platform_settings set value = 'false'::jsonb, updated_at = now() where key = 'billing.free_launch';
  insert into public.platform_settings (key, value, description)
  values ('founder_offer', jsonb_build_object('enabled', true, 'launched_at', now(), 'ends_at', p_ends_at, 'seats', p_seats), 'Offre de lancement')
  on conflict (key) do update set value = excluded.value, updated_at = now();
  update public.companies
     set trial_started_at = now(), trial_ends_at = now() + interval '30 days'
   where status = 'ACTIVE' and not is_demo and plan_code not in ('PRO', 'BUSINESS') and trial_started_at is null;
  get diagnostics v_trials = row_count;
  return jsonb_build_object('trials', v_trials, 'ends_at', p_ends_at, 'seats', p_seats);
end;
$$;
revoke all on function public.launch_paid_offer(timestamptz, int) from public, anon, authenticated;
grant execute on function public.launch_paid_offer(timestamptz, int) to service_role;

-- Pendant l'offre de lancement : chaque nouvelle entreprise commence avec 14 jours de Pro offerts.
create or replace function public.companies_launch_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select (value ->> 'enabled')::boolean and coalesce((value ->> 'ends_at')::timestamptz > now(), true)
                 from public.platform_settings where key = 'founder_offer'), false)
     and not new.is_demo and new.trial_started_at is null then
    new.trial_started_at := now();
    new.trial_ends_at := now() + interval '14 days';
  end if;
  return new;
end;
$$;
drop trigger if exists companies_launch_trial on public.companies;
create trigger companies_launch_trial before insert on public.companies for each row execute function public.companies_launch_trial();
