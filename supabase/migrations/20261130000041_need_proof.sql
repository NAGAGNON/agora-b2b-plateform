-- Page « Publier un besoin » : ce qui se passe réellement après une publication (chiffres agrégés,
-- jamais de nom) : besoins publiés par des entreprises inscrites et entreprises du métier prévenues.
create or replace function public.public_need_proof()
returns jsonb language sql stable security definer set search_path = '' as $$
  with needs as (
    select o.id from public.opportunities o
    join public.companies c on c.id = o.company_id
    where o.origin = 'INTERNAL' and not o.is_demo and o.published_at is not null
      and not c.is_internal and not c.is_demo
  )
  select jsonb_build_object(
    'needs', (select count(*) from needs),
    'contacted',
      (select count(*) from public.outreach_recipients r
         join public.need_campaigns nc on nc.outreach_campaign_id = r.campaign_id
        where r.status = 'SENT' and nc.opportunity_id in (select id from needs))
      + (select count(*) from public.need_matches m where m.notified_at is not null and m.opportunity_id in (select id from needs))
  );
$$;
revoke all on function public.public_need_proof() from public;
grant execute on function public.public_need_proof() to anon, authenticated;
