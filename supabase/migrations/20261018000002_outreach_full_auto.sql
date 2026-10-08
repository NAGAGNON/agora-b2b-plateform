-- LinkProB2B Outreach : fonctionnement entièrement automatique, à la demande explicite du propriétaire
-- (« chaque jour : recherche d'entreprises, puis des adresses e-mail, puis envoi direct »).
-- Coupure d'urgence toujours possible : OUTREACH_SEND_ENABLED=false (Vercel) ou Paramètres.
update public.outreach_settings
set dry_run = false,
    require_validation = false,
    discovery_enabled = true,
    enrichment_enabled = true,
    updated_at = now()
where id;
