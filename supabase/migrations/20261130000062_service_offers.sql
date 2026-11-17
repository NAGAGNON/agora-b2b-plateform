-- Disponibilités : une entreprise annonce ce qu'elle peut faire (métier, zone, période, capacité).
-- Distinctes des besoins (achats) : elles ne déclenchent aucun envoi d'e-mails aux prospects.
-- Les acheteurs contactent l'entreprise par la messagerie (conversation liée à la disponibilité).

create table if not exists public.service_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 5 and 140),
  description text not null check (char_length(btrim(description)) between 20 and 3000),
  sector_slug text references public.sectors (slug),
  department_code text references public.departments (code),
  city text check (city is null or char_length(city) <= 120),
  nationwide boolean not null default false,
  available_from date,
  available_until date,
  capacity text check (capacity is null or char_length(capacity) <= 140),
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'ARCHIVED', 'REMOVED')),
  removed_reason text,
  from_opportunity_id uuid references public.opportunities (id) on delete set null,
  is_demo boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_offers_period check (available_until is null or available_from is null or available_until >= available_from)
);
create index if not exists service_offers_live_idx on public.service_offers (status, expires_at desc);
create index if not exists service_offers_company_idx on public.service_offers (company_id, created_at desc);
create index if not exists service_offers_sector_idx on public.service_offers (sector_slug, department_code);

-- Règles de publication : en ligne jusqu'à la fin de la disponibilité (sinon 60 jours, jamais plus de
-- 6 mois), 5 disponibilités en ligne au plus par entreprise, retrait par la modération définitif pour l'entreprise.
create or replace function public.service_offers_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_staff boolean := auth.uid() is null or public.is_staff() or coalesce(current_setting('linkpro.trusted', true), '') = 'on';
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.is_demo := coalesce((select c.is_demo from public.companies c where c.id = new.company_id), false);
    new.status := 'PUBLISHED';
    new.published_at := now();
    new.removed_reason := null;
    if not v_staff then
      perform public.enforce_rate_limit('service_offer_publish', 10, 86400);
    end if;
  else
    if not v_staff then
      if old.status = 'REMOVED' then
        raise exception 'Cette disponibilité a été retirée par la modération' using errcode = '42501';
      end if;
      if new.status = 'REMOVED' then
        raise exception 'Action non autorisée' using errcode = '42501';
      end if;
      new.removed_reason := old.removed_reason;
    end if;
    new.company_id := old.company_id;
    new.created_by := old.created_by;
    new.is_demo := old.is_demo;
    new.from_opportunity_id := old.from_opportunity_id;
    new.created_at := old.created_at;
    new.published_at := case when new.status = 'PUBLISHED' and old.status <> 'PUBLISHED' then now() else old.published_at end;
  end if;
  if new.nationwide then
    new.department_code := null;
  end if;
  if new.status = 'PUBLISHED' then
    new.expires_at := least(coalesce((new.available_until + 1)::timestamptz, now() + interval '60 days'), now() + interval '180 days');
    if (select count(*) from public.service_offers s
        where s.company_id = new.company_id and s.status = 'PUBLISHED' and s.expires_at > now() and s.id <> new.id) >= 5 then
      raise exception 'Vous avez déjà 5 disponibilités en ligne : retirez-en une avant d''en publier une autre' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists service_offers_guard on public.service_offers;
create trigger service_offers_guard before insert or update on public.service_offers
  for each row execute function public.service_offers_guard();

alter table public.service_offers enable row level security;
drop policy if exists service_offers_select on public.service_offers;
create policy service_offers_select on public.service_offers for select using (
  (status = 'PUBLISHED' and expires_at > now() and public.is_company_active(company_id))
  or public.is_company_member(company_id)
  or public.is_staff()
);
drop policy if exists service_offers_insert on public.service_offers;
create policy service_offers_insert on public.service_offers for insert with check (
  auth.uid() is not null
  and public.is_active_user()
  and public.is_company_member(company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
);
drop policy if exists service_offers_update on public.service_offers;
create policy service_offers_update on public.service_offers for update
  using (public.is_company_member(company_id) or public.is_staff())
  with check (public.is_company_member(company_id) or public.is_staff());
revoke all on public.service_offers from anon, authenticated;
grant select on public.service_offers to anon, authenticated;
grant insert (company_id, title, description, sector_slug, department_code, city, nationwide, available_from, available_until, capacity, from_opportunity_id)
  on public.service_offers to authenticated;
grant update (title, description, sector_slug, department_code, city, nationwide, available_from, available_until, capacity, status, removed_reason)
  on public.service_offers to authenticated;

-- Messagerie : une conversation peut naître d'une disponibilité (sans besoin publié)
alter table public.conversations add column if not exists service_offer_id uuid references public.service_offers (id) on delete set null;
create unique index if not exists conversations_offer_uniq on public.conversations (service_offer_id, buyer_company_id, supplier_company_id)
  where service_offer_id is not null;

-- Contacter l'entreprise d'une disponibilité : conversation (une par disponibilité et par entreprise
-- qui contacte), premier message, notification de l'entreprise disponible (en ligne et par e-mail).
create or replace function public.contact_service_offer(p_offer_id uuid, p_company_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); s record; v_conv uuid;
begin
  perform public.enforce_rate_limit('contact_service_offer', 20, 3600);
  select * into s from public.service_offers where id = p_offer_id;
  if s.id is null or s.status <> 'PUBLISHED' or s.expires_at <= now() or not public.is_company_active(s.company_id) then
    raise exception 'Disponibilité introuvable ou plus en ligne' using errcode = 'P0002';
  end if;
  if not public.is_company_member(p_company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_company_id = s.company_id then
    raise exception 'Il s''agit de votre propre disponibilité' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 10 then
    raise exception 'Votre message est trop court' using errcode = '22023';
  end if;
  insert into public.conversations (opportunity_id, service_offer_id, buyer_company_id, supplier_company_id, subject, created_by)
  values (null, p_offer_id, p_company_id, s.company_id, s.title, v_uid)
  on conflict (service_offer_id, buyer_company_id, supplier_company_id) where service_offer_id is not null
  do update set subject = excluded.subject
  returning id into v_conv;
  perform public.send_message(v_conv, p_body, null, null);
  insert into public.analytics_events (event_name, user_id, company_id, properties)
  values ('contact_company', v_uid, p_company_id, jsonb_build_object('service_offer_id', p_offer_id));
  return v_conv;
end;
$$;
revoke all on function public.contact_service_offer(uuid, uuid, text) from public, anon;
grant execute on function public.contact_service_offer(uuid, uuid, text) to authenticated;

-- Recatégoriser un « besoin » qui présente en fait les services de l'entreprise : la disponibilité est
-- créée avec son texte, repris tel quel ; le besoin est archivé (rien n'est supprimé) ; l'entreprise est
-- prévenue. Utilisé par la relecture automatique et par l'équipe.
create or replace function public.convert_need_to_service_offer(p_opportunity_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o record; v_id uuid; v_text text;
begin
  select * into o from public.opportunities where id = p_opportunity_id for update;
  if o.id is null or o.origin <> 'INTERNAL' or o.company_id is null then
    raise exception 'Besoin introuvable' using errcode = 'P0002';
  end if;
  select id into v_id from public.service_offers where from_opportunity_id = p_opportunity_id limit 1;
  if v_id is not null then
    return v_id;
  end if;
  perform public.trusted();
  v_text := btrim(coalesce(nullif(btrim(o.description), ''), nullif(btrim(o.summary), ''), o.title));
  if char_length(v_text) < 20 then
    v_text := btrim(o.title) || '. ' || v_text;
  end if;
  -- Texte trop long : coupé à la fin du dernier paragraphe complet (sinon du dernier mot), jamais au milieu
  if char_length(v_text) > 3000 then
    v_text := coalesce(
      substring(left(v_text, 3000) from '^(.*\S)\s*\n\s*\n'),
      substring(left(v_text, 3000) from '^(.*\S)\s'),
      left(v_text, 3000));
  end if;
  insert into public.service_offers (company_id, created_by, title, description, sector_slug, department_code, city, nationwide, from_opportunity_id)
  values (o.company_id, o.created_by, left(btrim(o.title), 140), left(v_text, 3000), o.sector_slug, o.department_code, o.city, o.department_code is null, o.id)
  returning id into v_id;
  update public.opportunities
     set status = 'ARCHIVED',
         moderation_note = coalesce(nullif(btrim(p_note), ''), 'Cette publication présente vos services : elle est maintenant dans « Disponibilités ».')
   where id = p_opportunity_id;
  perform public.log_audit('service_offer.converted', 'opportunity', p_opportunity_id::text, jsonb_build_object('service_offer_id', v_id, 'from', o.status));
  perform public.notify_company(o.company_id, 'service_offer_converted', 'Votre publication est maintenant une disponibilité',
    left(o.title, 120) || ' : elle présente ce que vous proposez. Elle apparaît donc dans « Disponibilités », où les entreprises qui cherchent un prestataire vous trouvent et vous écrivent.',
    '/disponibilites/' || v_id);
  return v_id;
end;
$$;
revoke all on function public.convert_need_to_service_offer(uuid, text) from public, anon, authenticated;
grant execute on function public.convert_need_to_service_offer(uuid, text) to service_role;
