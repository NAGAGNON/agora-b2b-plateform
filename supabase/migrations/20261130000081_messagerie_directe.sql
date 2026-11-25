-- Messagerie directe entre entreprises : depuis l'annuaire, une entreprise peut écrire à une autre
-- sans passer par une offre ni une disponibilité. Une seule conversation directe par paire
-- d'entreprises (dans un sens ou dans l'autre) : un nouveau message reprend la conversation existante.
-- Aucune donnée existante modifiée ni supprimée.

alter table public.conversations add column if not exists direct boolean not null default false;

create unique index if not exists conversations_direct_uniq
  on public.conversations (least(buyer_company_id, supplier_company_id), greatest(buyer_company_id, supplier_company_id))
  where direct;

create or replace function public.contact_company(p_target_company_id uuid, p_company_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_active_user(); v_conv uuid;
begin
  perform public.enforce_rate_limit('contact_company', 20, 3600);
  if not public.is_company_member(p_company_id) or not public.is_company_active(p_company_id) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_target_company_id = p_company_id then
    raise exception 'Il s''agit de votre propre entreprise' using errcode = '22023';
  end if;
  -- Seules les entreprises visibles dans l'annuaire peuvent être contactées
  if not exists (
    select 1 from public.companies c join public.company_profiles p on p.company_id = c.id
     where c.id = p_target_company_id and c.status = 'ACTIVE' and p.is_public and not c.is_internal
  ) then
    raise exception 'Entreprise introuvable' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 10 then
    raise exception 'Votre message est trop court' using errcode = '22023';
  end if;
  select id into v_conv from public.conversations
   where direct
     and least(buyer_company_id, supplier_company_id) = least(p_company_id, p_target_company_id)
     and greatest(buyer_company_id, supplier_company_id) = greatest(p_company_id, p_target_company_id);
  if v_conv is null then
    insert into public.conversations (opportunity_id, service_offer_id, direct, buyer_company_id, supplier_company_id, subject, created_by)
    values (null, null, true, p_company_id, p_target_company_id, 'Prise de contact', v_uid)
    on conflict do nothing
    returning id into v_conv;
    if v_conv is null then
      select id into v_conv from public.conversations
       where direct
         and least(buyer_company_id, supplier_company_id) = least(p_company_id, p_target_company_id)
         and greatest(buyer_company_id, supplier_company_id) = greatest(p_company_id, p_target_company_id);
    end if;
  end if;
  perform public.send_message(v_conv, p_body, null, null);
  insert into public.analytics_events (event_name, user_id, company_id, properties)
  values ('contact_company', v_uid, p_company_id, jsonb_build_object('direct', true, 'target_company_id', p_target_company_id));
  return v_conv;
end;
$$;
revoke all on function public.contact_company(uuid, uuid, text) from public, anon;
grant execute on function public.contact_company(uuid, uuid, text) to authenticated;
