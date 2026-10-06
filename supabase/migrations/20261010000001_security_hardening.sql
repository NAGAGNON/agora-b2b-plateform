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

-- -----------------------------------------------------------------------------
-- Registre des sources potentielles (non collectées) : visibles dans
-- l'administration avec la raison pour laquelle elles ne sont pas intégrées.
-- -----------------------------------------------------------------------------
insert into public.external_sources (code, name, base_url, description, license, terms_url, status, import_method, connector, is_active, notes) values
  ('place', 'PLACE — plateforme des achats de l''État', 'https://www.marches-publics.gouv.fr',
   'Profil d''acheteur de l''État : consultations en cours et dossiers de consultation.',
   'Aucune licence de réutilisation ni API publique documentée pour les consultations en cours',
   'https://www.marches-publics.gouv.fr', 'DRAFT', 'MANUAL', 'manual', false,
   'Non intégrée : pas d''accès officiel automatisable (collecte = scraping, exclu). Les avis au-dessus des seuils de publicité sont publiés au BOAMP et/ou au JOUE, donc déjà couverts. Piste : convention d''échange de données.'),
  ('megalis', 'Mégalis Bretagne — salle des marchés régionale', 'https://marches.megalis.bretagne.bzh',
   'Plateforme régionale de dématérialisation des marchés publics bretons.',
   'Données essentielles (marchés attribués) en licence ouverte ; pas d''API publique pour les consultations en cours',
   'https://www.data.gouv.fr/datasets/5f4f4f8910f4b55843deae51', 'DRAFT', 'MANUAL', 'manual', false,
   'Non intégrée pour les consultations en cours (pas d''accès officiel). Les avis soumis à publicité sont repris au BOAMP. Piste : partenariat avec Mégalis Bretagne.'),
  ('decp', 'DECP — données essentielles de la commande publique', 'https://www.data.gouv.fr/datasets/donnees-essentielles-de-la-commande-publique-consolidees-format-tabulaire/',
   'Marchés publics ATTRIBUÉS (acheteur, titulaire, montant, durée), consolidés quotidiennement.',
   'Licence Ouverte / Open Licence 2.0 (Etalab)',
   'https://www.data.gouv.fr/datasets/donnees-essentielles-de-la-commande-publique-consolidees-format-tabulaire/', 'DRAFT', 'API', 'manual', false,
   'Réutilisable, mais ce ne sont pas des opportunités ouvertes : réservé à une future fonction « acheteurs actifs / historique des marchés ».')
on conflict (code) do nothing;
