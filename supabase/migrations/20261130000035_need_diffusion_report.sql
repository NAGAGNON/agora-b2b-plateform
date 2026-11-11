-- Valeur visible rapidement pour qui publie un besoin :
-- * « rapport de diffusion » unique environ 24 h après la publication : vues, entreprises inscrites
--   prévenues, entreprises spécialisées contactées par e-mail (chiffres réellement enregistrés) ;
-- * le rappel « sans réponse » ne part plus si le besoin a déjà reçu un message (sans compte ou
--   conversation) : il disait à tort « aucune réponse ».
alter table public.need_reminders drop constraint if exists need_reminders_kind_check;
alter table public.need_reminders add constraint need_reminders_kind_check check (kind in ('no_response', 'deadline_soon', 'diffusion'));

create or replace function public.notification_category(p_type text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_type in ('need_no_response', 'need_deadline_soon', 'need_diffusion') then 'need_reminders'
    when p_type in ('pipeline_due', 'deadline_soon') then 'pipeline'
    when p_type in ('need_match', 'alert_match') then 'matching'
    when p_type like 'opportunity\_%' or p_type in ('proposal_status', 'interest_status') then 'status'
    else null
  end
$$;

create or replace function public.process_need_reminders(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n_no int := 0;
  n_deadline int := 0;
  n_diffusion int := 0;
  v_responses int;
  v_views int;
  v_members int;
  v_emails int;
  v_msgs int;
  v_body text;
begin
  -- Rapport de diffusion, une fois, entre 20 h et 7 jours après la publication
  for o in
    select op.id, op.title, op.company_id
      from public.opportunities op
     where op.origin = 'INTERNAL' and op.status = 'PUBLISHED' and op.company_id is not null and not op.is_demo
       and op.published_at <= now() - interval '20 hours' and op.published_at > now() - interval '7 days'
       and not exists (select 1 from public.need_reminders r where r.opportunity_id = op.id and r.kind = 'diffusion')
     order by op.published_at
     limit p_limit
  loop
    select count(*) into v_views from public.analytics_events e
      where e.event_name = 'view_opportunity' and e.properties->>'opportunity_id' = o.id::text;
    select count(*) into v_members from public.need_matches m where m.opportunity_id = o.id and m.notified_at is not null;
    select count(*) into v_emails from public.outreach_recipients r
      join public.need_campaigns nc on nc.outreach_campaign_id = r.campaign_id
      where nc.opportunity_id = o.id and r.status = 'SENT';
    select (select count(*) from public.need_contacts c where c.opportunity_id = o.id)
         + (select count(*) from public.conversations cv where cv.opportunity_id = o.id)
         + (select count(*) from public.interests i where i.opportunity_id = o.id)
         + (select count(*) from public.proposals p where p.opportunity_id = o.id)
      into v_msgs;
    -- Rien à montrer : pas d'e-mail (le rappel « sans réponse » prendra le relais)
    continue when v_views + v_members + v_emails + v_msgs = 0;
    insert into public.need_reminders (opportunity_id, kind) values (o.id, 'diffusion') on conflict do nothing;
    if found then
      v_body := 'Votre besoin « ' || o.title || ' » est en ligne et circule : ';
      v_body := v_body || array_to_string(array_remove(array[
        case when v_views > 0 then v_views || ' consultation' || case when v_views > 1 then 's' else '' end end,
        case when v_members > 0 then v_members || ' entreprise' || case when v_members > 1 then 's' else '' end || ' inscrite' || case when v_members > 1 then 's' else '' end || ' du même métier prévenue' || case when v_members > 1 then 's' else '' end end,
        case when v_emails > 0 then v_emails || ' entreprise' || case when v_emails > 1 then 's' else '' end || ' spécialisée' || case when v_emails > 1 then 's' else '' end || ' contactée' || case when v_emails > 1 then 's' else '' end || ' par e-mail' end,
        case when v_msgs > 0 then v_msgs || ' réponse' || case when v_msgs > 1 then 's' else '' end || ' ou message' || case when v_msgs > 1 then 's' else '' end || ' reçu' || case when v_msgs > 1 then 's' else '' end end
      ], null), ', ') || '. La diffusion continue automatiquement les prochains jours. Suivez tout depuis votre espace.';
      perform public.notify_company(o.company_id, 'need_diffusion', 'Votre besoin est diffusé', v_body, '/dashboard/opportunites/' || o.id);
      n_diffusion := n_diffusion + 1;
    end if;
  end loop;

  -- Sans réponse après 3 jours (besoins publiés il y a moins de 30 jours, encore ouverts)
  for o in
    select op.id, op.title, op.company_id
      from public.opportunities op
     where op.origin = 'INTERNAL' and op.status = 'PUBLISHED' and op.company_id is not null
       and op.published_at <= now() - interval '3 days' and op.published_at > now() - interval '30 days'
       and (op.response_deadline is null or op.response_deadline > now() + interval '2 days')
       and not exists (select 1 from public.interests i where i.opportunity_id = op.id)
       and not exists (select 1 from public.proposals p where p.opportunity_id = op.id)
       and not exists (select 1 from public.need_contacts c where c.opportunity_id = op.id)
       and not exists (select 1 from public.conversations cv where cv.opportunity_id = op.id)
       and not exists (select 1 from public.need_reminders r where r.opportunity_id = op.id and r.kind = 'no_response')
     order by op.published_at
     limit p_limit
  loop
    insert into public.need_reminders (opportunity_id, kind) values (o.id, 'no_response') on conflict do nothing;
    if found then
      perform public.notify_company(o.company_id, 'need_no_response',
        'Votre besoin n''a pas encore reçu de réponse',
        'Votre besoin « ' || o.title || ' » est en ligne depuis 3 jours sans réponse. Quelques précisions (budget, délai, lieu, pièces jointes) aident les entreprises à répondre : consultez nos conseils et les entreprises suggérées.',
        '/dashboard/opportunites/' || o.id);
      n_no := n_no + 1;
    end if;
  end loop;

  -- Date limite dans moins de 48 h
  for o in
    select op.id, op.title, op.company_id
      from public.opportunities op
     where op.origin = 'INTERNAL' and op.status = 'PUBLISHED' and op.company_id is not null
       and op.response_deadline > now() and op.response_deadline <= now() + interval '48 hours'
       and not exists (select 1 from public.need_reminders r where r.opportunity_id = op.id and r.kind = 'deadline_soon')
     order by op.response_deadline
     limit p_limit
  loop
    insert into public.need_reminders (opportunity_id, kind) values (o.id, 'deadline_soon') on conflict do nothing;
    if found then
      select (select count(*) from public.interests i where i.opportunity_id = o.id)
           + (select count(*) from public.proposals p where p.opportunity_id = o.id)
           + (select count(*) from public.need_contacts c where c.opportunity_id = o.id)
        into v_responses;
      perform public.notify_company(o.company_id, 'need_deadline_soon',
        'Date limite de votre besoin dans moins de 48 h',
        'La date limite de réponse de « ' || o.title || ' » approche. Réponses et marques d''intérêt reçues : ' || v_responses
          || '. Vous pouvez comparer les réponses, prolonger la date limite en modifiant le besoin, ou le clôturer.',
        '/dashboard/opportunites/' || o.id || '?onglet=comparer');
      n_deadline := n_deadline + 1;
    end if;
  end loop;

  return jsonb_build_object('diffusion', n_diffusion, 'no_response', n_no, 'deadline_soon', n_deadline);
end;
$$;
revoke execute on function public.process_need_reminders(int) from public, anon, authenticated;
grant execute on function public.process_need_reminders(int) to service_role;
