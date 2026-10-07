-- APProch (projets d'achats publics) : correspondance des champs alignée sur le jeu de
-- données réel (data.economie.gouv.fr, « projets-dachats-publics »). La source reste
-- inactive et en revue juridique : seule sa configuration de test est corrigée.
update public.external_sources
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'orderBy', 'date_previsionnelle_de_publication desc',
  'fieldMap', jsonb_build_object(
    'id', 'code',
    'title', 'libelle',
    'description', 'description',
    'published', 'date_previsionnelle_de_publication',
    'deadline', 'date_cible_de_remise_des_offres',
    'department', 'departement_s_d_execution_du_marche',
    'cpv', 'code_s_cpv',
    'url', 'lien_vers_la_consultation'
  )
),
notes = 'Projets d''achats PRÉVISIONNELS (non engageants). Champs vérifiés sur les données réelles (oct. 2026) : le lien vers la consultation est le plus souvent absent et le nom de l''acheteur n''est pas fourni (SIREN seulement) ; les projets sans lien sont écartés. Activation déconseillée en l''état.'
where code = 'approch';
