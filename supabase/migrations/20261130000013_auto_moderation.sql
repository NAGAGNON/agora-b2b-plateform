-- Validation automatique : besoins publiés (relecture automatique) et vérification des entreprises (SIREN
-- contrôlé dans l'annuaire officiel). Réservé au serveur (service_role) ; la modération manuelle reste possible.

create or replace function public.auto_moderate_opportunity(
  p_opportunity_id uuid, p_action public.moderation_action_type, p_reason text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare o record; v_new public.opportunity_status;
begin
  if p_action not in ('APPROVE', 'REQUEST_CHANGES') then
    raise exception 'Action automatique non autorisée' using errcode = '22023';
  end if;
  select * into o from public.opportunities where id = p_opportunity_id for update;
  -- Déjà traité (par l'équipe ou un autre passage) : rien à faire
  if o.id is null or o.status <> 'PENDING_REVIEW' then return false; end if;
  if p_action = 'REQUEST_CHANGES' and coalesce(trim(p_reason), '') = '' then
    raise exception 'Un motif est obligatoire' using errcode = '22023';
  end if;
  v_new := case p_action when 'APPROVE' then 'PUBLISHED' else 'CHANGES_REQUESTED' end::public.opportunity_status;
  perform public.trusted();
  update public.opportunities set status = v_new, moderation_note = nullif(trim(p_reason), '') where id = p_opportunity_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (null, 'OPPORTUNITY', p_opportunity_id, p_action, 'Validation automatique : ' || coalesce(p_reason, ''));
  perform public.log_audit('moderation.auto.' || lower(p_action::text), 'opportunity', p_opportunity_id::text,
    jsonb_build_object('reason', p_reason, 'from', o.status, 'to', v_new));
  if v_new = 'PUBLISHED' then
    insert into public.analytics_events (event_name, user_id, company_id, properties)
    values ('publish_opportunity', o.created_by, o.company_id, jsonb_build_object('opportunity_id', o.id, 'type', o.type, 'auto', true));
    perform public.dispatch_immediate_alerts(p_opportunity_id);
  end if;
  return true;
end;
$$;
revoke all on function public.auto_moderate_opportunity(uuid, public.moderation_action_type, text) from public, anon, authenticated;
grant execute on function public.auto_moderate_opportunity(uuid, public.moderation_action_type, text) to service_role;

create or replace function public.auto_verify_company(p_company_id uuid, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_note), '') = '' then raise exception 'Preuve de vérification obligatoire' using errcode = '22023'; end if;
  update public.companies set verified_at = now(), verified_by = null, verification_note = trim(p_note)
   where id = p_company_id and verified_at is null;
  if not found then return false; end if;
  perform public.log_audit('admin.company_verified_auto', 'company', p_company_id::text, jsonb_build_object('note', p_note));
  return true;
end;
$$;
revoke all on function public.auto_verify_company(uuid, text) from public, anon, authenticated;
grant execute on function public.auto_verify_company(uuid, text) to service_role;
