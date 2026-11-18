-- Rappel dans le site (notification, jamais d'e-mail) proposant une campagne de visibilité :
--   1. la fiche de l'entreprise est prête (description + au moins un métier), créée depuis au moins 1 jour ;
--   2. ou aucun message reçu depuis 14 jours (entreprise inscrite depuis au moins 14 jours).
-- Uniquement si l'entreprise n'a aucune campagne en attente ou en cours, et au plus une fois tous les 30 jours.
create or replace function public.process_visibility_nudges(p_limit int default 100)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select c.id, c.created_at,
      (cp.description is not null and char_length(cp.description) >= 40 and cardinality(cp.sectors) > 0) as ready,
      not exists (
        select 1 from conversations cv join messages m on m.conversation_id = cv.id
        where (cv.buyer_company_id = c.id or cv.supplier_company_id = c.id)
          and m.sender_company_id <> c.id and m.created_at > now() - interval '14 days'
      ) as quiet
    from companies c
    join company_profiles cp on cp.company_id = c.id
    where c.created_at < now() - interval '1 day'
      and c.status = 'ACTIVE' and not c.is_demo and not c.is_internal
      and exists (select 1 from company_members cm where cm.company_id = c.id)
      and not exists (select 1 from visibility_boosts b where b.company_id = c.id and b.status in ('PENDING', 'ACTIVE'))
      and not exists (
        select 1 from notifications n join company_members cm on cm.user_id = n.user_id
        where cm.company_id = c.id and n.type = 'visibility_suggestion' and n.created_at > now() - interval '30 days'
      )
    order by c.created_at desc
    limit p_limit * 5
  loop
    exit when v_count >= p_limit;
    if r.ready and r.created_at > now() - interval '14 days' then
      insert into notifications (user_id, type, title, body, link)
      select cm.user_id, 'visibility_suggestion', 'Votre fiche est prête : faites-la connaître',
        'Lancez une campagne : votre entreprise est présentée chaque jour aux entreprises que vous choisissez.', '/dashboard/visibilite'
      from company_members cm where cm.company_id = r.id;
      v_count := v_count + 1;
    elsif r.quiet and r.created_at < now() - interval '14 days' then
      insert into notifications (user_id, type, title, body, link)
      select cm.user_id, 'visibility_suggestion', 'Pas de nouveau contact depuis 2 semaines',
        'Une campagne présente votre entreprise chaque jour à des entreprises ciblées. Vous suivez qui lit et qui vous écrit.', '/dashboard/visibilite'
      from company_members cm where cm.company_id = r.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.process_visibility_nudges(int) from public, anon, authenticated;
grant execute on function public.process_visibility_nudges(int) to service_role;
