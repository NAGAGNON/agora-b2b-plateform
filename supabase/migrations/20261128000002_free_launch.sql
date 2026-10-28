-- Phase de lancement : toutes les fonctionnalités sont gratuites pour les inscrits.
-- Interrupteur « billing.free_launch » (absent = activé). Tant qu'il est activé, l'offre Gratuite
-- applique les droits de l'offre la plus complète : aucune limite commerciale (favoris, alertes,
-- besoins actifs, pipeline, recommandations, membres). Seule subsiste la limite anti-abus de
-- l'offre la plus complète sur les demandes de contact (300 par mois).
-- Retour arrière : passer la valeur à false ; les offres et leurs limites futures sont inchangées.

insert into public.platform_settings (key, value, description)
values ('billing.free_launch', 'true'::jsonb, 'Phase de lancement : toutes les fonctionnalités gratuites (false = limites de l''offre Gratuite appliquées)')
on conflict (key) do nothing;

create or replace function public.free_launch()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = 'billing.free_launch'), true);
$$;
grant execute on function public.free_launch() to anon, authenticated, service_role;

-- Droits effectifs d'une offre : l'offre Gratuite reçoit ceux de l'offre Business pendant le lancement.
create or replace function public.plan_feature(p_plan text, p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select features -> p_key from public.plans
  where code = case when p_plan = 'FREE' and public.free_launch() then 'BUSINESS' else p_plan end;
$$;

-- Affichage « Mon abonnement » : mêmes droits effectifs que ceux appliqués.
create or replace function public.company_usage(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_plan text; v_since timestamptz := date_trunc('month', now());
begin
  if not (public.is_company_member(p_company_id) or public.is_staff()) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  v_plan := public.company_plan(p_company_id);
  return jsonb_build_object(
    'plan', v_plan,
    'free_launch', public.free_launch(),
    'features', (select features from public.plans where code = case when v_plan = 'FREE' and public.free_launch() then 'BUSINESS' else v_plan end),
    'active_needs', (select count(*) from public.opportunities where company_id = p_company_id and origin = 'INTERNAL' and status in ('PENDING_REVIEW', 'PUBLISHED')),
    'contact_requests_month', (select count(distinct opportunity_id) from (
        select opportunity_id from public.interests where company_id = p_company_id and created_at >= v_since
        union all
        select opportunity_id from public.proposals where company_id = p_company_id and submitted_at >= v_since) t),
    'favorites', (select count(*) from public.favorites where user_id = auth.uid()),
    'alerts', (select count(*) from public.alerts where user_id = auth.uid()),
    'members', (select count(*) from public.company_members where company_id = p_company_id)
  );
end;
$$;
