-- Rappels automatiques aux demandeurs (un seul envoi par besoin et par type, préférence e-mail respectée) :
-- * besoin publié depuis 3 jours sans aucune réponse ni marque d'intérêt → conseils pour l'améliorer ;
-- * date limite de réponse dans moins de 48 h → point sur les réponses reçues.
create table if not exists public.need_reminders (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  kind text not null check (kind in ('no_response', 'deadline_soon')),
  sent_at timestamptz not null default now(),
  primary key (opportunity_id, kind)
);
alter table public.need_reminders enable row level security;
revoke all on public.need_reminders from anon, authenticated;

create or replace function public.process_need_reminders(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n_no int := 0;
  n_deadline int := 0;
  v_responses int;
begin
  -- Sans réponse après 3 jours (besoins publiés il y a moins de 30 jours, encore ouverts)
  for o in
    select op.id, op.title, op.company_id
      from public.opportunities op
     where op.origin = 'INTERNAL' and op.status = 'PUBLISHED' and op.company_id is not null
       and op.published_at <= now() - interval '3 days' and op.published_at > now() - interval '30 days'
       and (op.response_deadline is null or op.response_deadline > now() + interval '2 days')
       and not exists (select 1 from public.interests i where i.opportunity_id = op.id)
       and not exists (select 1 from public.proposals p where p.opportunity_id = op.id)
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
        into v_responses;
      perform public.notify_company(o.company_id, 'need_deadline_soon',
        'Date limite de votre besoin dans moins de 48 h',
        'La date limite de réponse de « ' || o.title || ' » approche. Réponses et marques d''intérêt reçues : ' || v_responses
          || '. Vous pouvez comparer les réponses, prolonger la date limite en modifiant le besoin, ou le clôturer.',
        '/dashboard/opportunites/' || o.id);
      n_deadline := n_deadline + 1;
    end if;
  end loop;

  return jsonb_build_object('no_response', n_no, 'deadline_soon', n_deadline);
end;
$$;
revoke execute on function public.process_need_reminders(int) from public, anon, authenticated;
grant execute on function public.process_need_reminders(int) to service_role;
