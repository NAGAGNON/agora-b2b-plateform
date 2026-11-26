-- Offre Gratuit vraiment limitée (fondateur, 26/11) : appliquée seulement au lancement, rien ne change avant.
-- Jamais limité : recherche, lecture des offres, lien vers l'annonce officielle.
insert into public.platform_settings (key, value, description)
values ('billing.free_limits',
  '{"credits": 2, "alerts": 1, "alert_frequency": "weekly", "assistant_questions_month": 3, "contacts_month": 3, "favorites": 3, "full_brief": false, "templates": false, "early_needs": false, "result_watch": false, "members": 1, "pro_contacts_month": 30}'::jsonb,
  'Limites de l''offre Gratuit et de Pro appliquées au lancement de l''offre payante (éteintes avant)')
on conflict (key) do update set value = excluded.value;
