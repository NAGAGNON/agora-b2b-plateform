-- Offre « Visibilité » : palier intensif (80 entreprises par jour) et durée de 60 jours.
alter table public.visibility_boosts drop constraint if exists visibility_boosts_daily_presentations_check;
alter table public.visibility_boosts add constraint visibility_boosts_daily_presentations_check check (daily_presentations in (0, 5, 10, 20, 40, 80));
alter table public.visibility_boosts drop constraint if exists visibility_boosts_duration_days_check;
alter table public.visibility_boosts add constraint visibility_boosts_duration_days_check check (duration_days in (7, 14, 30, 60));
alter table public.visibility_boosts drop constraint if exists visibility_boosts_featured_days_check;
alter table public.visibility_boosts add constraint visibility_boosts_featured_days_check check (featured_days in (0, 7, 14, 30, 60));
