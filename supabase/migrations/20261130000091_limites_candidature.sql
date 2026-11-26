-- Fiche de candidature en Gratuit : utilisable avec des limites (fondateur, 26/11), appliquées au lancement.
update public.platform_settings
   set value = value || '{"notes_per_application": 3, "journal_days": 7, "deadline_reminders": 1, "memoir_template": false, "letter_templates": false, "exports": false, "pro_members": 2}'::jsonb
 where key = 'billing.free_limits';
