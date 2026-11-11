-- Témoignages de clients (preuve sociale) :
-- * un membre donne son avis depuis /avis (une fois, modifiable tant qu'il n'est pas publié) ;
-- * publication seulement avec son accord explicite (case non cochée par défaut) et après relecture
--   par l'équipe (statut APPROVED) ; jamais d'avis inventé ;
-- * demande d'avis par e-mail, une seule fois, aux membres les plus actifs (revenus au moins
--   3 jours différents, inscrits depuis 5 jours ou plus, e-mails acceptés).
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  author_name text not null check (char_length(author_name) between 2 and 120),
  author_role text check (author_role is null or char_length(author_role) <= 120),
  company_name text check (company_name is null or char_length(company_name) <= 160),
  quote text not null check (char_length(quote) between 20 and 600),
  rating smallint check (rating is null or rating between 1 and 5),
  consent_publish boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id) on delete set null
);
alter table public.testimonials enable row level security;
revoke all on public.testimonials from anon, authenticated;

create table if not exists public.testimonial_requests (
  user_id uuid primary key references public.users (id) on delete cascade,
  sent_at timestamptz not null default now()
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
  where t.status = 'APPROVED' and t.consent_publish
  order by t.reviewed_at desc nulls last, t.created_at desc
  limit least(greatest(p_limit, 1), 12);
$$;
revoke all on function public.public_testimonials(int) from public;
grant execute on function public.public_testimonials(int) to anon, authenticated;

-- Demande d'avis aux membres les plus actifs (une seule fois par membre)
create or replace function public.process_testimonial_requests(p_limit int default 20)
returns int language plpgsql security definer set search_path = '' as $$
declare
  u record;
  n int := 0;
begin
  for u in
    select us.id, us.email, us.full_name
      from public.users us
     where us.status = 'ACTIVE' and not us.is_internal and not us.is_demo and us.platform_role = 'USER'
       and us.notify_email and us.email is not null
       and us.created_at <= now() - interval '5 days'
       and (select count(*) from public.user_visits v where v.user_id = us.id) >= 3
       and not exists (select 1 from public.testimonial_requests r where r.user_id = us.id)
       and not exists (select 1 from public.testimonials t where t.user_id = us.id)
     order by (select count(*) from public.user_visits v where v.user_id = us.id) desc
     limit p_limit
  loop
    insert into public.testimonial_requests (user_id) values (u.id) on conflict do nothing;
    if found then
      insert into public.email_outbox (user_id, to_email, template, subject, payload)
      values (u.id, u.email, 'testimonial_request', 'Votre avis sur LinkProB2B (2 minutes)',
        jsonb_build_object(
          'type', 'testimonial_request',
          'title', 'Votre avis compte pour nous',
          'paragraphs', jsonb_build_array(
            'Bonjour' || coalesce(' ' || nullif(split_part(trim(u.full_name), ' ', 1), ''), '') || ',',
            'Vous faites partie des membres qui utilisent le plus LinkProB2B : merci !',
            'Accepteriez-vous de nous dire, en une ou deux phrases, ce que le site vous apporte ou ce qui vous manque ? Cela nous aide à l''améliorer.',
            'Si vous le souhaitez, et seulement avec votre accord, votre avis pourra aussi être affiché sur le site pour aider d''autres entreprises à nous découvrir.'
          ),
          'link', '/avis'));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.process_testimonial_requests(int) from public, anon, authenticated;
grant execute on function public.process_testimonial_requests(int) to service_role;
