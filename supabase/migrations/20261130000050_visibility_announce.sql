-- Annonce du service « Visibilité » (validée par le propriétaire) : membres sans entreprise → créer leur
-- entreprise et la faire connaître ; entreprise sans besoin publié → publier un besoin gratuitement.
-- Au plus une annonce tous les 14 jours, deux au total par personne, le mardi seulement ; jamais après
-- que la personne a créé son entreprise ET publié un besoin, ni après une demande de visibilité.
insert into public.platform_settings (key, value, description)
values ('visibility_announce', '{"enabled": true}'::jsonb, 'Annonce du service Visibilité aux membres sans entreprise ou sans besoin publié (validée par le propriétaire)')
on conflict (key) do nothing;

create table if not exists public.visibility_announce_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  variant text not null check (variant in ('NO_COMPANY', 'NO_NEED')),
  sent_at timestamptz not null default now()
);
create index if not exists visibility_announce_sends_user_idx on public.visibility_announce_sends (user_id, sent_at desc);
alter table public.visibility_announce_sends enable row level security;
revoke all on public.visibility_announce_sends from anon, authenticated;
grant all on public.visibility_announce_sends to service_role;

create or replace function public.process_visibility_announce(p_limit int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u record;
  n int := 0;
  v_first text;
begin
  if not coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'visibility_announce'), false) then
    return jsonb_build_object('inactive', true);
  end if;
  -- Le mardi seulement (heure de Paris)
  if extract(isodow from (now() at time zone 'Europe/Paris')) <> 2 then return jsonb_build_object('envoyees', 0, 'jour', 'pas mardi'); end if;
  for u in
    select us.id, us.email, us.full_name,
           case when not exists (select 1 from public.company_members m join public.companies c on c.id = m.company_id
                                  where m.user_id = us.id and c.status = 'ACTIVE') then 'NO_COMPANY' else 'NO_NEED' end as variant
      from public.users us
     where us.status = 'ACTIVE' and not us.is_internal and not us.is_demo and us.platform_role = 'USER'
       and us.notify_email and coalesce(us.email, '') <> ''
       and coalesce(us.notify_prefs ->> 'product_news', 'true') <> 'false'
       and us.created_at < now() - interval '3 days'
       -- Pas d'annonce depuis 14 jours, et deux au plus
       and not exists (select 1 from public.visibility_announce_sends s where s.user_id = us.id and s.sent_at > now() - interval '14 days')
       and (select count(*) from public.visibility_announce_sends s where s.user_id = us.id) < 2
       -- Pas de demande de visibilité déjà faite
       and not exists (select 1 from public.visibility_boosts b join public.company_members m on m.company_id = b.company_id where m.user_id = us.id)
       -- Sans entreprise, ou entreprise sans besoin publié
       and (
         not exists (select 1 from public.company_members m join public.companies c on c.id = m.company_id where m.user_id = us.id and c.status = 'ACTIVE')
         or not exists (select 1 from public.company_members m join public.opportunities o on o.company_id = m.company_id
                         where m.user_id = us.id and o.origin = 'INTERNAL' and o.status in ('PUBLISHED', 'PENDING_REVIEW', 'CLOSED'))
       )
     order by us.last_seen_at desc nulls last
     limit p_limit
  loop
    v_first := nullif(split_part(trim(u.full_name), ' ', 1), '');
    insert into public.email_outbox (user_id, to_email, template, subject, payload)
    values (u.id, u.email, 'visibility_announce',
      case when u.variant = 'NO_COMPANY' then 'Nouveau : faites connaître votre entreprise, gratuitement' else 'Publiez votre besoin : nous le présentons aux bonnes entreprises' end,
      jsonb_build_object(
        'type', 'visibility_announce',
        'title', case when u.variant = 'NO_COMPANY' then 'Faites connaître votre entreprise' else 'Trouvez votre prestataire en publiant un besoin' end,
        'paragraphs', case when u.variant = 'NO_COMPANY' then jsonb_build_array(
            'Bonjour' || coalesce(' ' || v_first, '') || ',',
            'Nouveau sur LinkProB2B : nous présentons votre entreprise chaque jour à des entreprises de votre métier et de votre région, inscrites sur la plateforme et de notre base.',
            'Il suffit de créer la fiche de votre entreprise (2 minutes) et de cocher « Faire connaître mon entreprise ». C''est offert pendant la phase de lancement.',
            'Vous choisissez à qui vous êtes présenté, et vous suivez les résultats jour après jour dans votre espace.')
          else jsonb_build_array(
            'Bonjour' || coalesce(' ' || v_first, '') || ',',
            'Vous cherchez un prestataire, un fournisseur ou un sous-traitant ? Publiez votre besoin sur LinkProB2B : c''est gratuit et cela prend 2 minutes.',
            'Nous le présentons ensuite aux entreprises du métier et de votre région, inscrites sur la plateforme et de notre base, et vous recevez leurs réponses directement.',
            'Vous suivez jour après jour combien d''entreprises l''ont vu et vous ont répondu.') end,
        'link', case when u.variant = 'NO_COMPANY' then '/onboarding/entreprise' else '/publier' end,
        'cta', case when u.variant = 'NO_COMPANY' then 'Créer ma fiche entreprise' else 'Publier mon besoin gratuitement' end));
    insert into public.visibility_announce_sends (user_id, variant) values (u.id, u.variant);
    n := n + 1;
  end loop;
  return jsonb_build_object('envoyees', n);
end;
$$;
revoke all on function public.process_visibility_announce(int) from public, anon, authenticated;
grant execute on function public.process_visibility_announce(int) to service_role;
