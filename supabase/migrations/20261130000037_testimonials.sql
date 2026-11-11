-- Témoignages de clients (preuve sociale) :
-- * un membre donne son avis depuis /avis (une fois, modifiable tant qu'il n'est pas publié) ;
-- * publication seulement avec son accord explicite (case non cochée par défaut) et après relecture
--   par l'équipe (statut APPROVED) ; jamais d'avis inventé ;
-- * demande d'avis par e-mail aux membres les plus actifs (revenus au moins 3 jours différents,
--   inscrits depuis 5 jours ou plus, e-mails acceptés) : le lundi et le vendredi seulement, une
--   demande puis au plus un rappel 14 jours plus tard ; plus rien dès que l'avis est donné.
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  author_name text not null check (char_length(author_name) between 2 and 120),
  author_role text check (author_role is null or char_length(author_role) <= 120),
  company_name text check (company_name is null or char_length(company_name) <= 160),
  -- Les étoiles seules suffisent : texte facultatif, mais au moins l'un des deux
  quote text check (quote is null or char_length(quote) between 3 and 600),
  rating smallint check (rating is null or rating between 1 and 5),
  consent_publish boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id) on delete set null,
  constraint testimonials_rating_or_quote check (rating is not null or quote is not null)
);
alter table public.testimonials enable row level security;
revoke all on public.testimonials from anon, authenticated;

create table if not exists public.testimonial_requests (
  user_id uuid primary key references public.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  -- 1 = première demande, 2 = rappel unique (au moins 14 jours plus tard) ; jamais plus
  sends smallint not null default 1
);
alter table public.testimonial_requests enable row level security;
revoke all on public.testimonial_requests from anon, authenticated;

-- Avis publiés (relus, accord de publication donné) pour l'accueil : nom, fonction, entreprise, logo
create or replace function public.public_testimonials(p_limit int default 6)
returns table (id uuid, author_name text, author_role text, company_name text, company_slug text, logo_path text, quote text, rating smallint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.author_name, t.author_role, coalesce(t.company_name, c.name), case when p.is_public then c.slug end,
         case when p.is_public then c.logo_path end, t.quote, t.rating, t.created_at
  from public.testimonials t
  join public.users u on u.id = t.user_id and u.status = 'ACTIVE' and not u.is_internal and not u.is_demo
  left join public.companies c on c.id = t.company_id and c.status = 'ACTIVE'
  left join public.company_profiles p on p.company_id = c.id
  where t.status = 'APPROVED' and t.consent_publish and t.quote is not null
  order by t.reviewed_at desc nulls last, t.created_at desc
  limit least(greatest(p_limit, 1), 12);
$$;
revoke all on function public.public_testimonials(int) from public;
grant execute on function public.public_testimonials(int) to anon, authenticated;

-- Note moyenne publiée (avis relus, accord de publication donné)
create or replace function public.public_rating()
returns table (average numeric, count bigint)
language sql stable security definer set search_path = '' as $$
  select round(avg(t.rating)::numeric, 1), count(t.rating)
  from public.testimonials t
  join public.users u on u.id = t.user_id and u.status = 'ACTIVE' and not u.is_internal and not u.is_demo
  where t.status = 'APPROVED' and t.consent_publish and t.rating is not null;
$$;
revoke all on function public.public_rating() from public;
grant execute on function public.public_rating() to anon, authenticated;

-- Demande d'avis aux membres les plus actifs (une seule fois par membre)
create or replace function public.process_testimonial_requests(p_limit int default 20)
returns int language plpgsql security definer set search_path = '' as $$
declare
  u record;
  n int := 0;
  v_reminder boolean;
begin
  -- Lundi et vendredi seulement (heure de Paris) : jamais plus de deux jours d'envoi par semaine
  if extract(isodow from (now() at time zone 'Europe/Paris')) not in (1, 5) then
    return 0;
  end if;
  for u in
    select us.id, us.email, us.full_name, r.sends
      from public.users us
      left join public.testimonial_requests r on r.user_id = us.id
     where us.status = 'ACTIVE' and not us.is_internal and not us.is_demo and us.platform_role = 'USER'
       and us.notify_email and us.email is not null
       and us.created_at <= now() - interval '5 days'
       and (select count(*) from public.user_visits v where v.user_id = us.id) >= 3
       -- Avis déjà donné : plus jamais de demande
       and not exists (select 1 from public.testimonials t where t.user_id = us.id)
       -- Première demande, ou rappel unique 14 jours après
       and (r.user_id is null or (r.sends = 1 and r.sent_at <= now() - interval '14 days'))
     order by (select count(*) from public.user_visits v where v.user_id = us.id) desc
     limit p_limit
  loop
    v_reminder := u.sends is not null;
    insert into public.testimonial_requests as tr (user_id) values (u.id)
      on conflict (user_id) do update set sends = tr.sends + 1, sent_at = now() where tr.sends = 1;
    if found then
      insert into public.email_outbox (user_id, to_email, template, subject, payload)
      values (u.id, u.email, 'testimonial_request',
        case when v_reminder then 'Une minute pour noter LinkProB2B ?' else 'Votre avis sur LinkProB2B (1 minute)' end,
        jsonb_build_object(
          'type', 'testimonial_request',
          'title', 'Votre avis compte pour nous',
          'paragraphs', jsonb_build_array(
            'Bonjour' || coalesce(' ' || nullif(split_part(trim(u.full_name), ' ', 1), ''), '') || ',',
            'Vous faites partie des membres qui utilisent le plus LinkProB2B : merci !',
            'Accepteriez-vous de lui donner une note sur 5 étoiles, et si vous le souhaitez, un mot sur ce que le site vous apporte ou ce qui vous manque ? Cela prend moins d''une minute et nous aide à l''améliorer.',
            'Si vous le souhaitez, et seulement avec votre accord, votre avis pourra aussi être affiché sur le site pour aider d''autres entreprises à nous découvrir.'
          ) || case when v_reminder then jsonb_build_array('C''est notre dernier message à ce sujet.') else '[]'::jsonb end,
          'link', '/avis'));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.process_testimonial_requests(int) from public, anon, authenticated;
grant execute on function public.process_testimonial_requests(int) to service_role;
