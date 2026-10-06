-- =============================================================================
-- Durcissement : les fonctions métier privilégiées ne sont plus exécutables par
-- le rôle anonyme (elles refusaient déjà l'appel faute de session ; défense en
-- profondeur). Restent accessibles aux visiteurs : les fonctions d'aide utilisées
-- par les politiques RLS publiques, la recherche et track_event (statistiques
-- anonymes, liste fermée d'événements).
-- =============================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in (
        'can_view_opportunity', 'can_view_proposal', 'is_admin', 'is_staff', 'is_super_admin',
        'is_company_active', 'is_company_admin', 'is_company_member', 'is_conversation_participant',
        'is_opportunity_owner', 'is_active_user', 'my_company_ids', 'track_event'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Rapprochement opportunité / alerte : usage interne (tâches serveur) uniquement.
revoke execute on function public.opportunity_matches_alert(uuid, uuid) from authenticated;
grant execute on function public.opportunity_matches_alert(uuid, uuid) to service_role;
