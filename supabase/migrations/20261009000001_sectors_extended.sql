-- =============================================================================
-- Secteurs complémentaires, identifiés à partir des annonces réelles BOAMP / TED
-- (travaux, espaces verts, assurances, communication, restauration).
-- =============================================================================
insert into public.sectors (slug, label, description, is_pilot_priority, sort_order) values
  ('travaux-btp', 'Travaux publics et bâtiment', 'Gros œuvre, génie civil, voirie et réseaux, second œuvre, réhabilitation.', false, 17),
  ('espaces-verts', 'Espaces verts et paysage', 'Entretien et aménagement paysager, élagage, espaces naturels.', false, 18),
  ('assurances-finance', 'Assurances et services financiers', 'Assurances, courtage, services bancaires et financiers.', false, 19),
  ('communication-evenementiel', 'Communication et événementiel', 'Publicité, création graphique, impression, photographie, événements.', false, 20),
  ('restauration-alimentation', 'Restauration et alimentation', 'Restauration collective, denrées alimentaires, traiteur.', false, 21)
on conflict (slug) do nothing;
