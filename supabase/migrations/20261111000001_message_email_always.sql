-- Message, intérêt ou réponse reçus d'une autre entreprise : e-mail toujours envoyé, même si
-- l'utilisateur a désactivé les e-mails de notification (les autres notifications restent soumises
-- à sa préférence).
create or replace function public.notify_user(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text, p_send_email boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  select id, email, notify_email, status into u from public.users where id = p_user_id;
  if u.id is null or u.status <> 'ACTIVE' then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
  if p_send_email and coalesce(u.email, '') <> ''
     and (u.notify_email or p_type in ('new_message', 'interest_received', 'proposal_received')) then
    insert into public.email_outbox (user_id, to_email, template, subject, payload)
    values (p_user_id, u.email, 'notification', p_title,
            jsonb_build_object('title', p_title, 'body', p_body, 'link', p_link, 'type', p_type));
  end if;
end;
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text, boolean) from public, anon, authenticated;
