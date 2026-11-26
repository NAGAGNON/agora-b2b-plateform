-- Messages reçus : e-mail avec le message complet (1 000 caractères au plus au lieu de 140), et possibilité
-- de couper ces e-mails, partout (profil) ou pour une seule conversation. La notification sur le site reste.

-- 1. Conversations dont un membre a coupé les e-mails
create table if not exists public.conversation_email_mutes (
  user_id uuid not null references public.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table public.conversation_email_mutes enable row level security;
drop policy if exists conversation_email_mutes_own on public.conversation_email_mutes;
create policy conversation_email_mutes_own on public.conversation_email_mutes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.conversation_email_mutes to authenticated;

-- 2. Catégorie « messages » : réglable dans le profil (activée par défaut)
create or replace function public.notification_category(p_type text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_type in ('need_no_response', 'need_deadline_soon') then 'need_reminders'
    when p_type = 'pipeline_due' then 'pipeline'
    when p_type in ('need_match', 'alert_match') then 'matching'
    when p_type like 'opportunity\_%' or p_type in ('proposal_status', 'interest_status') then 'status'
    when p_type = 'new_message' then 'messages'
    else null
  end
$$;

create or replace function public.notify_user(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text, p_send_email boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
declare u record; v_cat text := public.notification_category(p_type); v_conv uuid; v_mail boolean;
begin
  select id, email, notify_email, notify_prefs, status into u from public.users where id = p_user_id;
  if u.id is null or u.status <> 'ACTIVE' then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
  if not p_send_email or coalesce(u.email, '') = '' then return; end if;
  if p_type = 'new_message' then
    -- Messages : envoyés sauf si le membre les a coupés (profil) ou a coupé cette conversation
    v_conv := nullif(substring(coalesce(p_link, '') from '^/dashboard/messages/([0-9a-f-]{36})'), '')::uuid;
    v_mail := coalesce(u.notify_prefs ->> 'messages', 'true') <> 'false'
      and not exists (select 1 from public.conversation_email_mutes m where m.user_id = p_user_id and m.conversation_id = v_conv);
  else
    v_mail := p_type in ('interest_received', 'proposal_received')
      or (u.notify_email and (v_cat is null or coalesce(u.notify_prefs ->> v_cat, 'true') <> 'false'));
  end if;
  if v_mail then
    insert into public.email_outbox (user_id, to_email, template, subject, payload)
    values (p_user_id, u.email, 'notification', p_title,
            jsonb_build_object('title', p_title, 'body', p_body, 'link', p_link, 'type', p_type));
  end if;
end;
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text, boolean) from public, anon, authenticated;

-- 3. Le message complet dans l'e-mail (la cloche du site n'en affiche que le début)
create or replace function public.send_message(p_conversation_id uuid, p_body text, p_attachment_path text default null, p_attachment_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); c record; v_sender uuid; v_other uuid; v_id uuid; v_name text; v_body text;
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
  v_body := trim(p_body);
  if char_length(v_body) > 1000 then v_body := left(v_body, 1000) || '…'; end if;
  perform public.notify_company(v_other, 'new_message', 'Nouveau message de ' || v_name,
    v_body, '/dashboard/messages/' || p_conversation_id);
  return v_id;
end;
$$;
