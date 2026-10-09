-- =============================================================================
-- Corrections de l'audit (additif, aucune donnée existante modifiée)
-- 1. Verrou d'envoi Outreach : un seul envoi à la fois (tâches qui se chevauchent).
-- 2. Fonctions d'abonnement : plus exécutables par les visiteurs anonymes.
-- =============================================================================

alter table public.outreach_settings add column if not exists send_lock_until timestamptz;

revoke execute on function public.company_plan(uuid) from public, anon;
revoke execute on function public.user_plan(uuid) from public, anon;
grant execute on function public.company_plan(uuid) to authenticated, service_role;
grant execute on function public.user_plan(uuid) to authenticated, service_role;
