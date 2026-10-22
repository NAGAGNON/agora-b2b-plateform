-- Alertes par e-mail sans compte (« Recevoir les marchés similaires ») : un visiteur laisse seulement
-- son adresse depuis une fiche d'opportunité ou une page métier × département. Double confirmation
-- obligatoire (aucun envoi avant le clic sur le lien de confirmation), désinscription en un clic.
-- Données accessibles au seul serveur (RLS activée, aucune politique) ; aucune donnée existante modifiée.
create table if not exists public.alert_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  sector_slug text,
  department_code text,
  region text,
  source_opportunity_id uuid references public.opportunities (id) on delete set null,
  source_path text,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED')),
  consent_text text not null,
  created_at timestamptz not null default now(),
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz,
  emails_sent int not null default 0
);
create unique index if not exists alert_leads_unique_idx on public.alert_leads (email, coalesce(sector_slug, ''), coalesce(department_code, ''));
create index if not exists alert_leads_status_idx on public.alert_leads (status, last_sent_at);
alter table public.alert_leads enable row level security;
revoke all on public.alert_leads from anon, authenticated;
