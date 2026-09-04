-- Trilha de 50 missões: 5 principais, 15 médias e 30 difíceis.
-- Recompensas: 200 XP + 1500 XP + 3300 XP = 5000 XP.

create or replace function public.farm_xp_for_owner(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with stats as (
    select
      exists(select 1 from public.properties p where p.owner_user_id = p_owner and nullif(trim(p.name),'') is not null and nullif(trim(p.municipality),'') is not null and nullif(trim(p.main_activity),'') is not null) as property_complete,
      (select count(*) from public.animals a where a.owner_user_id = p_owner) as animals,
      (select count(*) from public.animals a where a.owner_user_id = p_owner and nullif(trim(a.electronic_id),'') is not null) as identified,
      (select count(distinct w.recorded_on) from public.water_records w where w.owner_user_id = p_owner) as water_days,
      (select count(*) from public.activities a where a.owner_user_id = p_owner and a.done = true) as completed_activities,
      (select count(*) from public.monitoring_records m where m.owner_user_id = p_owner) as monitoring,
      coalesce((select sum(n.read_count) from public.nfc_tags n where n.owner_user_id = p_owner), 0) as nfc_reads
  )
  select least(5000,
    (case when property_complete then 40 else 0 end)
    + (case when animals >= 1 then 40 else 0 end)
    + (case when identified >= 1 then 40 else 0 end)
    + (case when completed_activities >= 1 then 40 else 0 end)
    + (case when water_days >= 1 then 40 else 0 end)
    + 100 * (
      (animals >= 3)::int + (animals >= 5)::int + (animals >= 10)::int
      + (identified >= 3)::int + (identified >= 5)::int + (identified >= 8)::int
      + (completed_activities >= 3)::int + (completed_activities >= 5)::int + (completed_activities >= 10)::int
      + (monitoring >= 1)::int + (monitoring >= 3)::int + (monitoring >= 5)::int
      + (water_days >= 3)::int + (water_days >= 5)::int + (water_days >= 7)::int
    )
    + 110 * (
      (animals >= 15)::int + (animals >= 20)::int + (animals >= 30)::int + (animals >= 40)::int + (animals >= 50)::int
      + (identified >= 10)::int + (identified >= 15)::int + (identified >= 20)::int + (identified >= 30)::int + (identified >= 40)::int
      + (completed_activities >= 15)::int + (completed_activities >= 25)::int + (completed_activities >= 40)::int + (completed_activities >= 60)::int + (completed_activities >= 100)::int
      + (monitoring >= 10)::int + (monitoring >= 20)::int + (monitoring >= 30)::int + (monitoring >= 50)::int + (monitoring >= 75)::int
      + (water_days >= 10)::int + (water_days >= 20)::int + (water_days >= 30)::int + (water_days >= 60)::int + (water_days >= 90)::int
      + (nfc_reads >= 10)::int + (nfc_reads >= 25)::int + (nfc_reads >= 50)::int + (nfc_reads >= 100)::int + (nfc_reads >= 200)::int
    )
  )::bigint
  from stats;
$$;

grant execute on function public.farm_xp_for_owner(uuid) to authenticated;
