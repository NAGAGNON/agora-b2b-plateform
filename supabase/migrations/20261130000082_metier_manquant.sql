-- Offres sans métier (≈ 860 ouvertes) : invisibles dans toute recherche par métier. Un tri automatique
-- (titre + acheteur) les range dans un des métiers du site ; quand aucun ne convient, l'offre reste sans
-- métier. Cette colonne retient qu'une offre a déjà été examinée, pour ne jamais la retraiter.
alter table public.opportunities add column if not exists sector_checked_at timestamptz;
create index if not exists opportunities_sector_unchecked_idx on public.opportunities (published_at desc)
  where sector_slug is null and sector_checked_at is null and status = 'PUBLISHED';
