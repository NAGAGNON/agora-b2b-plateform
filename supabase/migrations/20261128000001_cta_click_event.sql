-- Mesure de la conversion de l'accueil : clics sur les appels à l'action (sans donnée personnelle).
-- Ajoute l'événement « cta_click » à la liste des événements acceptés ; le reste est inchangé.
create or replace function public.track_event(p_event_name text, p_properties jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_event_name not in (
    'view_opportunity', 'search_opportunities', 'create_account', 'create_company', 'publish_opportunity',
    'express_interest', 'submit_proposal', 'save_favorite', 'create_alert', 'contact_company',
    'source_outbound_clicked', 'profile_completed', 'view_company', 'search_companies',
    'need_message_click', 'need_share_click', 'cta_click'
  ) then
    raise exception 'Événement inconnu' using errcode = '22023';
  end if;
  if pg_column_size(p_properties) > 2000 then
    raise exception 'Propriétés trop volumineuses' using errcode = '22023';
  end if;
  insert into public.analytics_events (event_name, user_id, properties)
  values (p_event_name, auth.uid(), coalesce(p_properties, '{}'::jsonb));
end;
$$;
