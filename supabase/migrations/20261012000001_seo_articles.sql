-- =============================================================================
-- Analyses de marché (articles SEO) rédigées automatiquement à partir des données
-- réelles de la plateforme (opportunités publiées BOAMP / TED / internes).
-- -----------------------------------------------------------------------------
-- facts : le jeu de données exact transmis au modèle (traçabilité, contrôle des
-- chiffres). Un article dont les chiffres ne sont pas tous retrouvés dans facts
-- reste en brouillon (validation_note) et n'est jamais publié automatiquement.
-- Écriture uniquement côté serveur (clé secrète) ; lecture publique des articles publiés.
-- =============================================================================

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  topic_key text not null unique,
  title text not null check (char_length(title) between 10 and 160),
  description text not null check (char_length(description) between 30 and 300),
  body jsonb not null,
  facts jsonb not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  validation_note text,
  model text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_published_idx on public.articles (status, published_at desc);

alter table public.articles enable row level security;
create policy articles_public_read on public.articles for select using (status = 'PUBLISHED' or public.is_staff());
revoke insert, update, delete on public.articles from anon, authenticated;

-- Réglages par défaut (lecture publique sans conséquence : aucun secret)
insert into public.platform_settings (key, value, description)
values ('seo', '{"articles_enabled": true, "articles_auto_publish": true, "articles_per_day": 1}'::jsonb,
        'Rédaction automatique des analyses de marché')
on conflict (key) do nothing;
