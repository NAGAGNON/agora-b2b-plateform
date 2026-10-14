-- Veille commerciale par e-mail : préférences des utilisateurs, éditions (lancement, lundi,
-- vendredi, quotidienne), envois individuels, suivi (ouvertures, clics, désinscriptions) et
-- liste d'exclusion. Aucune donnée existante n'est modifiée.

create table if not exists public.veille_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  -- TWICE_WEEKLY : lundi et vendredi ; DAILY : alertes quotidiennes ; NONE : aucune veille
  frequency text not null default 'TWICE_WEEKLY' check (frequency in ('TWICE_WEEKLY', 'DAILY', 'NONE')),
  sectors text[] not null default '{}',
  regions text[] not null default '{}',
  types public.opportunity_type[] not null default '{}',
  keywords text[] not null default '{}',
  -- Accord explicite (case non pré-cochée) : date et origine
  consent_at timestamptz,
  consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint veille_keywords_limit check (cardinality(keywords) <= 20),
  constraint veille_sectors_limit check (cardinality(sectors) <= 40),
  constraint veille_regions_limit check (cardinality(regions) <= 20)
);

alter table public.veille_preferences enable row level security;
drop policy if exists veille_prefs_own_select on public.veille_preferences;
create policy veille_prefs_own_select on public.veille_preferences for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists veille_prefs_own_insert on public.veille_preferences;
create policy veille_prefs_own_insert on public.veille_preferences for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists veille_prefs_own_update on public.veille_preferences;
create policy veille_prefs_own_update on public.veille_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.veille_preferences to authenticated;

-- Liste d'exclusion : désinscriptions, adresses invalides, plaintes. Jamais réinscrit automatiquement.
create table if not exists public.veille_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null check (reason in ('UNSUBSCRIBE', 'BOUNCE', 'COMPLAINT', 'ADMIN')),
  created_at timestamptz not null default now()
);
alter table public.veille_suppressions enable row level security;
drop policy if exists veille_suppressions_admin on public.veille_suppressions;
create policy veille_suppressions_admin on public.veille_suppressions for select to authenticated using (public.is_admin());
grant select on public.veille_suppressions to authenticated;

create table if not exists public.veille_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('LAUNCH', 'MONDAY', 'FRIDAY', 'DAILY')),
  edition_date date not null,
  status text not null default 'BUILDING' check (status in ('BUILDING', 'SENDING', 'PAUSED', 'SENT', 'CANCELLED', 'EMPTY')),
  recipients int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (kind, edition_date)
);
alter table public.veille_campaigns enable row level security;
drop policy if exists veille_campaigns_admin on public.veille_campaigns;
create policy veille_campaigns_admin on public.veille_campaigns for select to authenticated using (public.is_admin());
grant select on public.veille_campaigns to authenticated;

create table if not exists public.veille_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.veille_campaigns (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  email text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'BOUNCED')),
  subject text,
  opportunity_ids uuid[] not null default '{}',
  personalized boolean not null default false,
  token uuid not null unique default gen_random_uuid(),
  attempts int not null default 0,
  error text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);
create index if not exists veille_sends_user_idx on public.veille_sends (user_id, sent_at desc);
create index if not exists veille_sends_status_idx on public.veille_sends (status) where status in ('PENDING', 'SENDING');
alter table public.veille_sends enable row level security;
drop policy if exists veille_sends_admin on public.veille_sends;
create policy veille_sends_admin on public.veille_sends for select to authenticated using (public.is_admin());
grant select on public.veille_sends to authenticated;

create table if not exists public.veille_events (
  id bigint generated always as identity primary key,
  send_id uuid not null references public.veille_sends (id) on delete cascade,
  type text not null check (type in ('OPEN', 'CLICK', 'UNSUBSCRIBE')),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists veille_events_send_idx on public.veille_events (send_id, type);
create index if not exists veille_events_opp_idx on public.veille_events (opportunity_id) where opportunity_id is not null;
alter table public.veille_events enable row level security;
drop policy if exists veille_events_admin on public.veille_events;
create policy veille_events_admin on public.veille_events for select to authenticated using (public.is_admin());
grant select on public.veille_events to authenticated;

-- Destinataires possibles de la veille (serveur uniquement) : compte actif et réel, adresse
-- confirmée, accord explicite (préférence enregistrée avec accord, ou case « actualités »
-- cochée à l'inscription ou dans le profil), pas de refus ni d'exclusion.
create or replace function public.veille_audience()
returns table (
  user_id uuid, email text, full_name text, frequency text, sectors text[], regions text[], types public.opportunity_type[], keywords text[],
  company_name text, company_sectors text[], company_region text, consent text
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, lower(u.email), u.full_name,
         coalesce(p.frequency, 'TWICE_WEEKLY'),
         coalesce(p.sectors, '{}'), coalesce(p.regions, '{}'), coalesce(p.types, '{}'), coalesce(p.keywords, '{}'),
         c.name, coalesce(cp.sectors, '{}'), c.region,
         case when p.consent_at is not null then 'veille' else 'actualites' end
  from public.users u
  join auth.users au on au.id = u.id and au.email_confirmed_at is not null
  left join public.veille_preferences p on p.user_id = u.id
  left join lateral (
    select co.id, co.name, co.region from public.company_members m join public.companies co on co.id = m.company_id
    where m.user_id = u.id and co.is_demo = false order by m.created_at limit 1
  ) c on true
  left join public.company_profiles cp on cp.company_id = c.id
  where u.status = 'ACTIVE'
    and u.is_demo = false
    and coalesce(p.frequency, 'TWICE_WEEKLY') <> 'NONE'
    and (p.consent_at is not null or (p.user_id is null and u.marketing_consent) or (p.user_id is not null and p.consent_at is null and u.marketing_consent))
    and not exists (select 1 from public.veille_suppressions s where s.email = lower(u.email))
    and not exists (select 1 from public.outreach_suppressions s where s.kind = 'EMAIL' and s.value = lower(u.email) and s.reason in ('BOUNCE', 'COMPLAINT'));
$$;
revoke execute on function public.veille_audience() from public, anon, authenticated;
grant execute on function public.veille_audience() to service_role;

insert into public.platform_settings (key, value, description)
values ('veille', '{"enabled": false, "launch_date": "2026-10-15", "daily_cap": 150}'::jsonb,
        'Veille commerciale par e-mail : envois automatiques (activés après un envoi test), date du lancement, plafond quotidien')
on conflict (key) do nothing;
