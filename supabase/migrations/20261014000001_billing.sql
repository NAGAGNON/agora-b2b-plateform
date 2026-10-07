-- =============================================================================
-- Monétisation : offres Gratuit / Pro / Business, abonnements Stripe, limites.
-- -----------------------------------------------------------------------------
-- L'abonnement est porté par l'ENTREPRISE (companies.plan_code), partagé par ses
-- membres. Seul le serveur (clé secrète, webhook Stripe signé) écrit le plan :
-- aucune colonne de facturation n'est modifiable par un utilisateur.
-- Les limites sont appliquées EN BASE (déclencheurs, RPC) : masquer un bouton ne
-- suffit pas. Un dépassement ne supprime jamais de données : il bloque seulement
-- les nouveaux ajouts (ex. 30 favoris conservés en repassant à 10 autorisés).
-- Aucune donnée existante n'est supprimée par cette migration.
-- =============================================================================

-- Offres. features : limites (null = illimité) et accès aux fonctionnalités.
alter table public.plans add column if not exists sort_order int not null default 100;
alter table public.plans add column if not exists monthly_price_cents int;

insert into public.plans (code, label, description, is_paid, sort_order, monthly_price_cents, features) values
  ('FREE', 'Gratuit', 'Pour découvrir LinkProB2B.', false, 1, 0,
   '{"active_needs": 1, "contact_requests_month": 5, "favorites": 10, "alerts": 1, "members": 1,
     "recommendations": false, "pipeline": false, "stats": false, "advanced_stats": false, "business_badge": false}'),
  ('PRO', 'Pro', 'Pour développer son activité.', true, 2, 2900,
   '{"active_needs": null, "contact_requests_month": 100, "favorites": null, "alerts": null, "members": 1,
     "recommendations": true, "pipeline": true, "stats": true, "advanced_stats": false, "business_badge": false}'),
  ('BUSINESS', 'Business', 'Pour structurer le développement commercial d''une équipe.', true, 3, 5900,
   '{"active_needs": null, "contact_requests_month": 300, "favorites": null, "alerts": null, "members": null,
     "recommendations": true, "pipeline": true, "stats": true, "advanced_stats": true, "business_badge": true}')
on conflict (code) do update set
  label = excluded.label, description = excluded.description, is_paid = excluded.is_paid,
  sort_order = excluded.sort_order, monthly_price_cents = excluded.monthly_price_cents, features = excluded.features;

-- L'ancienne offre « pilote » est conservée (historique) mais n'est plus attribuée.
update public.plans set sort_order = 99 where code = 'PILOT';
update public.companies set plan_code = 'FREE' where plan_code = 'PILOT';
alter table public.companies alter column plan_code set default 'FREE';
alter table public.companies add column if not exists stripe_customer_id text unique;

-- -----------------------------------------------------------------------------
-- Abonnements (miroir des abonnements Stripe, mis à jour par le webhook signé)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  stripe_price_id text,
  plan_code text not null references public.plans (code),
  -- Statut Stripe brut : active, trialing, past_due, unpaid, canceled, incomplete, incomplete_expired, paused
  status text not null,
  cancel_at_period_end boolean not null default false,
  unit_amount_cents int,
  currency text,
  billing_interval text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  started_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  latest_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_company_idx on public.subscriptions (company_id, updated_at desc);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  number text,
  status text not null,
  amount_due_cents int not null default 0,
  amount_paid_cents int not null default 0,
  currency text not null default 'eur',
  period_start timestamptz,
  period_end timestamptz,
  hosted_invoice_url text,
  invoice_pdf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_company_idx on public.invoices (company_id, created_at desc);
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- Journal des événements Stripe traités (idempotence : un événement n'est appliqué qu'une fois)
create table public.billing_events (
  stripe_event_id text primary key,
  type text not null,
  company_id uuid references public.companies (id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.billing_events enable row level security;
create policy subscriptions_read on public.subscriptions for select using (public.is_company_member(company_id) or public.is_staff());
create policy invoices_read on public.invoices for select using (public.is_company_admin(company_id) or public.is_admin());
create policy billing_events_read on public.billing_events for select using (public.is_admin());
revoke insert, update, delete on public.subscriptions, public.invoices, public.billing_events from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Droits : offre effective et limites
-- -----------------------------------------------------------------------------

-- Offre d'une entreprise (FREE par défaut).
create or replace function public.company_plan(p_company_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select plan_code from public.companies where id = p_company_id and plan_code in ('FREE', 'PRO', 'BUSINESS')), 'FREE');
$$;

-- Meilleure offre parmi les entreprises de l'utilisateur (favoris et alertes sont personnels).
create or replace function public.user_plan(p_user_id uuid default auth.uid())
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.plan_code from public.company_members m join public.companies c on c.id = m.company_id
    where m.user_id = p_user_id and c.status = 'ACTIVE' and c.plan_code in ('PRO', 'BUSINESS')
    order by case c.plan_code when 'BUSINESS' then 2 else 1 end desc limit 1
  ), 'FREE');
$$;

-- Valeur d'une caractéristique d'offre : nombre (limite), null (illimité) ou booléen.
create or replace function public.plan_feature(p_plan text, p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select features -> p_key from public.plans where code = p_plan;
$$;

-- Lève une erreur standardisée « PLAN_LIMIT:<clé> » reconnue par l'interface (encart de mise à niveau).
create or replace function public.raise_plan_limit(p_key text, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = 'PLAN_LIMIT:' || p_key;
end;
$$;

-- Accès à une fonctionnalité (booléen) pour une entreprise.
create or replace function public.company_has_feature(p_company_id uuid, p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((public.plan_feature(public.company_plan(p_company_id), p_key))::boolean, false);
$$;

-- Besoins actifs : 1 en Gratuit (en attente de validation ou publiés), illimité sinon.
create or replace function public.enforce_plan_active_needs()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_count int;
begin
  if auth.uid() is null or public.in_trusted_context() or public.is_staff() or new.origin <> 'INTERNAL' or new.company_id is null then return new; end if;
  if new.status not in ('PENDING_REVIEW', 'PUBLISHED') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('PENDING_REVIEW', 'PUBLISHED') then return new; end if;
  v_limit := public.plan_feature(public.company_plan(new.company_id), 'active_needs');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return new; end if;
  select count(*) into v_count from public.opportunities
    where company_id = new.company_id and origin = 'INTERNAL' and status in ('PENDING_REVIEW', 'PUBLISHED') and id <> new.id;
  if v_count >= (v_limit)::int then
    perform public.raise_plan_limit('active_needs',
      format('Votre offre permet %s besoin actif à la fois. Clôturez-en un ou passez à Pro pour publier sans limite.', v_limit));
  end if;
  return new;
end;
$$;
create trigger opportunities_plan_active_needs before insert or update of status on public.opportunities
  for each row execute function public.enforce_plan_active_needs();

-- Favoris : 10 en Gratuit. Les favoris existants au-delà de la limite sont conservés.
create or replace function public.enforce_plan_favorites()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_count int;
begin
  if auth.uid() is null or public.in_trusted_context() then return new; end if;
  v_limit := public.plan_feature(public.user_plan(new.user_id), 'favorites');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return new; end if;
  select count(*) into v_count from public.favorites where user_id = new.user_id;
  if v_count >= (v_limit)::int then
    perform public.raise_plan_limit('favorites', format('Votre offre permet %s favoris. Passez à Pro pour en enregistrer davantage.', v_limit));
  end if;
  return new;
end;
$$;
create trigger favorites_plan_limit before insert on public.favorites
  for each row execute function public.enforce_plan_favorites();

-- Alertes : 1 en Gratuit (les alertes existantes continuent de fonctionner).
create or replace function public.enforce_plan_alerts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_count int;
begin
  if auth.uid() is null or public.in_trusted_context() then return new; end if;
  v_limit := public.plan_feature(public.user_plan(new.user_id), 'alerts');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return new; end if;
  select count(*) into v_count from public.alerts where user_id = new.user_id;
  if v_count >= (v_limit)::int then
    perform public.raise_plan_limit('alerts', format('Votre offre permet %s alerte. Passez à Pro pour créer des alertes sans limite.', v_limit));
  end if;
  return new;
end;
$$;
create trigger alerts_plan_limit before insert on public.alerts
  for each row execute function public.enforce_plan_alerts();

-- Pipeline commercial : ajout et modification réservés à Pro / Business (lecture toujours possible).
create or replace function public.enforce_plan_pipeline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.in_trusted_context() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then return old; end if;
  if not public.company_has_feature(new.company_id, 'pipeline') then
    perform public.raise_plan_limit('pipeline', 'Le pipeline commercial est inclus dans les offres Pro et Business.');
  end if;
  return new;
end;
$$;
create trigger pipeline_plan_feature before insert or update on public.pipeline_items
  for each row execute function public.enforce_plan_pipeline();

-- Suivi automatique (intérêt, réponse) : uniquement pour les offres incluant le pipeline,
-- afin de ne jamais faire échouer une manifestation d'intérêt d'un compte gratuit.
create or replace function public.advance_pipeline(p_company_id uuid, p_opportunity_id uuid, p_stage public.pipeline_stage)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.company_has_feature(p_company_id, 'pipeline') then return; end if;
  insert into public.pipeline_items (company_id, opportunity_id, stage, updated_by)
  values (p_company_id, p_opportunity_id, p_stage, auth.uid())
  on conflict (company_id, opportunity_id) do update
    set stage = excluded.stage, updated_by = excluded.updated_by
    where public.pipeline_rank(public.pipeline_items.stage) < public.pipeline_rank(excluded.stage)
      and public.pipeline_items.stage not in ('WON', 'LOST');
end;
$$;
revoke execute on function public.advance_pipeline(uuid, uuid, public.pipeline_stage) from public, anon, authenticated;

-- Équipe : nombre de membres limité par l'offre (Business : illimité). Contrôlé à
-- l'invitation ; l'acceptation d'une invitation déjà émise n'est jamais bloquée.
create or replace function public.enforce_plan_invitations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_count int;
begin
  if auth.uid() is null or public.in_trusted_context() then return new; end if;
  v_limit := public.plan_feature(public.company_plan(new.company_id), 'members');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return new; end if;
  select (select count(*) from public.company_members where company_id = new.company_id)
       + (select count(*) from public.company_invitations where company_id = new.company_id and accepted_at is null)
    into v_count;
  if v_count >= (v_limit)::int then
    perform public.raise_plan_limit('members', 'Inviter des collaborateurs est inclus dans l''offre Business.');
  end if;
  return new;
end;
$$;
create trigger company_invitations_plan_limit before insert on public.company_invitations
  for each row execute function public.enforce_plan_invitations();

-- Ajout direct d'un membre existant (invite_company_member) : même règle, sauf à la
-- création de l'entreprise (premier membre) et à l'acceptation d'une invitation.
create or replace function public.enforce_plan_members()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_count int;
begin
  if auth.uid() is null or public.in_trusted_context() or new.user_id = auth.uid() then return new; end if;
  v_limit := public.plan_feature(public.company_plan(new.company_id), 'members');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return new; end if;
  select count(*) into v_count from public.company_members where company_id = new.company_id;
  if v_count >= (v_limit)::int then
    perform public.raise_plan_limit('members', 'Inviter des collaborateurs est inclus dans l''offre Business.');
  end if;
  return new;
end;
$$;
create trigger company_members_plan_limit before insert on public.company_members
  for each row execute function public.enforce_plan_members();

-- Demandes de contact (manifestations d'intérêt et réponses) : 5 par mois en Gratuit.
-- Une nouvelle demande seulement : mettre à jour une demande existante n'est jamais bloqué.
create or replace function public.enforce_plan_contact_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limit jsonb; v_count int; v_since timestamptz := date_trunc('month', now());
begin
  if auth.uid() is null or public.in_trusted_context() then return new; end if;
  if exists (select 1 from public.interests where opportunity_id = new.opportunity_id and company_id = new.company_id)
     or exists (select 1 from public.proposals where opportunity_id = new.opportunity_id and company_id = new.company_id) then
    return new;
  end if;
  v_limit := public.plan_feature(public.company_plan(new.company_id), 'contact_requests_month');
  if v_limit is null or jsonb_typeof(v_limit) = 'null' then return new; end if;
  select count(distinct opportunity_id) into v_count from (
    select opportunity_id from public.interests where company_id = new.company_id and created_at >= v_since
    union all
    select opportunity_id from public.proposals where company_id = new.company_id and submitted_at >= v_since
  ) t;
  if v_count >= (v_limit)::int then
    perform public.raise_plan_limit('contact_requests_month',
      format('Votre offre permet %s demandes de contact par mois. Passez à Pro pour en envoyer davantage.', v_limit));
  end if;
  return new;
end;
$$;
create trigger interests_plan_contact_requests before insert on public.interests
  for each row execute function public.enforce_plan_contact_requests();
create trigger proposals_plan_contact_requests before insert on public.proposals
  for each row execute function public.enforce_plan_contact_requests();

-- Offre et consommation d'une entreprise (pour l'affichage « Mon abonnement » et les encarts).
create or replace function public.company_usage(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_plan text; v_since timestamptz := date_trunc('month', now());
begin
  if not (public.is_company_member(p_company_id) or public.is_staff()) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  v_plan := public.company_plan(p_company_id);
  return jsonb_build_object(
    'plan', v_plan,
    'features', (select features from public.plans where code = v_plan),
    'active_needs', (select count(*) from public.opportunities where company_id = p_company_id and origin = 'INTERNAL' and status in ('PENDING_REVIEW', 'PUBLISHED')),
    'contact_requests_month', (select count(distinct opportunity_id) from (
        select opportunity_id from public.interests where company_id = p_company_id and created_at >= v_since
        union all
        select opportunity_id from public.proposals where company_id = p_company_id and submitted_at >= v_since) t),
    'favorites', (select count(*) from public.favorites where user_id = auth.uid()),
    'alerts', (select count(*) from public.alerts where user_id = auth.uid()),
    'members', (select count(*) from public.company_members where company_id = p_company_id)
  );
end;
$$;
revoke execute on function public.company_usage(uuid) from public, anon;
grant execute on function public.company_usage(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Administration : indicateurs d'abonnement (MRR en centimes, hors taxes)
-- -----------------------------------------------------------------------------
create or replace function public.admin_billing_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return (
    with live as (
      select distinct on (company_id) * from public.subscriptions
      where status in ('active', 'trialing', 'past_due')
      order by company_id, updated_at desc
    )
    select jsonb_build_object(
      'companies_free', (select count(*) from public.companies where status = 'ACTIVE' and is_demo = false and plan_code not in ('PRO', 'BUSINESS')),
      'companies_pro', (select count(*) from public.companies where plan_code = 'PRO' and is_demo = false),
      'companies_business', (select count(*) from public.companies where plan_code = 'BUSINESS' and is_demo = false),
      'mrr_cents', (select coalesce(sum(case when billing_interval = 'year' then unit_amount_cents / 12 else unit_amount_cents end), 0) from live),
      'past_due', (select count(*) from live where status = 'past_due'),
      'cancel_scheduled', (select count(*) from live where cancel_at_period_end),
      'new_30d', (select count(*) from public.subscriptions where started_at > now() - interval '30 days'),
      'new_pro_30d', (select count(*) from public.subscriptions where plan_code = 'PRO' and started_at > now() - interval '30 days'),
      'new_business_30d', (select count(*) from public.subscriptions where plan_code = 'BUSINESS' and started_at > now() - interval '30 days'),
      'churned_30d', (select count(*) from public.subscriptions where ended_at > now() - interval '30 days'),
      'companies_total', (select count(*) from public.companies where is_demo = false),
      'ever_paid_pro', (select count(distinct company_id) from public.subscriptions where plan_code = 'PRO'),
      'ever_paid_business', (select count(distinct company_id) from public.subscriptions where plan_code = 'BUSINESS'),
      'revenue_30d_cents', (select coalesce(sum(amount_paid_cents), 0) from public.invoices where status = 'paid' and created_at > now() - interval '30 days')
    )
  );
end;
$$;
revoke all on function public.admin_billing_stats() from public, anon;
grant execute on function public.admin_billing_stats() to authenticated;
revoke all on function public.raise_plan_limit(text, text) from public, anon, authenticated;
