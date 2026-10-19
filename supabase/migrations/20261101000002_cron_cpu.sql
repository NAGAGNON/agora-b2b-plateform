-- Temps de calcul des tâches automatiques (Vercel facture le « temps CPU actif » : 4 h par mois
-- seulement sur l'offre gratuite, au-delà le site est mis en pause). Une ligne par passage :
-- sert au bilan du soir et au plafond quotidien qui ralentit les tâches lourdes avant la limite.
create table if not exists public.cron_cpu_runs (
  id bigint generated always as identity primary key,
  task text not null check (char_length(task) between 1 and 80),
  started_at timestamptz not null default now(),
  cpu_ms int not null check (cpu_ms >= 0),
  wall_ms int not null check (wall_ms >= 0)
);
create index if not exists cron_cpu_runs_started_idx on public.cron_cpu_runs (started_at desc);
alter table public.cron_cpu_runs enable row level security;
drop policy if exists cron_cpu_runs_admin on public.cron_cpu_runs;
create policy cron_cpu_runs_admin on public.cron_cpu_runs for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.cron_cpu_runs from anon, authenticated;
