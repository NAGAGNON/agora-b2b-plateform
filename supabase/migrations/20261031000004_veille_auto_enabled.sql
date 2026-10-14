-- Veille activée automatiquement, à la demande du propriétaire (sans envoi test préalable).
-- Garde-fous inchangés : rien ne part sans service d'envoi configuré, accord explicite des
-- destinataires, annonces vérifiées avant l'envoi, plafond quotidien et désinscription en un clic.
update public.platform_settings
set value = value || '{"enabled": true}'::jsonb, updated_at = now()
where key = 'veille';
