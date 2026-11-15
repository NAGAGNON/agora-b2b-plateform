-- Analyste du lundi : bilan de la semaine écoulée (lundi → dimanche), comparé à la semaine d'avant.
-- Une ligne par semaine (clé : lundi de la semaine analysée). Lecture réservée aux administrateurs.
create table if not exists public.weekly_reviews (
  week_start date primary key,
  generated_at timestamptz not null default now(),
  facts jsonb not null,
  summary jsonb,
  model text,
  error text,
  emailed_at timestamptz
);
alter table public.weekly_reviews enable row level security;
drop policy if exists weekly_reviews_admin on public.weekly_reviews;
create policy weekly_reviews_admin on public.weekly_reviews for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.weekly_reviews from anon, authenticated;
