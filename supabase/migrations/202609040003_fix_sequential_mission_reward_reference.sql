create or replace function public.sync_farm_mission_progress()
returns table(
  mission_ordinal integer,
  tier text,
  title text,
  description text,
  reward integer,
  current_value bigint,
  target_value bigint,
  xp integer,
  level integer,
  level_progress integer,
  completed_count integer,
  total_missions integer,
  complete boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.farm_mission_progress%rowtype;
  v_def public.farm_mission_definitions%rowtype;
  v_next public.farm_mission_definitions%rowtype;
  v_metric bigint;
  v_seed bigint;
  v_seed_xp integer;
  v_seed_count integer;
  v_level integer;
  v_progress integer;
begin
  if v_owner is null then
    raise exception 'Sessão obrigatória' using errcode='42501';
  end if;

  select p.* into v_state
  from public.farm_mission_progress p
  where p.owner_user_id = v_owner
  for update;

  if not found then
    v_seed := public.farm_xp_legacy_snapshot(v_owner);

    with cumulative as (
      select d.ordinal,
             sum(d.reward) over(order by d.ordinal) as total
      from public.farm_mission_definitions d
    )
    select coalesce(max(c.total) filter(where c.total <= v_seed), 0)::int,
           coalesce(max(c.ordinal) filter(where c.total <= v_seed), 0)::int
    into v_seed_xp, v_seed_count
    from cumulative c;

    select d.* into v_def
    from public.farm_mission_definitions d
    where d.ordinal = v_seed_count + 1;

    v_metric := case
      when v_def.ordinal is null then 0
      else public.farm_mission_metric_value(v_owner, v_def.metric)
    end;

    insert into public.farm_mission_progress(owner_user_id, mission_ordinal, baseline_value, xp, completed_count)
    values(v_owner, least(v_seed_count + 1, 51), v_metric, v_seed_xp, v_seed_count)
    returning * into v_state;
  end if;

  loop
    exit when v_state.mission_ordinal > 50;

    select d.* into v_def
    from public.farm_mission_definitions d
    where d.ordinal = v_state.mission_ordinal;

    exit when v_def.ordinal is null;

    v_metric := public.farm_mission_metric_value(v_owner, v_def.metric);
    exit when greatest(0, v_metric - v_state.baseline_value) < v_def.target_delta;

    v_state.xp := least(5000, v_state.xp + v_def.reward);
    v_state.completed_count := v_def.ordinal;
    v_state.mission_ordinal := v_def.ordinal + 1;

    if v_state.mission_ordinal <= 50 then
      select d.* into v_next
      from public.farm_mission_definitions d
      where d.ordinal = v_state.mission_ordinal;
      v_state.baseline_value := public.farm_mission_metric_value(v_owner, v_next.metric);
    else
      v_state.baseline_value := 0;
    end if;

    update public.farm_mission_progress p
    set mission_ordinal = v_state.mission_ordinal,
        baseline_value = v_state.baseline_value,
        xp = v_state.xp,
        completed_count = v_state.completed_count,
        updated_at = now()
    where p.owner_user_id = v_owner;
  end loop;

  if v_state.xp >= 5000 then
    v_level := 10;
  else
    v_level := least(9, floor(v_state.xp / 500.0)::int + 1);
  end if;

  if v_level = 10 then
    v_progress := 100;
  elsif v_level = 9 then
    v_progress := greatest(0, least(99, round(((v_state.xp - 4000) / 1000.0) * 100)::int));
  else
    v_progress := greatest(0, least(100, round(((v_state.xp - ((v_level - 1) * 500)) / 500.0) * 100)::int));
  end if;

  if v_state.mission_ordinal <= 50 then
    select d.* into v_def
    from public.farm_mission_definitions d
    where d.ordinal = v_state.mission_ordinal;

    v_metric := public.farm_mission_metric_value(v_owner, v_def.metric);

    return query
    select v_def.ordinal,
           v_def.tier,
           v_def.title,
           v_def.description,
           v_def.reward,
           greatest(0, v_metric - v_state.baseline_value),
           v_def.target_delta,
           v_state.xp,
           v_level,
           v_progress,
           v_state.completed_count,
           50,
           false;
  else
    return query
    select 51,
           'complete'::text,
           'Trilha concluída'::text,
           'Todas as missões foram concluídas.'::text,
           0,
           0::bigint,
           0::bigint,
           v_state.xp,
           10,
           100,
           50,
           50,
           true;
  end if;
end;
$$;
