-- Campagnes de visibilité : l'entreprise choisit son objectif et rédige son annonce (titre, 3 points forts,
-- court texte), pré-remplie depuis sa fiche. L'annonce est relue par l'équipe avant le premier e-mail
-- (les e-mails partent au nom de LinkProB2B) ; sans annonce personnalisée, la fiche est présentée comme avant.
alter table public.visibility_boosts
  add column if not exists objective text check (objective is null or objective in ('CLIENTS', 'SOUS_TRAITANTS', 'PARTENAIRES')),
  add column if not exists ad_title text check (ad_title is null or char_length(ad_title) between 5 and 90),
  add column if not exists ad_points text[] not null default '{}' check (cardinality(ad_points) <= 3),
  add column if not exists ad_text text check (ad_text is null or char_length(ad_text) <= 400),
  add column if not exists ad_status text check (ad_status is null or ad_status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  add column if not exists ad_review_note text check (ad_review_note is null or char_length(ad_review_note) <= 500),
  add column if not exists ad_reviewed_at timestamptz;
create index if not exists visibility_boosts_ad_review_idx on public.visibility_boosts (ad_status) where ad_status = 'PENDING_REVIEW';
