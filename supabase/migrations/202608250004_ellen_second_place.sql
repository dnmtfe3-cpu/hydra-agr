-- Reserva a Fazenda Bananeira (conta da Ellen) como 2º lugar no ranking.
-- Mantém o dono do app no nível 10 / 5.000 XP e deixa Ellen logo abaixo com 4.500 XP.

create or replace function public.farm_xp_for_owner(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with identity as (
    select
      exists(select 1 from public.roles r where r.user_id = p_owner and r.role = 'owner') as is_app_owner,
      exists(select 1 from auth.users u where u.id = p_owner and lower(u.email) = lower('ell3nlim42107@gmail.com')) as is_ellen
  ), stats as (
    select
      identity.is_app_owner,
      identity.is_ellen,
      exists(select 1 from public.properties p where p.owner_user_id = p_owner and nullif(trim(p.name),'') is not null and nullif(trim(p.municipality),'') is not null and nullif(trim(p.main_activity),'') is not null) as property_complete,
      (select count(*) from public.animals a where a.owner_user_id = p_owner) as animals,
      (select count(*) from public.animals a where a.owner_user_id = p_owner and nullif(trim(a.electronic_id),'') is not null) as identified,
      (select count(distinct w.recorded_on) from public.water_records w where w.owner_user_id = p_owner) as water_days,
      (select count(*) from public.activities a where a.owner_user_id = p_owner and a.done = true) as completed_activities,
      (select count(*) from public.monitoring_records m where m.owner_user_id = p_owner) as monitoring,
      (select count(*) from public.property_sectors s where s.owner_user_id = p_owner) as sectors,
      coalesce((select sum(n.read_count) from public.nfc_tags n where n.owner_user_id = p_owner), 0) as nfc_reads
    from identity
  )
  select case
    when is_app_owner then 5000
    when is_ellen then 4500
    else least(4499,
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
    )::bigint
  end
  from stats;
$$;

grant execute on function public.farm_xp_for_owner(uuid) to authenticated;
