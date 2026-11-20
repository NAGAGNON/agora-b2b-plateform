-- Résultat d'un marché détecté automatiquement après le dépôt (avis de résultat publié au BOAMP,
-- relié à l'avis de départ) : entreprise retenue, date et lien vers l'avis officiel.
alter table public.pipeline_items
  add column if not exists award jsonb,
  add column if not exists award_checked_at timestamptz;

comment on column public.pipeline_items.award is 'Avis de résultat officiel détecté : { idweb, titulaires[], date, url, cancelled }';
comment on column public.pipeline_items.award_checked_at is 'Dernière recherche de l''avis de résultat (une fois par jour au plus)';
