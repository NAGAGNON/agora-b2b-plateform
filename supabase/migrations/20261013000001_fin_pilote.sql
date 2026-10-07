-- Libellés publics : la plateforme n'est plus présentée comme un pilote.
update public.plans set label = 'Gratuit', description = 'Accès complet gratuit.' where code = 'PILOT';
update public.plans set description = 'Offre gratuite limitée (à définir).' where code = 'FREE';
update public.platform_settings
  set value = jsonb_set(value, '{label}', '"Bretagne — Finistère"'), description = 'Zone de lancement'
  where key = 'pilot';
