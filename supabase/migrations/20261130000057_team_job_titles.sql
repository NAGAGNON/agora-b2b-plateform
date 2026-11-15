-- Équipe de l'entreprise : poste de la personne invitée, repris sur son compte à l'inscription
alter table public.company_invitations add column if not exists job_title text;
alter table public.company_invitations drop constraint if exists company_invitations_job_title_len;
alter table public.company_invitations add constraint company_invitations_job_title_len check (job_title is null or char_length(job_title) <= 100);

create or replace function public.accept_pending_invitations()
returns int language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_email text; v_count int := 0; inv record;
begin
  select lower(email) into v_email from public.users where id = v_uid;
  for inv in select * from public.company_invitations where email = v_email and accepted_at is null loop
    insert into public.company_members (company_id, user_id, role) values (inv.company_id, v_uid, inv.role)
    on conflict (company_id, user_id) do nothing;
    update public.company_invitations set accepted_at = now() where id = inv.id;
    -- Poste indiqué par le collègue : repris seulement si la personne n'en a pas saisi
    if inv.job_title is not null then
      update public.users set job_title = inv.job_title where id = v_uid and (job_title is null or job_title = '');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Invitation : le lien de l'e-mail pré-remplit l'adresse sur la page d'inscription, et nomme la personne qui invite
create or replace function public.invite_company_member(p_company_id uuid, p_email text, p_role public.company_role)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_target uuid; v_name text; v_from text; v_email text := lower(trim(p_email));
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Seul un administrateur de l''entreprise peut inviter' using errcode = '42501';
  end if;
  perform public.enforce_rate_limit('invite_member', 30, 86400);
  select id into v_target from public.users where lower(email) = v_email and status = 'ACTIVE';
  select name into v_name from public.companies where id = p_company_id;
  select nullif(trim(full_name), '') into v_from from public.users where id = v_uid;
  if v_target is not null then
    insert into public.company_members (company_id, user_id, role) values (p_company_id, v_target, p_role)
    on conflict (company_id, user_id) do nothing;
    perform public.notify_user(v_target, 'company_member_added', 'Vous avez rejoint ' || v_name,
      'Vous êtes désormais membre de l''entreprise ' || v_name || ' sur LinkProB2B.', '/dashboard/entreprise');
    perform public.log_audit('company.member_added', 'company', p_company_id::text, jsonb_build_object('user_id', v_target));
    return 'ADDED';
  end if;
  insert into public.company_invitations (company_id, email, role, invited_by)
  values (p_company_id, v_email, p_role, v_uid)
  on conflict (company_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  insert into public.email_outbox (to_email, template, subject, payload)
  values (v_email, 'invitation', 'Invitation à rejoindre ' || v_name || ' sur LinkProB2B',
    jsonb_build_object('title', 'Vous êtes invité(e) à rejoindre ' || v_name,
      'body', coalesce(v_from, 'Un membre de ' || v_name) || ' vous invite à rejoindre l''équipe de ' || v_name
        || ' sur LinkProB2B pour suivre ensemble les appels d''offres et les candidatures. Créez votre compte avec cette adresse e-mail : vous rejoindrez l''entreprise automatiquement.',
      'link', '/inscription?email=' || replace(v_email, '+', '%2B')));
  perform public.log_audit('company.member_invited', 'company', p_company_id::text, '{}'::jsonb);
  return 'INVITED';
end;
$$;
