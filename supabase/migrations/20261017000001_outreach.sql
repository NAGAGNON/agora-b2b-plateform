-- =============================================================================
-- LinkProB2B Outreach — prospection B2B à partir des nouvelles opportunités.
-- Données PRIVÉES, séparées des données publiques de LinkProB2B :
--   tables outreach_*, RLS active, lecture/écriture réservées aux administrateurs
--   de la plateforme (is_admin()). Les tâches planifiées, la landing page et le
--   suivi (pixel, clics, désinscription) passent par le client « service »,
--   uniquement après vérification d'un jeton signé.
-- Migration additive : aucune table existante n'est modifiée.
-- =============================================================================

-- Réglages (une seule ligne)
create table if not exists public.outreach_settings (
  id boolean primary key default true check (id),
  min_score int not null default 70 check (min_score between 0 and 100),
  max_opportunities_per_email int not null default 6 check (max_opportunities_per_email between 1 and 20),
  min_days_between_contacts int not null default 7 check (min_days_between_contacts between 0 and 365),
  max_contacts_per_30_days int not null default 3 check (max_contacts_per_30_days between 1 and 30),
  daily_send_cap int not null default 50 check (daily_send_cap between 0 and 10000),
  min_days_before_deadline int not null default 3 check (min_days_before_deadline between 0 and 60),
  lookback_days int not null default 2 check (lookback_days between 1 and 30),
  max_prospects_per_opportunity int not null default 200 check (max_prospects_per_opportunity between 1 and 5000),
  -- Simulation : aucun e-mail réel n'est envoyé tant que ce mode est actif.
  dry_run boolean not null default true,
  -- Validation manuelle de chaque campagne avant envoi.
  require_validation boolean not null default true,
  discovery_enabled boolean not null default true,
  include_individual_entrepreneurs boolean not null default false,
  sender_name text not null default 'LinkProB2B — Veille opportunités',
  reply_to text,
  subject_template text not null default '{nombre_opportunites} pour {entreprise} — {secteur}',
  intro_template text not null default 'Nous avons identifié aujourd''hui {nombre_opportunites} publiée{s} sur LinkProB2B qui correspond{ent} à votre activité{secteur_phrase}{zone_phrase}.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);
insert into public.outreach_settings (id) values (true) on conflict do nothing;

-- Prospects : entreprises susceptibles d'être intéressées (sources publiques ou autorisées)
create table if not exists public.outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  siren text check (siren is null or siren ~ '^[0-9]{9}$'),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  naf_code text,
  naf_label text,
  sectors text[] not null default '{}',
  activity text,
  services text[] not null default '{}',
  keywords text[] not null default '{}',
  city text,
  postal_code text,
  department_code text,
  region text,
  -- LOCAL (département), REGIONAL, NATIONAL
  intervention_zone text not null default 'REGIONAL' check (intervention_zone in ('LOCAL', 'REGIONAL', 'NATIONAL')),
  size_range text,
  is_individual_entrepreneur boolean not null default false,
  website text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_source text,
  contact_name text,
  -- Traçabilité : d'où viennent les données et sur quelle base elles sont utilisées
  source text not null,
  source_ref text,
  legal_basis text not null default 'Intérêt légitime — prospection B2B en lien avec l''activité professionnelle',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXCLUDED', 'DO_NOT_CONTACT', 'CLOSED')),
  excluded_reason text,
  linkprob2b_company_id uuid references public.companies (id) on delete set null,
  last_contacted_at timestamptz,
  contacts_count int not null default 0,
  last_clicked_at timestamptz,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Unicité du SIREN (les valeurs NULL restent autorisées en nombre) : permet l'upsert des entreprises découvertes
create unique index if not exists outreach_prospects_siren_uidx on public.outreach_prospects (siren);
create unique index if not exists outreach_prospects_email_uidx on public.outreach_prospects (lower(email)) where email is not null and siren is null;
create index if not exists outreach_prospects_naf_idx on public.outreach_prospects (naf_code, department_code);
create index if not exists outreach_prospects_dept_idx on public.outreach_prospects (department_code);
create index if not exists outreach_prospects_region_idx on public.outreach_prospects (region);
create index if not exists outreach_prospects_sectors_idx on public.outreach_prospects using gin (sectors);
create index if not exists outreach_prospects_status_idx on public.outreach_prospects (status);

-- Liste globale d'exclusion (« Ne plus contacter ») : adresse, domaine ou SIREN
create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('EMAIL', 'DOMAIN', 'SIREN')),
  value text not null,
  reason text not null default 'MANUAL' check (reason in ('UNSUBSCRIBE', 'MANUAL', 'BOUNCE', 'COMPLAINT', 'CUSTOMER')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  unique (kind, value)
);

-- Suivi des opportunités LinkProB2B vues par l'outil (nouvelle / traitée / expirée / modifiée)
create table if not exists public.outreach_opportunity_states (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  status text not null default 'NEW' check (status in ('NEW', 'PROCESSED', 'EXPIRED', 'MODIFIED', 'IGNORED')),
  content_hash text not null,
  first_seen_at timestamptz not null default now(),
  processed_at timestamptz,
  last_campaign_id uuid,
  target_profiles text[] not null default '{}',
  target_naf text[] not null default '{}',
  matches_count int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists outreach_opportunity_states_status_idx on public.outreach_opportunity_states (status, first_seen_at desc);

-- Campagnes quotidiennes
create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_date date not null unique,
  status text not null default 'BUILDING' check (status in ('BUILDING', 'READY', 'VALIDATED', 'SENDING', 'SENT', 'SIMULATED', 'CANCELLED', 'FAILED')),
  dry_run boolean not null default true,
  min_score int not null,
  subject_template text not null,
  intro_template text not null,
  stats jsonb not null default '{}',
  report text,
  error text,
  validated_at timestamptz,
  validated_by uuid references public.users (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Destinataires (1 entreprise = 1 e-mail par campagne, toutes ses opportunités regroupées)
create table if not exists public.outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns (id) on delete cascade,
  prospect_id uuid not null references public.outreach_prospects (id) on delete cascade,
  email text,
  score int not null check (score between 0 and 100),
  reasons text[] not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING', 'EXCLUDED', 'NO_EMAIL', 'SUPPRESSED', 'FREQUENCY', 'QUEUED', 'SENT', 'SIMULATED', 'FAILED')),
  subject text,
  intro text,
  error text,
  sent_at timestamptz,
  provider_id text,
  opened_at timestamptz,
  clicked_at timestamptz,
  landing_viewed_at timestamptz,
  opportunity_viewed_at timestamptz,
  signed_up_at timestamptz,
  converted_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);
create index if not exists outreach_recipients_campaign_idx on public.outreach_recipients (campaign_id, status);
create index if not exists outreach_recipients_prospect_idx on public.outreach_recipients (prospect_id, sent_at desc);

create table if not exists public.outreach_recipient_opportunities (
  recipient_id uuid not null references public.outreach_recipients (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  score int not null check (score between 0 and 100),
  reasons text[] not null default '{}',
  excluded boolean not null default false,
  position int not null default 0,
  primary key (recipient_id, opportunity_id)
);
create index if not exists outreach_recipient_opportunities_opp_idx on public.outreach_recipient_opportunities (opportunity_id);

-- Journal de suivi (parcours complet)
create table if not exists public.outreach_events (
  id bigint generated always as identity primary key,
  recipient_id uuid references public.outreach_recipients (id) on delete cascade,
  campaign_id uuid references public.outreach_campaigns (id) on delete cascade,
  type text not null check (type in ('PREPARED', 'SENT', 'SIMULATED', 'FAILED', 'OPEN', 'CLICK', 'LANDING_VIEW', 'OPPORTUNITY_VIEW', 'SIGNUP', 'CONVERSION', 'UNSUBSCRIBE')),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists outreach_events_campaign_idx on public.outreach_events (campaign_id, type);
create index if not exists outreach_events_created_idx on public.outreach_events (created_at desc);
create index if not exists outreach_events_opp_idx on public.outreach_events (opportunity_id) where opportunity_id is not null;

-- Cache des recherches d'entreprises (API publique) : évite de réinterroger la source
create table if not exists public.outreach_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  naf_code text not null,
  department_code text not null,
  fetched int not null default 0,
  error text,
  ran_at timestamptz not null default now(),
  unique (naf_code, department_code)
);

-- ---------------------------------------------------------------------------
-- Sécurité : RLS, accès réservé aux administrateurs de la plateforme
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['outreach_settings', 'outreach_prospects', 'outreach_suppressions', 'outreach_opportunity_states',
    'outreach_campaigns', 'outreach_recipients', 'outreach_recipient_opportunities', 'outreach_events', 'outreach_discovery_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Statistiques d'une campagne (calculées à partir des données réelles)
create or replace function public.outreach_campaign_stats(p_campaign_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'recipients', count(*),
    'selected', count(*) filter (where status not in ('EXCLUDED', 'SUPPRESSED', 'FREQUENCY')),
    'prepared', count(*) filter (where status in ('PENDING', 'QUEUED', 'SENT', 'SIMULATED', 'FAILED')),
    'no_email', count(*) filter (where status = 'NO_EMAIL'),
    'excluded', count(*) filter (where status in ('EXCLUDED', 'SUPPRESSED', 'FREQUENCY')),
    'sent', count(*) filter (where status = 'SENT'),
    'simulated', count(*) filter (where status = 'SIMULATED'),
    'failed', count(*) filter (where status = 'FAILED'),
    'opened', count(opened_at),
    'clicked', count(clicked_at),
    'landing', count(landing_viewed_at),
    'opportunity_views', count(opportunity_viewed_at),
    'signups', count(signed_up_at),
    'conversions', count(converted_at),
    'unsubscribed', count(unsubscribed_at)
  )
  from public.outreach_recipients
  where campaign_id = p_campaign_id;
$$;
grant execute on function public.outreach_campaign_stats(uuid) to authenticated;
