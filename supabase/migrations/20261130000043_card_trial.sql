-- Essai de 7 jours avec carte bancaire (Stripe), prévu pour le lancement payant. INACTIF : il ne
-- s'active que sur décision du propriétaire, une fois la société, les CGU/CGV et Stripe (LIVE)
-- validés. Tant qu'il est inactif, la page /essai n'est visible que de l'équipe (aperçu).
insert into public.platform_settings (key, value, description)
values ('billing.card_trial', '{"enabled": false, "days": 7}'::jsonb,
        'Essai de 7 jours avec carte bancaire à l''inscription (lancement payant) : inactif tant que le propriétaire ne l''a pas validé')
on conflict (key) do nothing;
