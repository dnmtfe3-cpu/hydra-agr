-- Sistema unificado de XP, missões e recompensa vitalícia do nível 10.

create or replace function public.farm_xp_for_owner(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with stats as (
    select
      exists(select 1 from public.roles r where r.user_id = p_owner and r.role = 'owner') as is_app_owner,
      exists(select 1 from public.properties p where p.owner_user_id = p_owner and nullif(trim(p.name),'') is not null and nullif(trim(p.municipality),'') is not null and nullif(trim(p.main_activity),'') is not null) as property_complete,
      (select count(*) from public.animals a where a.owner_user_id = p_owner) as animals,
      (select count(*) from public.animals a where a.owner_user_id = p_owner and nullif(trim(a.electronic_id),'') is not null) as identified,
      (select count(distinct w.recorded_on) from public.water_records w where w.owner_user_id = p_owner) as water_days,
      (select count(*) from public.activities a where a.owner_user_id = p_owner and a.done = true) as completed_activities,
      (select count(*) from public.monitoring_records m where m.owner_user_id = p_owner) as monitoring,
      (select count(*) from public.property_sectors s where s.owner_user_id = p_owner) as sectors,
      coalesce((select sum(n.read_count) from public.nfc_tags n where n.owner_user_id = p_owner), 0) as nfc_reads
  )
  select case when is_app_owner then 5000 else least(5000,
      (case when property_complete then 250 else 0 end)
      + least(animals, 10) * 50
      + least(identified, 10) * 100
      + least(water_days, 7) * 50
      + least(completed_activities, 10) * 50
      + least(monitoring, 10) * 75
      + least(sectors, 3) * 100
      + least(nfc_reads, 35) * 10
      + (case when property_complete then 200 else 0 end)
      + (case when identified >= 5 then 200 else 0 end)
      + (case when completed_activities >= 10 then 200 else 0 end)
      + (case when monitoring >= 5 then 200 else 0 end)
      + (case when water_days >= 7 then 200 else 0 end)
    )::bigint end
  from stats;
$$;

grant execute on function public.farm_xp_for_owner(uuid) to authenticated;

create or replace function public.property_ranking()
returns table ("position" bigint, property_id text, property_name text, municipality text, xp bigint, is_mine boolean)
language sql stable security definer set search_path = public, auth, pg_temp
as $$
  with property_scores as (
    select p.id property_id, p.owner_user_id, p.name property_name, p.municipality, public.farm_xp_for_owner(p.owner_user_id) xp
    from public.properties p
    join public.profiles pr on pr.id = p.owner_user_id
    where nullif(trim(p.name), '') is not null and pr.banned_at is null
  ), ranked as (
    select row_number() over (order by xp desc, lower(property_name), property_id) as pos, property_scores.* from property_scores
  )
  select pos, property_id, property_name, municipality, xp, owner_user_id = auth.uid()
  from ranked
  where auth.uid() is not null and public.is_active_user()
  order by pos
  limit 50;
$$;

grant execute on function public.property_ranking() to authenticated;

create or replace function public.regional_farm_ranking(p_municipality text default null)
returns table (owner_user_id uuid, property_name text, municipality text, owner_name text, avatar_path text, xp bigint)
language sql stable security definer set search_path = public
as $$
  select p.owner_user_id, p.name, p.municipality, coalesce(pr.full_name,'Produtor'), pr.avatar_path, public.farm_xp_for_owner(p.owner_user_id)
  from public.properties p
  left join public.profiles pr on pr.id = p.owner_user_id
  where nullif(trim(p.name),'') is not null
    and nullif(trim(p.municipality),'') is not null
    and (p_municipality is null or trim(p_municipality) = '' or p.municipality = p_municipality)
  order by public.farm_xp_for_owner(p.owner_user_id) desc, p.name asc
  limit 3;
$$;

grant execute on function public.regional_farm_ranking(text) to authenticated;

create or replace function public.sync_level10_vip()
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  score bigint;
begin
  if uid is null then return false; end if;
  score := public.farm_xp_for_owner(uid);
  if score < 5000 then return false; end if;

  insert into public.subscriptions (user_id, plan, status, premium_started_at, premium_expires_at, premium_deactivated_at)
  values (uid, 'plus', 'active', now(), null, null)
  on conflict (user_id) do update set
    plan = 'plus',
    status = 'active',
    premium_started_at = coalesce(public.subscriptions.premium_started_at, now()),
    premium_expires_at = null,
    premium_deactivated_at = null,
    updated_at = now();
  return true;
end;
$$;

revoke all on function public.sync_level10_vip() from public;
grant execute on function public.sync_level10_vip() to authenticated;
