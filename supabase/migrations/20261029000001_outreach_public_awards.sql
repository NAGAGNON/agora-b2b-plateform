-- Outreach : priorité aux entreprises qui remportent des marchés publics.
-- Nombre de marchés publics attribués à l'entreprise (titulaire), d'après les données
-- essentielles de la commande publique (DECP, data.economie.gouv.fr, Licence Ouverte 2.0).
-- Ajout de colonnes uniquement : aucune donnée existante modifiée.
alter table public.outreach_prospects add column if not exists public_awards_count int check (public_awards_count is null or public_awards_count >= 0);
alter table public.outreach_prospects add column if not exists public_awards_checked_at timestamptz;

create index if not exists outreach_prospects_awards_idx on public.outreach_prospects (public_awards_count desc nulls last);
create index if not exists outreach_prospects_awards_check_idx on public.outreach_prospects (public_awards_checked_at nulls first) where siren is not null;
