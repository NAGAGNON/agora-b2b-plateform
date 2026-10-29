-- Listes publiques « opportunités similaires » (secteur + département, annonces ouvertes, plus récentes
-- d'abord) : index dédié pour qu'elles restent instantanées même quand la base est occupée par les
-- envois de prospection (rafraîchissements du cache abandonnés au bout de 8 s auparavant).
create index if not exists opportunities_open_sector_dept_idx
  on public.opportunities (sector_slug, department_code, published_at desc)
  where status = 'PUBLISHED';
