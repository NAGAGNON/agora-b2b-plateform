-- Recherche d'adresses : autres noms publics de l'entreprise (sigle, enseignes, nom commercial —
-- registre SIRENE), utilisés pour deviner le site officiel. Aucune donnée existante modifiée.
alter table public.outreach_prospects add column if not exists alt_names text[] not null default '{}';
alter table public.outreach_prospects add column if not exists alt_names_checked_at timestamptz;
