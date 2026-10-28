-- Purge des lignes de campagne inutiles plus rapide : liens et événements supprimés directement
-- (par paquets) plutôt qu'en cascade ligne à ligne. Le passage de l'après-midi du 28/10 n'avait
-- pas tenu dans le temps imparti ; il restait ~625 000 lignes anciennes (base au-delà de 0,5 Go).
create or replace function public.purge_campaign_placeholders(p_limit int default 5000)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  create temp table if not exists purge_ids (id uuid primary key) on commit drop;
  truncate purge_ids;
  insert into purge_ids
    select r.id from public.outreach_recipients r
    join public.outreach_campaigns c on c.id = r.campaign_id
    where r.status in ('NO_EMAIL', 'FREQUENCY', 'SUPPRESSED', 'EXCLUDED')
      and c.kind <> 'NEED'
      and c.campaign_date < (now() at time zone 'Europe/Paris')::date - 1
    limit greatest(1, least(p_limit, 20000));
  delete from public.outreach_recipient_opportunities where recipient_id in (select id from purge_ids);
  delete from public.outreach_events where recipient_id in (select id from purge_ids);
  delete from public.outreach_recipients where id in (select id from purge_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_campaign_placeholders(int) from public, anon, authenticated;
grant execute on function public.purge_campaign_placeholders(int) to service_role;
