-- Recherche d'adresses reportée (service de recherche saturé) : l'entreprise reste « à rechercher »,
-- mais n'est reprise qu'après ce délai. Sans lui, les mêmes entreprises étaient recherchées à chaque
-- passage et occupaient tout le temps disponible, au détriment des nouvelles.
alter table public.outreach_prospects
  add column if not exists enrichment_deferred_until timestamptz;
