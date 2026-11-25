-- Système de crédits (cahier des charges du 25/11) — EN SOMMEIL : rien n'est débité tant que
-- « billing.credits_enabled » vaut false (activé seulement au lancement, sur ordre du fondateur).
-- 1 crédit = 1 dossier préparé (offre suivie). Veille du matin gratuite pour tous (décision du fondateur 25/11). Gratuit 5/mois, Pro 20/mois,
-- Business illimité. Aucun report d'un mois sur l'autre. Recherche, consultation et annonces officielles : jamais payantes.
-- Aucune table existante modifiée, aucune donnée supprimée.

insert into public.platform_settings (key, value, description)
values ('billing.credits_enabled', 'false'::jsonb, 'Crédits actifs (false = en sommeil : aucun débit, aucune limite)')
on conflict (key) do nothing;

insert into public.platform_settings (key, value, description)
values ('billing.credits_plan', '{"FREE": 5, "PRO": 20, "TRIAL": 10, "BUSINESS": null, "alerts": {"FREE": 1, "PRO": 3, "BUSINESS": null}, "trial_days": 7, "veille_free": true}'::jsonb, 'Crédits par période (null = illimité) et jours de veille par crédit')
on conflict (key) do nothing;

create or replace function public.credits_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = 'billing.credits_enabled'), false);
$$;
grant execute on function public.credits_enabled() to anon, authenticated, service_role;

-- Portefeuille (un par personne : l'offre Gratuit ne demande pas d'entreprise)
create table if not exists public.credit_wallets (
  user_id uuid primary key references public.users (id) on delete cascade,
  plan text not null default 'FREE',
  balance int not null default 0 check (balance >= 0),
  period_start timestamptz not null default now(),
  period_end timestamptz not null default now() + interval '1 month',
  updated_at timestamptz not null default now()
);

-- Registre : chaque mouvement, avec le solde avant et après (jamais modifié ni supprimé)
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  kind text not null check (kind in ('SIGNUP_GRANT','MONTHLY_GRANT','LAUNCH_GRANT','OPPORTUNITY_FOLLOW','ALERT_ACTIVATION','ALERT_RENEWAL','CREDIT_ADJUSTMENT','PLAN_CHANGE','TRIAL_START','TRIAL_END')),
  amount int not null,
  balance_before int not null,
  balance_after int not null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  alert_id uuid references public.alerts (id) on delete set null,
  days int,
  period_start timestamptz,
  idempotency_key text unique,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

-- Offres déjà payées une fois (retirer puis remettre ne redébite pas ; anciens suivis = historiques)
create table if not exists public.credit_follows (
  user_id uuid not null references public.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  historical boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_follows enable row level security;
drop policy if exists credit_wallets_own on public.credit_wallets;
create policy credit_wallets_own on public.credit_wallets for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists credit_ledger_own on public.credit_ledger;
create policy credit_ledger_own on public.credit_ledger for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists credit_follows_own on public.credit_follows;
create policy credit_follows_own on public.credit_follows for select to authenticated using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.credit_wallets, public.credit_ledger, public.credit_follows from anon, authenticated;

-- Crédits de la période pour une offre (null = illimité)
create or replace function public.credits_for_plan(p_plan text)
returns int language sql stable security definer set search_path = '' as $$
  select case when s.value -> p_plan is null or jsonb_typeof(s.value -> p_plan) = 'null' then null else (s.value ->> p_plan)::int end
  from public.platform_settings s where s.key = 'billing.credits_plan';
$$;

-- Portefeuille à jour : création, puis recharge si la période est terminée (une seule par période,
-- verrou de ligne : deux requêtes simultanées ne rechargent jamais deux fois). Heure du serveur uniquement.
create or replace function public.credit_wallet_refresh(p_user_id uuid)
returns public.credit_wallets language plpgsql security definer set search_path = '' as $$
declare w public.credit_wallets; v_plan text; v_amount int; v_start timestamptz;
begin
  v_plan := public.user_plan(p_user_id);
  insert into public.credit_wallets (user_id, plan, balance, period_start, period_end)
  values (p_user_id, v_plan, 0, now() - interval '1 month' - interval '1 second', now() - interval '1 second')
  on conflict (user_id) do nothing;
  select * into w from public.credit_wallets where user_id = p_user_id for update;
  if w.period_end <= now() or w.plan <> v_plan then
    v_amount := coalesce(public.credits_for_plan(v_plan), 0);
    v_start := case when w.period_end <= now() then greatest(w.period_end, now() - interval '1 month') else now() end;
    -- période suivante calée sur la précédente (sans dépendre des connexions)
    while v_start + interval '1 month' <= now() loop v_start := v_start + interval '1 month'; end loop;
    insert into public.credit_ledger (user_id, kind, amount, balance_before, balance_after, period_start, idempotency_key, note)
    values (p_user_id, case when w.plan <> v_plan and w.period_end > now() then 'PLAN_CHANGE' else 'MONTHLY_GRANT' end,
            v_amount - w.balance, w.balance, v_amount, v_start, 'grant:' || p_user_id || ':' || v_plan || ':' || to_char(v_start, 'YYYY-MM-DD"T"HH24:MI:SS.US'),
            'Crédits de la période (' || v_plan || '), sans report')
    on conflict (idempotency_key) do nothing;
    update public.credit_wallets set plan = v_plan, balance = v_amount, period_start = v_start, period_end = v_start + interval '1 month', updated_at = now()
    where user_id = p_user_id returning * into w;
  end if;
  return w;
end;
$$;
revoke all on function public.credit_wallet_refresh(uuid) from public, anon, authenticated;

-- Solde affiché (null = illimité). Lecture seule pour la personne connectée.
create or replace function public.my_credits()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.credit_wallets; v_unlimited boolean;
begin
  if auth.uid() is null then return null; end if;
  w := public.credit_wallet_refresh(auth.uid());
  v_unlimited := public.credits_for_plan(w.plan) is null;
  return jsonb_build_object('enabled', public.credits_enabled(), 'plan', w.plan, 'unlimited', v_unlimited,
    'balance', case when v_unlimited then null else w.balance end, 'per_period', public.credits_for_plan(w.plan), 'renews_at', w.period_end);
end;
$$;
grant execute on function public.my_credits() to authenticated;

-- Débit atomique (vérifié côté serveur). En sommeil : aucun débit, toujours accepté.
-- Erreur PLAN_LIMIT:credits si le solde ne suffit pas (rien n'est débité partiellement).
create or replace function public.spend_credits(p_kind text, p_amount int, p_opportunity_id uuid default null, p_alert_id uuid default null, p_days int default null, p_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.credit_wallets; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_kind not in ('OPPORTUNITY_FOLLOW', 'ALERT_ACTIVATION', 'ALERT_RENEWAL') or p_amount < 1 or p_amount > 36 then
    raise exception 'Opération invalide' using errcode = '22023';
  end if;
  if not public.credits_enabled() then return jsonb_build_object('ok', true, 'charged', 0, 'dormant', true); end if;
  if p_key is not null and exists (select 1 from public.credit_ledger where idempotency_key = p_key) then
    return jsonb_build_object('ok', true, 'charged', 0, 'duplicate', true);
  end if;
  w := public.credit_wallet_refresh(v_uid);
  if public.credits_for_plan(w.plan) is null then
    insert into public.credit_ledger (user_id, kind, amount, balance_before, balance_after, opportunity_id, alert_id, days, period_start, idempotency_key, note)
    values (v_uid, p_kind, 0, w.balance, w.balance, p_opportunity_id, p_alert_id, p_days, w.period_start, p_key, 'Business : illimité');
    return jsonb_build_object('ok', true, 'charged', 0, 'unlimited', true);
  end if;
  if w.balance < p_amount then
    raise exception 'Il vous manque % crédit(s) pour cette action. Vos crédits sont rechargés le %.', p_amount - w.balance, to_char(w.period_end at time zone 'Europe/Paris', 'DD/MM/YYYY')
      using errcode = 'P0429', hint = 'PLAN_LIMIT:credits';
  end if;
  update public.credit_wallets set balance = balance - p_amount, updated_at = now() where user_id = v_uid;
  insert into public.credit_ledger (user_id, kind, amount, balance_before, balance_after, opportunity_id, alert_id, days, period_start, idempotency_key)
  values (v_uid, p_kind, -p_amount, w.balance, w.balance - p_amount, p_opportunity_id, p_alert_id, p_days, w.period_start, p_key);
  return jsonb_build_object('ok', true, 'charged', p_amount, 'balance', w.balance - p_amount);
end;
$$;
grant execute on function public.spend_credits(text, int, uuid, uuid, int, text) to authenticated;

-- Suivre une offre : 1 crédit la première fois seulement (déjà payée ou historique : gratuit)
create or replace function public.charge_follow(p_opportunity_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if exists (select 1 from public.credit_follows where user_id = auth.uid() and opportunity_id = p_opportunity_id) then
    return jsonb_build_object('ok', true, 'charged', 0, 'already', true);
  end if;
  r := public.spend_credits('OPPORTUNITY_FOLLOW', 1, p_opportunity_id, null, null, 'follow:' || auth.uid() || ':' || p_opportunity_id);
  if public.credits_enabled() then
    insert into public.credit_follows (user_id, opportunity_id) values (auth.uid(), p_opportunity_id) on conflict do nothing;
  end if;
  return r;
end;
$$;
grant execute on function public.charge_follow(uuid) to authenticated;

-- Coût d'une veille : chaque tranche de 10 jours commencée = 1 crédit
create or replace function public.alert_credit_cost(p_days int)
returns int language sql immutable set search_path = '' as $$
  select greatest(1, ceil(greatest(p_days, 1) / 10.0)::int);
$$;
grant execute on function public.alert_credit_cost(int) to anon, authenticated;
