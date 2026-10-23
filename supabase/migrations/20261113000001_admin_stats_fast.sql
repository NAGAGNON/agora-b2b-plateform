-- Vue d'ensemble admin : un seul passage sur les annonces et sur les événements des 30 derniers
-- jours (au lieu d'une dizaine de lectures complètes), pour rester sous quelques secondes.
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  o record;
  a record;
begin
  perform public.require_staff();
  select
    count(*) filter (where status = 'PUBLISHED' and origin = 'INTERNAL') as published,
    count(*) filter (where status = 'PUBLISHED' and origin = 'EXTERNAL') as external,
    count(*) filter (where status = 'PENDING_REVIEW') as pending,
    count(*) filter (where status = 'EXPIRED') as expired,
    count(*) filter (where type in ('PRIVATE_CONSULTATION', 'PRIVATE_TENDER', 'QUOTE_REQUEST') and status <> 'DRAFT') as consultations,
    count(*) filter (where is_demo) as demo
  into o from public.opportunities;
  select
    count(distinct company_id) as companies_active,
    count(*) filter (where event_name = 'search_opportunities') as searches,
    count(*) filter (where event_name = 'view_opportunity') as views,
    count(*) filter (where event_name = 'source_outbound_clicked') as outbound,
    count(*) filter (where event_name = 'express_interest') as interests
  into a from public.analytics_events where created_at > now() - interval '30 days';
  return jsonb_build_object(
    'users_total', (select count(*) from public.users where status <> 'DELETED'),
    'users_active_30d', (select count(*) from public.users where last_seen_at > now() - interval '30 days'),
    'users_suspended', (select count(*) from public.users where status = 'SUSPENDED'),
    'companies_total', (select count(*) from public.companies),
    'companies_completed', (select count(*) from public.company_profiles p
        where coalesce(p.description, '') <> '' and cardinality(p.sectors) > 0 and cardinality(p.skills) > 0),
    'companies_active', a.companies_active,
    'companies_verified', (select count(*) from public.companies where verified_at is not null),
    'opportunities_published', o.published,
    'opportunities_external', o.external,
    'opportunities_pending', o.pending,
    'opportunities_expired', o.expired,
    'consultations', o.consultations,
    'interests', (select count(*) from public.interests),
    'proposals', (select count(*) from public.proposals where status <> 'WITHDRAWN'),
    'conversations', (select count(*) from public.conversations),
    'reports_open', (select count(*) from public.reports where status in ('OPEN', 'REVIEWING')),
    'sources_total', (select count(*) from public.external_sources),
    'sources_approved', (select count(*) from public.external_sources where status = 'APPROVED'),
    'searches_30d', a.searches,
    'views_30d', a.views,
    'outbound_clicks_30d', a.outbound,
    'interests_30d', a.interests,
    'contact_messages_open', (select count(*) from public.contact_messages where not handled),
    'demo_records', o.demo + (select count(*) from public.companies where is_demo)
  );
end;
$$;
