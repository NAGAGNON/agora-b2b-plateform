-- Campagnes de visibilité : garantie et emplacements sur le site.
-- 1) Garantie : une campagne qui arrive à son terme sans avoir présenté l'entreprise au nombre prévu
--    d'entreprises est prolongée une fois, gratuitement, du nombre de jours nécessaire (au plus sa durée).
alter table public.visibility_boosts add column if not exists guarantee_extended_days int not null default 0;

create or replace function public.extend_underdelivered_boosts()
returns int language plpgsql security definer set search_path = '' as $$
declare b record; v_done int; v_missing int; v_days int; n int := 0;
begin
  for b in
    select * from public.visibility_boosts
     where status = 'ACTIVE' and target = 'COMPANY' and daily_presentations > 0
       and guarantee_extended_days = 0 and ends_at <= now() + interval '1 hour'
  loop
    select count(*) into v_done from public.boost_presentations p where p.boost_id = b.id;
    v_missing := b.daily_presentations * b.duration_days - v_done;
    if v_missing <= 0 then continue; end if;
    v_days := least(b.duration_days, ceil(v_missing::numeric / b.daily_presentations)::int);
    update public.visibility_boosts
       set ends_at = ends_at + make_interval(days => v_days), guarantee_extended_days = v_days
     where id = b.id;
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values ('visibility.guarantee_extended', 'visibility_boost', b.id::text, jsonb_build_object('days', v_days, 'missing', v_missing));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.extend_underdelivered_boosts() from public, anon, authenticated;
grant execute on function public.extend_underdelivered_boosts() to service_role;

-- 2) Entreprises en campagne d'un métier (données publiques de leur fiche) : proposées sur les fiches
--    d'appels d'offres de ce métier (« besoin d'un partenaire ? ») et en tête des disponibilités.
create or replace function public.campaign_companies(p_sector text default null, p_limit int default 3)
returns table (id uuid, name text, slug text, city text, logo_path text, tagline text, ad_title text)
language sql stable security definer set search_path = '' as $$
  select distinct on (c.id) c.id, c.name, c.slug, c.city, c.logo_path, cp.tagline,
         case when b.ad_status = 'APPROVED' then b.ad_title end
    from public.visibility_boosts b
    join public.companies c on c.id = b.company_id
    left join public.company_profiles cp on cp.company_id = c.id
   where b.status = 'ACTIVE' and b.target = 'COMPANY' and b.ends_at > now()
     and c.status = 'ACTIVE' and not c.is_demo
     and (p_sector is null or p_sector = any(coalesce(cp.sectors, '{}')))
   order by c.id, b.created_at desc
   limit least(greatest(coalesce(p_limit, 3), 1), 6);
$$;
revoke all on function public.campaign_companies(text, int) from public;
grant execute on function public.campaign_companies(text, int) to anon, authenticated;
