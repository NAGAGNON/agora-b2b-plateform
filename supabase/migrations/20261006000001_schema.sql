-- =============================================================================
-- LinkProB2B — Schéma initial
-- Tables, types, index. La sécurité (RLS) est dans la migration suivante,
-- les fonctions métier (RPC) dans la troisième.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.platform_role as enum ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');
create type public.account_status as enum ('ACTIVE', 'SUSPENDED', 'DELETED');
create type public.company_role as enum ('COMPANY_MEMBER', 'COMPANY_ADMIN');
create type public.company_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED');
create type public.company_kind as enum ('SUPPLIER', 'BUYER', 'BOTH');
create type public.company_size as enum ('INDEPENDANT', 'TPE', 'PME', 'ETI', 'GE');
create type public.opportunity_type as enum (
  'NEED', 'QUOTE_REQUEST', 'PRIVATE_CONSULTATION', 'PRIVATE_TENDER',
  'EXTERNAL_OPPORTUNITY', 'PUBLIC_TENDER'
);
create type public.opportunity_status as enum (
  'DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED',
  'CLOSED', 'EXPIRED', 'SUSPENDED', 'ARCHIVED'
);
create type public.opportunity_origin as enum ('INTERNAL', 'EXTERNAL');
create type public.opportunity_visibility as enum ('PUBLIC', 'MEMBERS_ONLY');
create type public.opportunity_outcome as enum ('AWARDED', 'NOT_AWARDED', 'CANCELLED', 'UNKNOWN');
create type public.interest_status as enum ('PENDING', 'SHORTLISTED', 'INFO_REQUESTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');
create type public.proposal_status as enum ('SUBMITTED', 'SHORTLISTED', 'INFO_REQUESTED', 'SELECTED', 'DECLINED', 'WITHDRAWN');
create type public.pipeline_stage as enum (
  'DETECTED', 'QUALIFIED', 'INTERESTED', 'RESPONSE_PREPARING', 'RESPONSE_SENT',
  'DISCUSSION', 'NEGOTIATION', 'WON', 'LOST'
);
create type public.alert_frequency as enum ('IMMEDIATE', 'DAILY', 'WEEKLY');
create type public.source_status as enum ('DRAFT', 'LEGAL_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED');
create type public.report_status as enum ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
create type public.report_target as enum ('OPPORTUNITY', 'COMPANY', 'MESSAGE', 'USER', 'PROPOSAL');
create type public.moderation_action_type as enum (
  'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'SUSPEND', 'ARCHIVE', 'REINSTATE'
);
create type public.email_status as enum ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- -----------------------------------------------------------------------------
-- Référentiels
-- -----------------------------------------------------------------------------
create table public.sectors (
  slug text primary key,
  label text not null,
  description text,
  is_pilot_priority boolean not null default false,
  sort_order int not null default 100
);

create table public.opportunity_types (
  code public.opportunity_type primary key,
  label text not null,
  description text not null,
  is_external boolean not null default false,
  accepts_proposals boolean not null default false,
  sort_order int not null default 100
);

-- Lieux de référence (communes) pour la recherche par rayon.
-- Coordonnées des chefs-lieux : données publiques (INSEE / IGN), arrondies.
create table public.places (
  id serial primary key,
  name text not null,
  slug text not null unique,
  postal_code text not null,
  department_code text not null,
  department_name text not null,
  region text not null,
  lat double precision not null,
  lng double precision not null
);
create index places_department_idx on public.places (department_code);

create table public.departments (
  code text primary key,
  name text not null,
  slug text not null unique,
  region text not null
);

-- -----------------------------------------------------------------------------
-- Utilisateurs
-- -----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  job_title text,
  phone text,
  platform_role public.platform_role not null default 'USER',
  status public.account_status not null default 'ACTIVE',
  terms_accepted_at timestamptz,
  marketing_consent boolean not null default false,
  notify_email boolean not null default true,
  is_demo boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_role_idx on public.users (platform_role);

-- -----------------------------------------------------------------------------
-- Entreprises
-- -----------------------------------------------------------------------------
create table public.plans (
  code text primary key,
  label text not null,
  description text,
  is_paid boolean not null default false,
  features jsonb not null default '{}'::jsonb
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 160),
  siren text check (siren is null or siren ~ '^[0-9]{9}$'),
  kind public.company_kind not null default 'BOTH',
  size public.company_size,
  city text,
  postal_code text,
  department_code text references public.departments (code),
  region text,
  lat double precision,
  lng double precision,
  website text,
  logo_path text,
  status public.company_status not null default 'ACTIVE',
  plan_code text not null default 'PILOT' references public.plans (code),
  verified_at timestamptz,
  verified_by uuid,
  verification_note text,
  is_demo boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_status_idx on public.companies (status);
create index companies_department_idx on public.companies (department_code);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.company_role not null default 'COMPANY_MEMBER',
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role public.company_role not null default 'COMPANY_MEMBER',
  invited_by uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create table public.company_profiles (
  company_id uuid primary key references public.companies (id) on delete cascade,
  tagline text,
  description text,
  sectors text[] not null default '{}',
  skills text[] not null default '{}',
  intervention_zone text,
  intervention_radius_km int check (intervention_radius_km is null or intervention_radius_km between 0 and 2000),
  certifications text[] not null default '{}',
  references_text text,
  employees_range text,
  founded_year int check (founded_year is null or founded_year between 1800 and 2100),
  contact_email text,
  contact_phone text,
  is_public boolean not null default true,
  search_vector tsvector,
  updated_at timestamptz not null default now()
);
create index company_profiles_search_idx on public.company_profiles using gin (search_vector);
create index company_profiles_sectors_idx on public.company_profiles using gin (sectors);

-- -----------------------------------------------------------------------------
-- Sources externes
-- -----------------------------------------------------------------------------
create table public.external_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text,
  description text,
  license text,
  terms_url text,
  status public.source_status not null default 'DRAFT',
  legal_validated_at timestamptz,
  legal_validated_by uuid references public.users (id) on delete set null,
  import_method text not null default 'MANUAL' check (import_method in ('MANUAL', 'API', 'FEED', 'PARTNER')),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Opportunités
-- -----------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  type public.opportunity_type not null references public.opportunity_types (code),
  origin public.opportunity_origin not null default 'INTERNAL',
  status public.opportunity_status not null default 'DRAFT',
  visibility public.opportunity_visibility not null default 'PUBLIC',
  title text not null check (char_length(title) between 5 and 180),
  summary text check (summary is null or char_length(summary) <= 400),
  description text not null check (char_length(description) between 20 and 20000),
  company_id uuid references public.companies (id) on delete cascade,
  external_buyer_name text,
  created_by uuid references public.users (id) on delete set null,
  sector_slug text references public.sectors (slug),
  city text,
  postal_code text,
  department_code text references public.departments (code),
  region text,
  lat double precision,
  lng double precision,
  budget_min numeric(14, 2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(14, 2) check (budget_max is null or budget_max >= 0),
  budget_visible boolean not null default true,
  start_date date,
  response_deadline timestamptz,
  skills text[] not null default '{}',
  services text,
  constraints text,
  criteria text,
  max_suppliers int check (max_suppliers is null or max_suppliers between 1 and 100),
  target_company_size public.company_size,
  keywords text[] not null default '{}',
  contact_name text,
  moderation_note text,
  outcome public.opportunity_outcome,
  outcome_note text,
  selected_proposal_id uuid,
  duplicate_of uuid references public.opportunities (id) on delete set null,
  publisher_attested_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  is_demo boolean not null default false,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_owner_check check (
    (origin = 'INTERNAL' and company_id is not null)
    or (origin = 'EXTERNAL')
  ),
  constraint opportunity_external_type_check check (
    (origin = 'EXTERNAL' and type in ('EXTERNAL_OPPORTUNITY', 'PUBLIC_TENDER'))
    or (origin = 'INTERNAL' and type not in ('EXTERNAL_OPPORTUNITY', 'PUBLIC_TENDER'))
  ),
  constraint opportunity_budget_check check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  )
);
create index opportunities_status_idx on public.opportunities (status, published_at desc);
create index opportunities_company_idx on public.opportunities (company_id);
create index opportunities_sector_idx on public.opportunities (sector_slug);
create index opportunities_department_idx on public.opportunities (department_code);
create index opportunities_deadline_idx on public.opportunities (response_deadline);
create index opportunities_search_idx on public.opportunities using gin (search_vector);
create index opportunities_skills_idx on public.opportunities using gin (skills);

create table public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index opportunity_documents_opp_idx on public.opportunity_documents (opportunity_id);

create table public.opportunity_sources (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  source_id uuid not null references public.external_sources (id) on delete restrict,
  external_id text,
  original_url text not null check (original_url ~* '^https?://'),
  source_published_at date,
  imported_at timestamptz not null default now(),
  last_verified_at timestamptz,
  verification_status text not null default 'VERIFIED' check (verification_status in ('VERIFIED', 'UNVERIFIABLE', 'REMOVED_AT_SOURCE')),
  imported_by uuid references public.users (id) on delete set null,
  unique (source_id, external_id)
);

-- -----------------------------------------------------------------------------
-- Manifestations d'intérêt, réponses, pipeline
-- -----------------------------------------------------------------------------
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  message text check (message is null or char_length(message) <= 2000),
  status public.interest_status not null default 'PENDING',
  buyer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, company_id)
);
create index interests_company_idx on public.interests (company_id);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  submitted_by uuid references public.users (id) on delete set null,
  message text not null check (char_length(message) between 10 and 5000),
  proposal_text text check (proposal_text is null or char_length(proposal_text) <= 20000),
  price_amount numeric(14, 2) check (price_amount is null or price_amount >= 0),
  price_currency text not null default 'EUR',
  price_details text,
  lead_time text,
  valid_until date,
  additional_info text,
  status public.proposal_status not null default 'SUBMITTED',
  buyer_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, company_id)
);
create index proposals_company_idx on public.proposals (company_id);

alter table public.opportunities
  add constraint opportunities_selected_proposal_fk
  foreign key (selected_proposal_id) references public.proposals (id) on delete set null;

create table public.proposal_documents (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.pipeline_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  stage public.pipeline_stage not null default 'DETECTED',
  notes text check (notes is null or char_length(notes) <= 5000),
  estimated_value numeric(14, 2),
  next_action text,
  next_action_at date,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, opportunity_id)
);

-- -----------------------------------------------------------------------------
-- Favoris, recherches sauvegardées, alertes
-- -----------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_target_check check (num_nonnulls(opportunity_id, company_id) = 1)
);
create unique index favorites_opp_uniq on public.favorites (user_id, opportunity_id) where opportunity_id is not null;
create unique index favorites_company_uniq on public.favorites (user_id, company_id) where company_id is not null;

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  scope text not null default 'OPPORTUNITIES' check (scope in ('OPPORTUNITIES', 'COMPANIES')),
  query jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sector_slug text references public.sectors (slug),
  department_code text references public.departments (code),
  type public.opportunity_type,
  keywords text,
  frequency public.alert_frequency not null default 'DAILY',
  is_active boolean not null default true,
  last_sent_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);
create index alerts_active_idx on public.alerts (is_active, frequency);

-- -----------------------------------------------------------------------------
-- Messagerie
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  buyer_company_id uuid not null references public.companies (id) on delete cascade,
  supplier_company_id uuid not null references public.companies (id) on delete cascade,
  subject text,
  last_message_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_companies check (buyer_company_id <> supplier_company_id)
);
create unique index conversations_uniq on public.conversations (opportunity_id, buyer_company_id, supplier_company_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_user_id uuid references public.users (id) on delete set null,
  sender_company_id uuid not null references public.companies (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  attachment_path text,
  attachment_name text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Notifications & emails
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  to_email text not null,
  template text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_status not null default 'PENDING',
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_status_idx on public.email_outbox (status, created_at);

-- -----------------------------------------------------------------------------
-- Modération, signalements, audit
-- -----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('SPAM', 'FRAUD', 'INAPPROPRIATE', 'FALSE_INFO', 'COPYRIGHT', 'OTHER')),
  details text check (details is null or char_length(details) <= 2000),
  status public.report_status not null default 'OPEN',
  resolved_by uuid references public.users (id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.users (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  action public.moderation_action_type not null,
  reason text,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Analytics (sans données personnelles : pas d'IP, pas d'email)
-- -----------------------------------------------------------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name ~ '^[a-z_]{3,60}$'),
  user_id uuid references public.users (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events (event_name, created_at desc);

-- -----------------------------------------------------------------------------
-- Limitation de débit & paramètres
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  company text,
  subject text not null check (char_length(subject) between 2 and 200),
  message text not null check (char_length(message) between 10 and 5000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
