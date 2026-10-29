-- Préférences de notifications par e-mail, par catégorie (en plus de l'interrupteur général).
-- Messages, marques d'intérêt et réponses reçus restent toujours envoyés (essentiels).
alter table public.users add column if not exists notify_prefs jsonb not null default '{}'::jsonb;
grant update (notify_prefs) on public.users to authenticated;

/** Catégorie de préférence d'un type de notification (null : non désactivable séparément). */
create or replace function public.notification_category(p_type text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_type in ('need_no_response', 'need_deadline_soon') then 'need_reminders'
    when p_type = 'pipeline_due' then 'pipeline'
    when p_type in ('need_match', 'alert_match') then 'matching'
    when p_type like 'opportunity\_%' or p_type in ('proposal_status', 'interest_status') then 'status'
    else null
  end
$$;

create or replace function public.notify_user(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text, p_send_email boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare u record; v_cat text := public.notification_category(p_type);
begin
  select id, email, notify_email, notify_prefs, status into u from public.users where id = p_user_id;
  if u.id is null or u.status <> 'ACTIVE' then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
  if p_send_email and coalesce(u.email, '') <> ''
     and (p_type in ('new_message', 'interest_received', 'proposal_received')
          or (u.notify_email and (v_cat is null or coalesce(u.notify_prefs ->> v_cat, 'true') <> 'false'))) then
    insert into public.email_outbox (user_id, to_email, template, subject, payload)
    values (p_user_id, u.email, 'notification', p_title,
            jsonb_build_object('title', p_title, 'body', p_body, 'link', p_link, 'type', p_type));
  end if;
end;
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text, boolean) from public, anon, authenticated;
