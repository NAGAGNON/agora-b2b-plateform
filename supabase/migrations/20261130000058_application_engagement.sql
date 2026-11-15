-- Engagement réel d'une candidature : « Oui, je prépare » ouvre le dossier ; le travail commence à la
-- première action concrète (étape ou pièce cochée, mémoire rédigé, note au journal, dépôt).
alter table public.pipeline_items add column if not exists work_started_at timestamptz;
grant insert (work_started_at) on public.pipeline_items to authenticated;
grant update (work_started_at) on public.pipeline_items to authenticated;

-- Reprise de l'existant : dossiers où un travail a déjà été fait
update public.pipeline_items
   set work_started_at = coalesce(submitted_at::timestamptz, updated_at)
 where work_started_at is null
   and (cardinality(guide_done) > 0 or cardinality(docs_done) > 0 or nullif(trim(coalesce(draft, '')), '') is not null
        or stage in ('RESPONSE_SENT', 'DISCUSSION', 'NEGOTIATION', 'WON', 'LOST'));

-- Consultation d'une fiche de candidature (rien n'est enregistré côté candidature) : mesurée comme événement
create or replace function public.track_event(p_event_name text, p_properties jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_event_name not in (
    'view_opportunity', 'search_opportunities', 'create_account', 'create_company', 'publish_opportunity',
    'express_interest', 'submit_proposal', 'save_favorite', 'create_alert', 'contact_company',
    'source_outbound_clicked', 'profile_completed', 'view_company', 'search_companies',
    'need_message_click', 'need_share_click', 'cta_click', 'view_application'
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
