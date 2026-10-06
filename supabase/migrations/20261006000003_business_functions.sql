-- =============================================================================
-- LinkProB2B — Fonctions métier (RPC)
-- Toutes les fonctions « security definer » vérifient explicitement les droits
-- de l'appelant (auth.uid()) avant d'agir, et journalisent les actions
-- importantes dans audit_logs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Outils internes (non exposés à l'API)
-- -----------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- nettoyage opportuniste des fenêtres anciennes
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_count <= p_max;
end;
$$;

create or replace function public.enforce_rate_limit(p_scope text, p_max int, p_window_seconds int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.hit_rate_limit(p_scope || ':' || coalesce(auth.uid()::text, 'anon'), p_max, p_window_seconds) then
    raise exception 'Trop de requêtes, veuillez réessayer plus tard' using errcode = 'P0429';
  end if;
end;
$$;

create or replace function public.notify_user(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text, p_send_email boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  select id, email, notify_email, status into u from public.users where id = p_user_id;
  if u.id is null or u.status <> 'ACTIVE' then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
  if p_send_email and u.notify_email and u.email <> '' then
    insert into public.email_outbox (user_id, to_email, template, subject, payload)
    values (p_user_id, u.email, 'notification', p_title,
            jsonb_build_object('title', p_title, 'body', p_body, 'link', p_link, 'type', p_type));
  end if;
end;
$$;

create or replace function public.notify_company(
  p_company_id uuid, p_type text, p_title text, p_body text, p_link text,
  p_exclude_user uuid default null, p_send_email boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  for m in select user_id from public.company_members where company_id = p_company_id loop
    if p_exclude_user is null or m.user_id <> p_exclude_user then
      perform public.notify_user(m.user_id, p_type, p_title, p_body, p_link, p_send_email);
    end if;
  end loop;
end;
$$;

create or replace function public.notify_staff(p_type text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  for s in select id from public.users
           where platform_role in ('MODERATOR', 'ADMIN', 'SUPER_ADMIN') and status = 'ACTIVE' loop
    perform public.notify_user(s.id, p_type, p_title, p_body, p_link, false);
  end loop;
end;
$$;

create or replace function public.require_active_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'Compte inactif ou suspendu' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.require_staff()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Action réservée à la modération' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Action réservée aux administrateurs' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.trusted()
returns void language sql set search_path = '' as $$
  select set_config('linkpro.trusted', 'on', true);
$$;

create or replace function public.slugify(p_text text)
returns text language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p_text, ''),
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŒœÆæ',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyOoAa')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Notifications automatiques lors des changements de statut d'une opportunité
-- -----------------------------------------------------------------------------
create or replace function public.opportunity_status_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_link text := '/dashboard/opportunites/' || new.id;
begin
  if new.status is not distinct from old.status or new.origin = 'EXTERNAL' then
    return new;
  end if;
  if new.status = 'PENDING_REVIEW' then
    perform public.notify_staff('moderation_pending', 'Nouvelle opportunité à valider',
      new.title, '/admin/moderation');
  elsif new.status = 'PUBLISHED' then
    perform public.notify_company(new.company_id, 'opportunity_published', 'Votre besoin est publié',
      new.title, v_link);
  elsif new.status = 'CHANGES_REQUESTED' then
    perform public.notify_company(new.company_id, 'opportunity_changes_requested',
      'Modifications demandées par la modération', coalesce(new.moderation_note, new.title), v_link);
  elsif new.status = 'REJECTED' then
    perform public.notify_company(new.company_id, 'opportunity_rejected', 'Publication refusée',
      coalesce(new.moderation_note, new.title), v_link);
  elsif new.status = 'SUSPENDED' then
    perform public.notify_company(new.company_id, 'opportunity_suspended', 'Opportunité suspendue',
      coalesce(new.moderation_note, new.title), v_link);
  elsif new.status = 'EXPIRED' then
    perform public.notify_company(new.company_id, 'opportunity_expired', 'Date limite atteinte',
      new.title, v_link);
  end if;
  return new;
end;
$$;

create trigger opportunities_status_notifications after update of status on public.opportunities
  for each row execute function public.opportunity_status_notifications();

create or replace function public.opportunity_submitted_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'PENDING_REVIEW' then
    perform public.notify_staff('moderation_pending', 'Nouvelle opportunité à valider', new.title, '/admin/moderation');
  end if;
  return new;
end;
$$;

create trigger opportunities_submitted_notification after insert on public.opportunities
  for each row execute function public.opportunity_submitted_notification();

-- -----------------------------------------------------------------------------
-- Alertes : correspondance opportunité ↔ alerte
-- -----------------------------------------------------------------------------
create or replace function public.opportunity_matches_alert(p_opportunity_id uuid, p_alert_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.opportunities o, public.alerts a
    where o.id = p_opportunity_id and a.id = p_alert_id
      and o.status = 'PUBLISHED'
      and (a.sector_slug is null or a.sector_slug = o.sector_slug)
      and (a.department_code is null or a.department_code = o.department_code)
      and (a.type is null or a.type = o.type)
      and (
        a.keywords is null or trim(a.keywords) = ''
        or o.search_vector @@ websearch_to_tsquery('french', a.keywords)
      )
  );
$$;

create or replace function public.dispatch_immediate_alerts(p_opportunity_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare a record; v_count int := 0; v_title text;
begin
  select title into v_title from public.opportunities where id = p_opportunity_id;
  for a in select al.* from public.alerts al
           join public.users u on u.id = al.user_id and u.status = 'ACTIVE'
           where al.is_active and al.frequency = 'IMMEDIATE' loop
    if public.opportunity_matches_alert(p_opportunity_id, a.id) then
      perform public.notify_user(a.user_id, 'alert_match',
        'Alerte « ' || a.name || ' » : nouvelle opportunité', v_title,
        '/opportunites/' || p_opportunity_id, true);
      update public.alerts set last_sent_at = now() where id = a.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Opportunités correspondant à une alerte depuis une date (pour les résumés
-- quotidiens / hebdomadaires envoyés par la tâche planifiée).
create or replace function public.alert_digest_matches(p_alert_id uuid, p_since timestamptz)
returns table (id uuid, title text, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.title, o.published_at
  from public.opportunities o
  where o.status = 'PUBLISHED' and o.published_at > p_since
    and public.opportunity_matches_alert(o.id, p_alert_id)
  order by o.published_at desc
  limit 20;
$$;

-- -----------------------------------------------------------------------------
-- Entreprises
-- -----------------------------------------------------------------------------
create or replace function public.reserved_company_slugs()
returns text[] language sql immutable set search_path = '' as $$
  select array['nouvelle', 'nouveau', 'recherche', 'admin', 'dashboard', 'api'];
$$;

create or replace function public.unique_company_slug(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare base text := public.slugify(p_name); candidate text; i int := 1;
begin
  if base = '' then base := 'entreprise'; end if;
  base := left(base, 60);
  candidate := base;
  while exists (select 1 from public.companies where slug = candidate)
     or exists (select 1 from public.sectors where slug = candidate)
     or candidate = any (public.reserved_company_slugs()) loop
    i := i + 1;
    candidate := base || '-' || i;
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_company(
  p_name text,
  p_kind public.company_kind,
  p_size public.company_size default null,
  p_city text default null,
  p_postal_code text default null,
  p_siren text default null,
  p_website text default null,
  p_tagline text default null,
  p_description text default null,
  p_sectors text[] default '{}',
  p_skills text[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_id uuid;
begin
  perform public.enforce_rate_limit('create_company', 5, 86400);
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Nom d''entreprise invalide' using errcode = '22023';
  end if;
  if p_siren is not null and p_siren <> '' and exists (select 1 from public.companies where siren = p_siren) then
    raise exception 'Une entreprise avec ce SIREN existe déjà sur LinkProB2B' using errcode = '23505';
  end if;
  insert into public.companies (slug, name, kind, size, city, postal_code, siren, website, created_by)
  values (public.unique_company_slug(p_name), trim(p_name), p_kind, p_size, nullif(trim(p_city), ''),
          nullif(trim(p_postal_code), ''), nullif(p_siren, ''), nullif(trim(p_website), ''), v_uid)
  returning id into v_id;
  insert into public.company_members (company_id, user_id, role) values (v_id, v_uid, 'COMPANY_ADMIN');
  insert into public.company_profiles (company_id, tagline, description, sectors, skills)
  values (v_id, nullif(trim(p_tagline), ''), nullif(trim(p_description), ''),
          coalesce(p_sectors, '{}'), coalesce(p_skills, '{}'));
  perform public.log_audit('company.created', 'company', v_id::text, jsonb_build_object('name', p_name));
  insert into public.analytics_events (event_name, user_id, company_id) values ('create_company', v_uid, v_id);
  return v_id;
end;
$$;

create or replace function public.invite_company_member(p_company_id uuid, p_email text, p_role public.company_role)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_target uuid; v_name text;
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Seul un administrateur de l''entreprise peut inviter' using errcode = '42501';
  end if;
  perform public.enforce_rate_limit('invite_member', 30, 86400);
  select id into v_target from public.users where lower(email) = lower(trim(p_email)) and status = 'ACTIVE';
  select name into v_name from public.companies where id = p_company_id;
  if v_target is not null then
    insert into public.company_members (company_id, user_id, role) values (p_company_id, v_target, p_role)
    on conflict (company_id, user_id) do nothing;
    perform public.notify_user(v_target, 'company_member_added', 'Vous avez rejoint ' || v_name,
      'Vous êtes désormais membre de l''entreprise ' || v_name || ' sur LinkProB2B.', '/dashboard/entreprise');
    perform public.log_audit('company.member_added', 'company', p_company_id::text, jsonb_build_object('user_id', v_target));
    return 'ADDED';
  end if;
  insert into public.company_invitations (company_id, email, role, invited_by)
  values (p_company_id, lower(trim(p_email)), p_role, v_uid)
  on conflict (company_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  perform public.log_audit('company.member_invited', 'company', p_company_id::text, '{}'::jsonb);
  return 'INVITED';
end;
$$;

create or replace function public.accept_pending_invitations()
returns int language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_email text; v_count int := 0; inv record;
begin
  select lower(email) into v_email from public.users where id = v_uid;
  for inv in select * from public.company_invitations where email = v_email and accepted_at is null loop
    insert into public.company_members (company_id, user_id, role) values (inv.company_id, v_uid, inv.role)
    on conflict (company_id, user_id) do nothing;
    update public.company_invitations set accepted_at = now() where id = inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.set_company_member_role(p_member_id uuid, p_role public.company_role)
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  perform public.require_active_user();
  select * into m from public.company_members where id = p_member_id;
  if m.id is null or not public.is_company_admin(m.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_role = 'COMPANY_MEMBER' and m.role = 'COMPANY_ADMIN'
     and (select count(*) from public.company_members where company_id = m.company_id and role = 'COMPANY_ADMIN') <= 1 then
    raise exception 'L''entreprise doit conserver au moins un administrateur' using errcode = '22023';
  end if;
  update public.company_members set role = p_role where id = p_member_id;
  perform public.log_audit('company.member_role_changed', 'company', m.company_id::text,
    jsonb_build_object('member_id', p_member_id, 'role', p_role));
end;
$$;

create or replace function public.remove_company_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  perform public.require_active_user();
  select * into m from public.company_members where id = p_member_id;
  if m.id is null or not (public.is_company_admin(m.company_id) or m.user_id = auth.uid()) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if m.role = 'COMPANY_ADMIN'
     and (select count(*) from public.company_members where company_id = m.company_id and role = 'COMPANY_ADMIN') <= 1 then
    raise exception 'L''entreprise doit conserver au moins un administrateur' using errcode = '22023';
  end if;
  delete from public.company_members where id = p_member_id;
  perform public.log_audit('company.member_removed', 'company', m.company_id::text, jsonb_build_object('user_id', m.user_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Intérêts, réponses, pipeline
-- -----------------------------------------------------------------------------
create or replace function public.pipeline_rank(p_stage public.pipeline_stage)
returns int language sql immutable set search_path = '' as $$
  select array_position(array['DETECTED','QUALIFIED','INTERESTED','RESPONSE_PREPARING','RESPONSE_SENT',
    'DISCUSSION','NEGOTIATION','WON','LOST']::text[], p_stage::text);
$$;

create or replace function public.advance_pipeline(p_company_id uuid, p_opportunity_id uuid, p_stage public.pipeline_stage)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pipeline_items (company_id, opportunity_id, stage, updated_by)
  values (p_company_id, p_opportunity_id, p_stage, auth.uid())
  on conflict (company_id, opportunity_id) do update
    set stage = excluded.stage, updated_by = excluded.updated_by
    where public.pipeline_rank(public.pipeline_items.stage) < public.pipeline_rank(excluded.stage)
      and public.pipeline_items.stage not in ('WON', 'LOST');
end;
$$;

-- Vérifie qu'une opportunité peut recevoir une action d'un fournisseur.
create or replace function public.assert_open_internal_opportunity(p_opportunity_id uuid, p_company_id uuid)
returns public.opportunities language plpgsql security definer set search_path = '' as $$
declare o public.opportunities;
begin
  select * into o from public.opportunities where id = p_opportunity_id;
  if o.id is null or not public.can_view_opportunity(o.id) then
    raise exception 'Opportunité introuvable' using errcode = 'P0002';
  end if;
  if o.origin = 'EXTERNAL' then
    raise exception 'Opportunité externe : la réponse se fait sur le site source' using errcode = '22023';
  end if;
  if o.status <> 'PUBLISHED' then
    raise exception 'Cette opportunité n''accepte plus de réponses' using errcode = '22023';
  end if;
  if o.response_deadline is not null and o.response_deadline < now() then
    raise exception 'La date limite de réponse est dépassée' using errcode = '22023';
  end if;
  if o.company_id = p_company_id then
    raise exception 'Vous ne pouvez pas répondre à votre propre besoin' using errcode = '22023';
  end if;
  if not public.is_company_member(p_company_id) then
    raise exception 'Vous devez être membre de l''entreprise' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Votre entreprise n''est pas active' using errcode = '42501';
  end if;
  return o;
end;
$$;

create or replace function public.express_interest(p_opportunity_id uuid, p_company_id uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); o public.opportunities; v_id uuid; v_company text;
begin
  perform public.enforce_rate_limit('express_interest', 40, 3600);
  o := public.assert_open_internal_opportunity(p_opportunity_id, p_company_id);
  insert into public.interests (opportunity_id, company_id, user_id, message)
  values (p_opportunity_id, p_company_id, v_uid, nullif(trim(p_message), ''))
  on conflict (opportunity_id, company_id) do update
    set message = coalesce(excluded.message, public.interests.message),
        status = case when public.interests.status = 'WITHDRAWN' then 'PENDING' else public.interests.status end,
        user_id = excluded.user_id
  returning id into v_id;
  perform public.advance_pipeline(p_company_id, p_opportunity_id, 'INTERESTED');
  select name into v_company from public.companies where id = p_company_id;
  perform public.notify_company(o.company_id, 'interest_received', 'Nouvelle manifestation d''intérêt',
    v_company || ' est intéressé par « ' || o.title || ' »', '/dashboard/opportunites/' || o.id);
  insert into public.analytics_events (event_name, user_id, company_id, properties)
  values ('express_interest', v_uid, p_company_id, jsonb_build_object('opportunity_id', o.id, 'type', o.type));
  perform public.log_audit('interest.created', 'opportunity', o.id::text, jsonb_build_object('company_id', p_company_id));
  return v_id;
end;
$$;

create or replace function public.withdraw_interest(p_interest_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i record;
begin
  perform public.require_active_user();
  select * into i from public.interests where id = p_interest_id;
  if i.id is null or not public.is_company_member(i.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  update public.interests set status = 'WITHDRAWN' where id = p_interest_id;
end;
$$;

create or replace function public.submit_proposal(
  p_opportunity_id uuid,
  p_company_id uuid,
  p_message text,
  p_proposal_text text default null,
  p_price_amount numeric default null,
  p_price_details text default null,
  p_lead_time text default null,
  p_valid_until date default null,
  p_additional_info text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); o public.opportunities; v_id uuid; v_existing record; v_company text;
begin
  perform public.enforce_rate_limit('submit_proposal', 30, 3600);
  o := public.assert_open_internal_opportunity(p_opportunity_id, p_company_id);
  if not (select accepts_proposals from public.opportunity_types where code = o.type) then
    raise exception 'Ce type d''opportunité n''accepte pas de proposition' using errcode = '22023';
  end if;
  select * into v_existing from public.proposals where opportunity_id = p_opportunity_id and company_id = p_company_id;
  if v_existing.id is not null and v_existing.status not in ('SUBMITTED', 'INFO_REQUESTED', 'WITHDRAWN') then
    raise exception 'Cette réponse ne peut plus être modifiée' using errcode = '22023';
  end if;
  insert into public.proposals (opportunity_id, company_id, submitted_by, message, proposal_text, price_amount,
    price_details, lead_time, valid_until, additional_info)
  values (p_opportunity_id, p_company_id, v_uid, trim(p_message), nullif(trim(p_proposal_text), ''), p_price_amount,
    nullif(trim(p_price_details), ''), nullif(trim(p_lead_time), ''), p_valid_until, nullif(trim(p_additional_info), ''))
  on conflict (opportunity_id, company_id) do update set
    submitted_by = excluded.submitted_by, message = excluded.message, proposal_text = excluded.proposal_text,
    price_amount = excluded.price_amount, price_details = excluded.price_details, lead_time = excluded.lead_time,
    valid_until = excluded.valid_until, additional_info = excluded.additional_info,
    status = 'SUBMITTED', submitted_at = now()
  returning id into v_id;
  insert into public.interests (opportunity_id, company_id, user_id)
  values (p_opportunity_id, p_company_id, v_uid) on conflict (opportunity_id, company_id) do nothing;
  perform public.advance_pipeline(p_company_id, p_opportunity_id, 'RESPONSE_SENT');
  select name into v_company from public.companies where id = p_company_id;
  perform public.notify_company(o.company_id, 'proposal_received',
    case when v_existing.id is null then 'Nouvelle réponse reçue' else 'Réponse mise à jour' end,
    v_company || ' a répondu à « ' || o.title || ' »', '/dashboard/opportunites/' || o.id);
  insert into public.analytics_events (event_name, user_id, company_id, properties)
  values ('submit_proposal', v_uid, p_company_id, jsonb_build_object('opportunity_id', o.id, 'type', o.type));
  perform public.log_audit('proposal.submitted', 'proposal', v_id::text, jsonb_build_object('opportunity_id', o.id));
  return v_id;
end;
$$;

create or replace function public.withdraw_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform public.require_active_user();
  select * into p from public.proposals where id = p_proposal_id;
  if p.id is null or not public.is_company_member(p.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p.status in ('SELECTED', 'DECLINED') then
    raise exception 'Cette réponse ne peut plus être retirée' using errcode = '22023';
  end if;
  update public.proposals set status = 'WITHDRAWN' where id = p_proposal_id;
  perform public.log_audit('proposal.withdrawn', 'proposal', p_proposal_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.register_proposal_document(
  p_proposal_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_size_bytes int
) returns uuid language plpgsql security definer set search_path = '' as $$
declare p record; v_id uuid;
begin
  perform public.require_active_user();
  select * into p from public.proposals where id = p_proposal_id;
  if p.id is null or not public.is_company_member(p.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if split_part(p_storage_path, '/', 1) <> p_proposal_id::text then
    raise exception 'Chemin de fichier invalide' using errcode = '22023';
  end if;
  insert into public.proposal_documents (proposal_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  values (p_proposal_id, p_storage_path, p_file_name, p_mime_type, p_size_bytes, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Côté demandeur : traitement des manifestations d'intérêt
create or replace function public.buyer_set_interest_status(
  p_interest_id uuid, p_status public.interest_status, p_message text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare i record; o record; v_label text;
begin
  perform public.require_active_user();
  select * into i from public.interests where id = p_interest_id;
  select * into o from public.opportunities where id = i.opportunity_id;
  if i.id is null or not public.is_company_member(o.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_status not in ('SHORTLISTED', 'INFO_REQUESTED', 'ACCEPTED', 'DECLINED', 'PENDING') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;
  if i.status = 'WITHDRAWN' then
    raise exception 'Le fournisseur a retiré son intérêt' using errcode = '22023';
  end if;
  update public.interests set status = p_status where id = p_interest_id;
  v_label := case p_status
    when 'SHORTLISTED' then 'Vous êtes présélectionné'
    when 'INFO_REQUESTED' then 'Informations complémentaires demandées'
    when 'ACCEPTED' then 'Votre intérêt a été accepté'
    when 'DECLINED' then 'Votre intérêt n''a pas été retenu'
    else 'Mise à jour de votre intérêt' end;
  perform public.notify_company(i.company_id, 'interest_status', v_label,
    '« ' || o.title || ' »' || coalesce(' — ' || nullif(trim(p_message), ''), ''), '/dashboard/opportunites?onglet=reponses');
  perform public.log_audit('interest.status_changed', 'interest', p_interest_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- Côté demandeur : traitement des réponses
create or replace function public.buyer_set_proposal_status(
  p_proposal_id uuid, p_status public.proposal_status, p_message text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare p record; o record; v_label text;
begin
  perform public.require_active_user();
  select * into p from public.proposals where id = p_proposal_id;
  select * into o from public.opportunities where id = p.opportunity_id;
  if p.id is null or not public.is_company_member(o.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_status not in ('SUBMITTED', 'SHORTLISTED', 'INFO_REQUESTED', 'SELECTED', 'DECLINED') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;
  if p.status = 'WITHDRAWN' then
    raise exception 'Le fournisseur a retiré sa réponse' using errcode = '22023';
  end if;
  update public.proposals set status = p_status where id = p_proposal_id;
  v_label := case p_status
    when 'SHORTLISTED' then 'Votre réponse est présélectionnée'
    when 'INFO_REQUESTED' then 'Informations complémentaires demandées sur votre réponse'
    when 'SELECTED' then 'Votre réponse a été retenue'
    when 'DECLINED' then 'Votre réponse n''a pas été retenue'
    else 'Mise à jour de votre réponse' end;
  perform public.notify_company(p.company_id, 'proposal_status', v_label,
    '« ' || o.title || ' »' || coalesce(' — ' || nullif(trim(p_message), ''), ''), '/dashboard/opportunites?onglet=reponses');
  perform public.log_audit('proposal.status_changed', 'proposal', p_proposal_id::text, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.save_proposal_evaluation(p_proposal_id uuid, p_score int, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_buyer uuid;
begin
  perform public.require_active_user();
  select o.company_id into v_buyer from public.proposals p join public.opportunities o on o.id = p.opportunity_id
  where p.id = p_proposal_id;
  if v_buyer is null or not public.is_company_member(v_buyer) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  insert into public.proposal_evaluations (proposal_id, buyer_company_id, score, note, updated_by)
  values (p_proposal_id, v_buyer, p_score, nullif(trim(p_note), ''), auth.uid())
  on conflict (proposal_id) do update set score = excluded.score, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create or replace function public.close_opportunity(
  p_opportunity_id uuid, p_outcome public.opportunity_outcome, p_selected_proposal_id uuid default null,
  p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare o record; p record;
begin
  perform public.require_active_user();
  select * into o from public.opportunities where id = p_opportunity_id;
  if o.id is null or not public.is_company_member(o.company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if o.status not in ('PUBLISHED', 'EXPIRED') then
    raise exception 'Seule une opportunité publiée ou expirée peut être clôturée' using errcode = '22023';
  end if;
  if p_selected_proposal_id is not null and not exists (
    select 1 from public.proposals where id = p_selected_proposal_id and opportunity_id = p_opportunity_id
  ) then
    raise exception 'Réponse sélectionnée invalide' using errcode = '22023';
  end if;
  perform public.trusted();
  update public.opportunities set status = 'CLOSED', outcome = p_outcome, outcome_note = nullif(trim(p_note), ''),
    selected_proposal_id = p_selected_proposal_id, closed_at = now()
  where id = p_opportunity_id;
  if p_selected_proposal_id is not null then
    update public.proposals set status = 'SELECTED' where id = p_selected_proposal_id;
  end if;
  for p in select * from public.proposals where opportunity_id = p_opportunity_id and status <> 'WITHDRAWN' loop
    perform public.notify_company(p.company_id, 'opportunity_closed', 'Consultation clôturée',
      '« ' || o.title || ' » a été clôturée par le demandeur.'
      || case when p.id = p_selected_proposal_id then ' Votre réponse a été retenue.' else '' end,
      '/dashboard/opportunites?onglet=reponses');
  end loop;
  perform public.log_audit('opportunity.closed', 'opportunity', p_opportunity_id::text,
    jsonb_build_object('outcome', p_outcome, 'selected_proposal_id', p_selected_proposal_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Messagerie : une conversation n'existe qu'entre le demandeur d'une
-- opportunité et une entreprise ayant manifesté son intérêt ou répondu.
-- -----------------------------------------------------------------------------
create or replace function public.start_conversation(
  p_opportunity_id uuid, p_supplier_company_id uuid, p_body text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); o record; v_conv uuid; v_sender uuid;
begin
  perform public.enforce_rate_limit('start_conversation', 30, 3600);
  select * into o from public.opportunities where id = p_opportunity_id;
  if o.id is null or o.origin = 'EXTERNAL' then
    raise exception 'Opportunité introuvable' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.interests where opportunity_id = p_opportunity_id and company_id = p_supplier_company_id
    union all
    select 1 from public.proposals where opportunity_id = p_opportunity_id and company_id = p_supplier_company_id
  ) then
    raise exception 'La messagerie s''ouvre après une manifestation d''intérêt ou une réponse' using errcode = '42501';
  end if;
  if public.is_company_member(o.company_id) then
    v_sender := o.company_id;
  elsif public.is_company_member(p_supplier_company_id) then
    v_sender := p_supplier_company_id;
  else
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  insert into public.conversations (opportunity_id, buyer_company_id, supplier_company_id, subject, created_by)
  values (p_opportunity_id, o.company_id, p_supplier_company_id, o.title, v_uid)
  on conflict (opportunity_id, buyer_company_id, supplier_company_id) do update set subject = excluded.subject
  returning id into v_conv;
  if p_body is not null and trim(p_body) <> '' then
    perform public.send_message(v_conv, p_body, null, null);
  end if;
  return v_conv;
end;
$$;

create or replace function public.send_message(
  p_conversation_id uuid, p_body text, p_attachment_path text default null, p_attachment_name text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); c record; v_sender uuid; v_other uuid; v_id uuid; v_name text;
begin
  perform public.enforce_rate_limit('send_message', 120, 3600);
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null then raise exception 'Conversation introuvable' using errcode = 'P0002'; end if;
  if public.is_company_member(c.buyer_company_id) then
    v_sender := c.buyer_company_id; v_other := c.supplier_company_id;
  elsif public.is_company_member(c.supplier_company_id) then
    v_sender := c.supplier_company_id; v_other := c.buyer_company_id;
  else
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Message vide' using errcode = '22023';
  end if;
  if p_attachment_path is not null and split_part(p_attachment_path, '/', 1) <> p_conversation_id::text then
    raise exception 'Pièce jointe invalide' using errcode = '22023';
  end if;
  insert into public.messages (conversation_id, sender_user_id, sender_company_id, body, attachment_path, attachment_name)
  values (p_conversation_id, v_uid, v_sender, trim(p_body), p_attachment_path, p_attachment_name)
  returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conversation_id;
  select name into v_name from public.companies where id = v_sender;
  perform public.notify_company(v_other, 'new_message', 'Nouveau message de ' || v_name,
    left(trim(p_body), 140), '/dashboard/messages/' || p_conversation_id);
  return v_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_active_user();
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  update public.messages set read_at = now()
  where conversation_id = p_conversation_id and read_at is null
    and not public.is_company_member(sender_company_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Analytics : liste fermée d'événements, pas de données personnelles
-- -----------------------------------------------------------------------------
create or replace function public.track_event(p_event_name text, p_properties jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_event_name not in (
    'view_opportunity', 'search_opportunities', 'create_account', 'create_company', 'publish_opportunity',
    'express_interest', 'submit_proposal', 'save_favorite', 'create_alert', 'contact_company',
    'source_outbound_clicked', 'profile_completed', 'view_company', 'search_companies'
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

-- -----------------------------------------------------------------------------
-- Modération et administration
-- -----------------------------------------------------------------------------
create or replace function public.moderate_opportunity(
  p_opportunity_id uuid, p_action public.moderation_action_type, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_staff(); o record; v_new public.opportunity_status;
begin
  select * into o from public.opportunities where id = p_opportunity_id;
  if o.id is null then raise exception 'Opportunité introuvable' using errcode = 'P0002'; end if;
  v_new := case p_action
    when 'APPROVE' then 'PUBLISHED'
    when 'REJECT' then 'REJECTED'
    when 'REQUEST_CHANGES' then 'CHANGES_REQUESTED'
    when 'SUSPEND' then 'SUSPENDED'
    when 'ARCHIVE' then 'ARCHIVED'
    when 'REINSTATE' then 'PUBLISHED'
  end::public.opportunity_status;
  if p_action = 'APPROVE' and o.status <> 'PENDING_REVIEW' then
    raise exception 'Seule une opportunité en attente peut être approuvée' using errcode = '22023';
  end if;
  if p_action in ('REJECT', 'REQUEST_CHANGES') and o.status <> 'PENDING_REVIEW' then
    raise exception 'Action possible uniquement sur une opportunité en attente' using errcode = '22023';
  end if;
  if p_action = 'REINSTATE' and o.status <> 'SUSPENDED' then
    raise exception 'Seule une opportunité suspendue peut être rétablie' using errcode = '22023';
  end if;
  if p_action in ('REJECT', 'REQUEST_CHANGES', 'SUSPEND') and coalesce(trim(p_reason), '') = '' then
    raise exception 'Un motif est obligatoire' using errcode = '22023';
  end if;
  perform public.trusted();
  update public.opportunities set status = v_new, moderation_note = nullif(trim(p_reason), '')
  where id = p_opportunity_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (v_uid, 'OPPORTUNITY', p_opportunity_id, p_action, p_reason);
  perform public.log_audit('moderation.' || lower(p_action::text), 'opportunity', p_opportunity_id::text,
    jsonb_build_object('reason', p_reason, 'from', o.status, 'to', v_new));
  if v_new = 'PUBLISHED' and p_action = 'APPROVE' then
    insert into public.analytics_events (event_name, user_id, company_id, properties)
    values ('publish_opportunity', o.created_by, o.company_id, jsonb_build_object('opportunity_id', o.id, 'type', o.type));
    perform public.dispatch_immediate_alerts(p_opportunity_id);
  end if;
end;
$$;

create or replace function public.mark_opportunity_duplicate(p_opportunity_id uuid, p_duplicate_of uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_staff();
begin
  if p_opportunity_id = p_duplicate_of then
    raise exception 'Une opportunité ne peut pas être son propre doublon' using errcode = '22023';
  end if;
  perform public.trusted();
  update public.opportunities set status = 'ARCHIVED', duplicate_of = p_duplicate_of,
    moderation_note = 'Doublon d''une autre opportunité'
  where id = p_opportunity_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (v_uid, 'OPPORTUNITY', p_opportunity_id, 'ARCHIVE', 'Doublon de ' || p_duplicate_of);
  perform public.log_audit('moderation.duplicate', 'opportunity', p_opportunity_id::text,
    jsonb_build_object('duplicate_of', p_duplicate_of));
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.account_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_admin(); t record;
begin
  select * into t from public.users where id = p_user_id;
  if t.id is null then raise exception 'Utilisateur introuvable' using errcode = 'P0002'; end if;
  if p_user_id = v_uid then raise exception 'Vous ne pouvez pas modifier votre propre statut' using errcode = '22023'; end if;
  if t.platform_role = 'SUPER_ADMIN' and not public.is_super_admin() then
    raise exception 'Action réservée au super administrateur' using errcode = '42501';
  end if;
  if p_status = 'DELETED' then raise exception 'Utilisez la suppression de compte' using errcode = '22023'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Un motif est obligatoire' using errcode = '22023'; end if;
  update public.users set status = p_status where id = p_user_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (v_uid, 'USER', p_user_id, case when p_status = 'SUSPENDED' then 'SUSPEND' else 'REINSTATE' end::public.moderation_action_type, p_reason);
  perform public.log_audit('admin.user_status', 'user', p_user_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.platform_role)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_admin(); t record;
begin
  select * into t from public.users where id = p_user_id;
  if t.id is null then raise exception 'Utilisateur introuvable' using errcode = 'P0002'; end if;
  if p_user_id = v_uid then raise exception 'Vous ne pouvez pas modifier votre propre rôle' using errcode = '22023'; end if;
  if (p_role in ('ADMIN', 'SUPER_ADMIN') or t.platform_role in ('ADMIN', 'SUPER_ADMIN')) and not public.is_super_admin() then
    raise exception 'Seul un super administrateur peut gérer les administrateurs' using errcode = '42501';
  end if;
  update public.users set platform_role = p_role where id = p_user_id;
  perform public.log_audit('admin.user_role', 'user', p_user_id::text,
    jsonb_build_object('from', t.platform_role, 'to', p_role));
end;
$$;

create or replace function public.admin_set_company_status(p_company_id uuid, p_status public.company_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_staff();
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Un motif est obligatoire' using errcode = '22023'; end if;
  update public.companies set status = p_status where id = p_company_id;
  if not found then raise exception 'Entreprise introuvable' using errcode = 'P0002'; end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason)
  values (v_uid, 'COMPANY', p_company_id,
    case when p_status = 'SUSPENDED' then 'SUSPEND' else 'REINSTATE' end::public.moderation_action_type, p_reason);
  perform public.notify_company(p_company_id, 'company_status',
    case when p_status = 'SUSPENDED' then 'Votre entreprise a été suspendue' else 'Votre entreprise est active' end,
    p_reason, '/dashboard/entreprise');
  perform public.log_audit('admin.company_status', 'company', p_company_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_verify_company(p_company_id uuid, p_verified boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_admin();
begin
  if p_verified and coalesce(trim(p_note), '') = '' then
    raise exception 'Indiquez la preuve de vérification (ex. : SIREN contrôlé, Kbis reçu)' using errcode = '22023';
  end if;
  update public.companies set
    verified_at = case when p_verified then now() else null end,
    verified_by = case when p_verified then v_uid else null end,
    verification_note = nullif(trim(p_note), '')
  where id = p_company_id;
  perform public.log_audit(case when p_verified then 'admin.company_verified' else 'admin.company_unverified' end,
    'company', p_company_id::text, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.resolve_report(p_report_id uuid, p_status public.report_status, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_staff();
begin
  update public.reports set status = p_status, resolution_note = nullif(trim(p_note), ''),
    resolved_by = case when p_status in ('RESOLVED', 'DISMISSED') then v_uid else null end,
    resolved_at = case when p_status in ('RESOLVED', 'DISMISSED') then now() else null end
  where id = p_report_id;
  if not found then raise exception 'Signalement introuvable' using errcode = 'P0002'; end if;
  perform public.log_audit('report.' || lower(p_status::text), 'report', p_report_id::text, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.create_report(
  p_target_type public.report_target, p_target_id uuid, p_reason text, p_details text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_id uuid;
begin
  perform public.enforce_rate_limit('create_report', 20, 86400);
  insert into public.reports (reporter_user_id, target_type, target_id, reason, details)
  values (v_uid, p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  returning id into v_id;
  perform public.notify_staff('report_created', 'Nouveau signalement', p_reason, '/admin/signalements');
  return v_id;
end;
$$;

-- Message signalé : lecture réservée au staff, uniquement pour le message visé.
create or replace function public.admin_get_reported_message(p_report_id uuid)
returns table (id uuid, body text, created_at timestamptz, sender_company text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_staff();
  return query
    select m.id, m.body, m.created_at, c.name
    from public.reports r
    join public.messages m on m.id = r.target_id
    join public.companies c on c.id = m.sender_company_id
    where r.id = p_report_id and r.target_type = 'MESSAGE';
end;
$$;

create or replace function public.admin_upsert_external_source(
  p_id uuid, p_name text, p_base_url text, p_description text, p_license text, p_terms_url text,
  p_status public.source_status, p_import_method text, p_notes text, p_legal_validation_confirmed boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_admin(); v_id uuid; v_old record;
begin
  if p_status = 'APPROVED' and not p_legal_validation_confirmed then
    raise exception 'L''approbation d''une source exige la confirmation de la validation juridique et technique'
      using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.external_sources (name, base_url, description, license, terms_url, status, import_method, notes,
      legal_validated_at, legal_validated_by)
    values (trim(p_name), p_base_url, p_description, p_license, p_terms_url, p_status, p_import_method, p_notes,
      case when p_status = 'APPROVED' then now() end, case when p_status = 'APPROVED' then v_uid end)
    returning id into v_id;
  else
    select * into v_old from public.external_sources where id = p_id;
    update public.external_sources set name = trim(p_name), base_url = p_base_url, description = p_description,
      license = p_license, terms_url = p_terms_url, status = p_status, import_method = p_import_method, notes = p_notes,
      legal_validated_at = case when p_status = 'APPROVED' and v_old.status <> 'APPROVED' then now()
                                when p_status = 'APPROVED' then legal_validated_at else null end,
      legal_validated_by = case when p_status = 'APPROVED' and v_old.status <> 'APPROVED' then v_uid
                                when p_status = 'APPROVED' then legal_validated_by else null end
    where id = p_id returning id into v_id;
    -- Suspension d'une source : ses opportunités ne sont plus présentées comme actives.
    if p_status in ('SUSPENDED', 'REJECTED') then
      perform public.trusted();
      update public.opportunities o set status = 'SUSPENDED', moderation_note = 'Source externe suspendue'
      from public.opportunity_sources s
      where s.opportunity_id = o.id and s.source_id = p_id and o.status = 'PUBLISHED';
    end if;
  end if;
  perform public.log_audit('admin.source_upsert', 'external_source', v_id::text,
    jsonb_build_object('status', p_status, 'legal_confirmed', p_legal_validation_confirmed));
  return v_id;
end;
$$;

create or replace function public.admin_create_external_opportunity(
  p_source_id uuid, p_type public.opportunity_type, p_title text, p_summary text, p_description text,
  p_external_buyer_name text, p_sector_slug text, p_city text, p_department_code text,
  p_response_deadline timestamptz, p_original_url text, p_external_id text, p_source_published_at date,
  p_is_demo boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_staff(); v_id uuid; s record;
begin
  select * into s from public.external_sources where id = p_source_id;
  if s.id is null or s.status <> 'APPROVED' then
    raise exception 'La source doit être approuvée (validation juridique) avant tout référencement' using errcode = '22023';
  end if;
  if p_type not in ('EXTERNAL_OPPORTUNITY', 'PUBLIC_TENDER') then
    raise exception 'Type invalide pour une opportunité externe' using errcode = '22023';
  end if;
  if p_original_url !~* '^https?://' then
    raise exception 'URL de la source originale invalide' using errcode = '22023';
  end if;
  perform public.trusted();
  insert into public.opportunities (type, origin, status, title, summary, description, external_buyer_name,
    sector_slug, city, department_code, response_deadline, created_by, is_demo)
  values (p_type, 'EXTERNAL', 'PUBLISHED', trim(p_title), nullif(trim(p_summary), ''), trim(p_description),
    nullif(trim(p_external_buyer_name), ''), p_sector_slug, nullif(trim(p_city), ''), p_department_code,
    p_response_deadline, v_uid, p_is_demo or s.is_demo)
  returning id into v_id;
  insert into public.opportunity_sources (opportunity_id, source_id, external_id, original_url, source_published_at,
    last_verified_at, imported_by)
  values (v_id, p_source_id, nullif(trim(p_external_id), ''), p_original_url, p_source_published_at, now(), v_uid);
  perform public.log_audit('external.created', 'opportunity', v_id::text, jsonb_build_object('source_id', p_source_id));
  perform public.dispatch_immediate_alerts(v_id);
  return v_id;
end;
$$;

create or replace function public.admin_verify_external_opportunity(p_opportunity_id uuid, p_verification_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_staff();
begin
  update public.opportunity_sources set last_verified_at = now(), verification_status = p_verification_status
  where opportunity_id = p_opportunity_id;
  if not found then raise exception 'Opportunité externe introuvable' using errcode = 'P0002'; end if;
  if p_verification_status = 'REMOVED_AT_SOURCE' then
    perform public.trusted();
    update public.opportunities set status = 'EXPIRED' where id = p_opportunity_id and status = 'PUBLISHED';
  end if;
  perform public.log_audit('external.verified', 'opportunity', p_opportunity_id::text,
    jsonb_build_object('verification_status', p_verification_status));
end;
$$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_admin();
begin
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, v_uid)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.log_audit('admin.setting', 'setting', p_key, jsonb_build_object('value', p_value));
end;
$$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_staff();
  return jsonb_build_object(
    'users_total', (select count(*) from public.users where status <> 'DELETED'),
    'users_active_30d', (select count(*) from public.users where last_seen_at > now() - interval '30 days'),
    'users_suspended', (select count(*) from public.users where status = 'SUSPENDED'),
    'companies_total', (select count(*) from public.companies),
    'companies_completed', (select count(*) from public.company_profiles p
        where coalesce(p.description, '') <> '' and cardinality(p.sectors) > 0 and cardinality(p.skills) > 0),
    'companies_active', (select count(distinct company_id) from public.analytics_events
        where company_id is not null and created_at > now() - interval '30 days'),
    'companies_verified', (select count(*) from public.companies where verified_at is not null),
    'opportunities_published', (select count(*) from public.opportunities where status = 'PUBLISHED' and origin = 'INTERNAL'),
    'opportunities_external', (select count(*) from public.opportunities where status = 'PUBLISHED' and origin = 'EXTERNAL'),
    'opportunities_pending', (select count(*) from public.opportunities where status = 'PENDING_REVIEW'),
    'opportunities_expired', (select count(*) from public.opportunities where status = 'EXPIRED'),
    'consultations', (select count(*) from public.opportunities
        where type in ('PRIVATE_CONSULTATION', 'PRIVATE_TENDER', 'QUOTE_REQUEST') and status not in ('DRAFT')),
    'interests', (select count(*) from public.interests),
    'proposals', (select count(*) from public.proposals where status <> 'WITHDRAWN'),
    'conversations', (select count(*) from public.conversations),
    'reports_open', (select count(*) from public.reports where status in ('OPEN', 'REVIEWING')),
    'sources_total', (select count(*) from public.external_sources),
    'sources_approved', (select count(*) from public.external_sources where status = 'APPROVED'),
    'searches_30d', (select count(*) from public.analytics_events where event_name = 'search_opportunities'
        and created_at > now() - interval '30 days'),
    'views_30d', (select count(*) from public.analytics_events where event_name = 'view_opportunity'
        and created_at > now() - interval '30 days'),
    'outbound_clicks_30d', (select count(*) from public.analytics_events where event_name = 'source_outbound_clicked'
        and created_at > now() - interval '30 days'),
    'interests_30d', (select count(*) from public.analytics_events where event_name = 'express_interest'
        and created_at > now() - interval '30 days'),
    'contact_messages_open', (select count(*) from public.contact_messages where not handled),
    'demo_records', (select count(*) from public.opportunities where is_demo) + (select count(*) from public.companies where is_demo)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Expiration (appelée par la tâche planifiée avec la clé service)
-- -----------------------------------------------------------------------------
create or replace function public.expire_opportunities()
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform public.trusted();
  update public.opportunities set status = 'EXPIRED'
  where status = 'PUBLISHED' and response_deadline is not null and response_deadline < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- RGPD : export et préparation de la suppression
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'user', (select to_jsonb(u) from public.users u where u.id = v_uid),
    'company_memberships', (select coalesce(jsonb_agg(jsonb_build_object('company', c.name, 'role', m.role, 'since', m.created_at)), '[]')
        from public.company_members m join public.companies c on c.id = m.company_id where m.user_id = v_uid),
    'favorites', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.favorites f where f.user_id = v_uid),
    'saved_searches', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.saved_searches s where s.user_id = v_uid),
    'alerts', (select coalesce(jsonb_agg(to_jsonb(a) - 'unsubscribe_token'), '[]') from public.alerts a where a.user_id = v_uid),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notifications n where n.user_id = v_uid),
    'opportunities_created', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'status', o.status, 'created_at', o.created_at)), '[]')
        from public.opportunities o where o.created_by = v_uid),
    'interests', (select coalesce(jsonb_agg(jsonb_build_object('opportunity_id', i.opportunity_id, 'message', i.message, 'created_at', i.created_at)), '[]')
        from public.interests i where i.user_id = v_uid),
    'proposals', (select coalesce(jsonb_agg(jsonb_build_object('opportunity_id', p.opportunity_id, 'message', p.message, 'submitted_at', p.submitted_at)), '[]')
        from public.proposals p where p.submitted_by = v_uid),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)), '[]')
        from public.messages m where m.sender_user_id = v_uid),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('target_type', r.target_type, 'reason', r.reason, 'created_at', r.created_at)), '[]')
        from public.reports r where r.reporter_user_id = v_uid)
  );
end;
$$;

-- Avant suppression du compte (via l'API d'administration côté serveur) :
-- les entreprises dont l'utilisateur est l'unique membre sont supprimées.
create or replace function public.prepare_account_deletion()
returns int language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_count int := 0; c record;
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode = '42501'; end if;
  for c in select m.company_id from public.company_members m where m.user_id = v_uid loop
    if (select count(*) from public.company_members where company_id = c.company_id) = 1 then
      delete from public.companies where id = c.company_id;
      v_count := v_count + 1;
    elsif not exists (select 1 from public.company_members where company_id = c.company_id
                      and user_id <> v_uid and role = 'COMPANY_ADMIN') then
      -- transfert du rôle d'administrateur au membre le plus ancien
      update public.company_members set role = 'COMPANY_ADMIN'
      where id = (select id from public.company_members where company_id = c.company_id and user_id <> v_uid
                  order by created_at limit 1);
    end if;
  end loop;
  perform public.log_audit('account.deletion_requested', 'user', v_uid::text, jsonb_build_object('companies_deleted', v_count));
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Recherche d'opportunités (security invoker : la RLS s'applique)
-- -----------------------------------------------------------------------------
create or replace function public.search_opportunities(
  p_q text default null,
  p_sector text default null,
  p_department text default null,
  p_place text default null,
  p_radius_km int default null,
  p_types public.opportunity_type[] default null,
  p_status text default 'OPEN',
  p_origin public.opportunity_origin default null,
  p_published_since date default null,
  p_deadline_before date default null,
  p_company_size public.company_size default null,
  p_skills text[] default null,
  p_sort text default 'recent',
  p_limit int default 12,
  p_offset int default 0
) returns table (
  id uuid, title text, summary text, type public.opportunity_type, origin public.opportunity_origin,
  status public.opportunity_status, effective_status text, visibility public.opportunity_visibility,
  sector_slug text, city text, department_code text, budget_min numeric, budget_max numeric,
  budget_visible boolean, response_deadline timestamptz, published_at timestamptz, skills text[],
  company_id uuid, company_name text, company_slug text, company_verified boolean,
  external_buyer_name text, source_name text, is_demo boolean, distance_km double precision,
  rank real, total_count bigint
) language sql stable security invoker set search_path = '' as $$
  with center as (
    select p.lat, p.lng from public.places p where p.slug = p_place limit 1
  ),
  q as (
    select case when coalesce(trim(p_q), '') = '' then null
                else websearch_to_tsquery('french', p_q) end as tsq
  ),
  base as (
    select o.*,
      case
        when o.status = 'PUBLISHED' and o.response_deadline is not null and o.response_deadline < now() then 'EXPIRED'
        else o.status::text
      end as eff_status,
      case when (select lat from center) is not null and o.lat is not null then
        6371 * 2 * asin(sqrt(
          power(sin(radians(o.lat - (select lat from center)) / 2), 2) +
          cos(radians((select lat from center))) * cos(radians(o.lat)) *
          power(sin(radians(o.lng - (select lng from center)) / 2), 2)
        ))
      end as dist
    from public.opportunities o
    where o.status in ('PUBLISHED', 'CLOSED', 'EXPIRED')
  ),
  filtered as (
    select b.*, c.name as c_name, c.slug as c_slug, (c.verified_at is not null) as c_verified, c.size as c_size,
      es.name as s_name,
      case when (select tsq from q) is null then 0 else ts_rank(b.search_vector, (select tsq from q)) end as rnk
    from base b
    left join public.companies c on c.id = b.company_id
    left join public.opportunity_sources os on os.opportunity_id = b.id
    left join public.external_sources es on es.id = os.source_id
    where (b.company_id is null or c.id is not null)
      and ((select tsq from q) is null or b.search_vector @@ (select tsq from q))
      and (p_sector is null or b.sector_slug = p_sector)
      and (p_department is null or b.department_code = p_department)
      and (p_types is null or cardinality(p_types) = 0 or b.type = any (p_types))
      and (p_origin is null or b.origin = p_origin)
      and (p_published_since is null or b.published_at >= p_published_since)
      and (p_deadline_before is null or b.response_deadline <= (p_deadline_before + 1))
      and (p_company_size is null or b.target_company_size = p_company_size or c.size = p_company_size)
      and (p_skills is null or cardinality(p_skills) = 0 or b.skills && p_skills)
      and (
        p_status is null or p_status = 'ALL'
        or (p_status = 'OPEN' and b.eff_status = 'PUBLISHED')
        or (p_status = 'CLOSED' and b.eff_status in ('CLOSED', 'EXPIRED'))
      )
      and (p_radius_km is null or (select lat from center) is null or (b.dist is not null and b.dist <= p_radius_km))
  )
  select f.id, f.title, f.summary, f.type, f.origin, f.status, f.eff_status, f.visibility, f.sector_slug, f.city,
    f.department_code,
    case when f.budget_visible then f.budget_min end, case when f.budget_visible then f.budget_max end,
    f.budget_visible, f.response_deadline, f.published_at, f.skills, f.company_id, f.c_name, f.c_slug,
    coalesce(f.c_verified, false), f.external_buyer_name, f.s_name, f.is_demo, f.dist, f.rnk,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'relevance' then f.rnk end desc nulls last,
    case when p_sort = 'deadline' then f.response_deadline end asc nulls last,
    case when p_sort = 'distance' then f.dist end asc nulls last,
    f.published_at desc nulls last,
    f.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.search_companies(
  p_q text default null,
  p_sector text default null,
  p_department text default null,
  p_kind public.company_kind default null,
  p_size public.company_size default null,
  p_skills text[] default null,
  p_limit int default 12,
  p_offset int default 0
) returns table (
  id uuid, slug text, name text, kind public.company_kind, size public.company_size, city text,
  department_code text, logo_path text, tagline text, sectors text[], skills text[], verified boolean,
  is_demo boolean, total_count bigint
) language sql stable security invoker set search_path = '' as $$
  select c.id, c.slug, c.name, c.kind, c.size, c.city, c.department_code, c.logo_path, p.tagline, p.sectors,
    p.skills, c.verified_at is not null, c.is_demo, count(*) over ()
  from public.companies c
  join public.company_profiles p on p.company_id = c.id
  where c.status = 'ACTIVE' and p.is_public
    and (coalesce(trim(p_q), '') = '' or p.search_vector @@ websearch_to_tsquery('french', p_q)
         or c.name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%')
    and (p_sector is null or p_sector = any (p.sectors))
    and (p_department is null or c.department_code = p_department)
    and (p_kind is null or c.kind = p_kind or c.kind = 'BOTH')
    and (p_size is null or c.size = p_size)
    and (p_skills is null or cardinality(p_skills) = 0 or p.skills && p_skills)
  order by (c.verified_at is not null) desc, c.is_demo asc, c.name
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Recommandations simples et explicables (pas d'IA opaque) : secteur,
-- département et compétences communes avec le profil de l'entreprise.
create or replace function public.recommended_opportunities(p_company_id uuid, p_limit int default 6)
returns table (id uuid, title text, type public.opportunity_type, origin public.opportunity_origin,
  sector_slug text, city text, response_deadline timestamptz, published_at timestamptz, is_demo boolean,
  score int, reasons text[])
language sql stable security invoker set search_path = '' as $$
  with me as (
    select c.department_code, p.sectors, p.skills from public.companies c
    join public.company_profiles p on p.company_id = c.id where c.id = p_company_id
  )
  select o.id, o.title, o.type, o.origin, o.sector_slug, o.city, o.response_deadline, o.published_at, o.is_demo,
    (case when o.sector_slug = any (me.sectors) then 3 else 0 end
     + case when o.department_code = me.department_code then 2 else 0 end
     + coalesce(cardinality(array(select unnest(o.skills) intersect select unnest(me.skills))), 0))::int as score,
    array_remove(array[
      case when o.sector_slug = any (me.sectors) then 'Votre secteur' end,
      case when o.department_code = me.department_code then 'Votre département' end,
      case when o.skills && me.skills then 'Compétences communes' end
    ], null) as reasons
  from public.opportunities o, me
  where o.status = 'PUBLISHED'
    and (o.response_deadline is null or o.response_deadline > now())
    and (o.company_id is null or o.company_id <> p_company_id)
    and public.is_company_member(p_company_id)
    and (o.sector_slug = any (me.sectors)
         or o.department_code = me.department_code
         or o.skills && me.skills)
  order by score desc, o.published_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 30);
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution : les fonctions internes ne sont pas appelables via l'API
-- -----------------------------------------------------------------------------
revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.enforce_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.notify_company(uuid, text, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.notify_staff(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.trusted() from public, anon, authenticated;
revoke execute on function public.advance_pipeline(uuid, uuid, public.pipeline_stage) from public, anon, authenticated;
revoke execute on function public.assert_open_internal_opportunity(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.dispatch_immediate_alerts(uuid) from public, anon, authenticated;
revoke execute on function public.alert_digest_matches(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.expire_opportunities() from public, anon, authenticated;
revoke execute on function public.unique_company_slug(text) from public, anon, authenticated;
revoke execute on function public.opportunity_status_notifications() from public, anon, authenticated;
revoke execute on function public.opportunity_submitted_notification() from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
grant execute on function public.expire_opportunities() to service_role;
grant execute on function public.alert_digest_matches(uuid, timestamptz) to service_role;

-- Les nouvelles tables de cette migration suivent la même règle d'écriture
revoke insert, update, delete, truncate on public.proposal_evaluations from anon, authenticated;
alter table public.proposal_evaluations enable row level security;
