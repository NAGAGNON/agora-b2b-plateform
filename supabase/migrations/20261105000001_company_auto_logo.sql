-- Logo récupéré automatiquement sur le site officiel de l'entreprise (à défaut de logo déposé).
-- logo_source : 'AUTO' si le logo vient du site, null s'il a été déposé par l'entreprise.
-- logo_auto_checked_at / logo_auto_site : dernière recherche (une seule par adresse de site, jamais après un retrait).
alter table public.companies add column if not exists logo_source text check (logo_source in ('AUTO'));
alter table public.companies add column if not exists logo_auto_checked_at timestamptz;
alter table public.companies add column if not exists logo_auto_site text;
alter table public.companies add column if not exists logo_auto_note text;
create index if not exists companies_logo_todo_idx on public.companies (created_at) where logo_path is null and logo_auto_checked_at is null;
