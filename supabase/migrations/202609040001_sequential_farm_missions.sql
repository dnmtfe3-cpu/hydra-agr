create table if not exists public.farm_mission_definitions (
  ordinal integer primary key check (ordinal between 1 and 50),
  tier text not null check (tier in ('main','medium','hard')),
  title text not null,
  description text not null,
  metric text not null,
  target_delta bigint not null check (target_delta > 0),
  reward integer not null check (reward > 0)
);

create table if not exists public.farm_mission_progress (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  mission_ordinal integer not null default 1,
  baseline_value bigint not null default 0,
  xp integer not null default 0 check (xp between 0 and 5000),
  completed_count integer not null default 0 check (completed_count between 0 and 50),
  updated_at timestamptz not null default now()
);

alter table public.farm_mission_progress enable row level security;
revoke all on public.farm_mission_progress from anon, authenticated;
revoke all on public.farm_mission_definitions from anon, authenticated;

delete from public.farm_mission_definitions;
insert into public.farm_mission_definitions (ordinal,tier,title,description,metric,target_delta,reward) values
(1,'main','Propriedade pronta','Complete os dados principais da propriedade.','property_complete',1,40),
(2,'main','Primeiro animal','Cadastre 1 animal depois que esta missão for liberada.','animals',1,40),
(3,'main','Primeira identificação','Vincule NFC/RFID em 1 animal depois que esta missão for liberada.','identified',1,40),
(4,'main','Primeira atividade','Conclua 1 atividade depois que esta missão for liberada.','activities',1,40),
(5,'main','Primeiro controle de água','Registre 1 novo dia de controle de água.','water_days',1,40),
(6,'medium','Rebanho crescendo I','Cadastre mais 2 animais.','animals',2,100),
(7,'medium','Rotina ativa I','Conclua mais 3 atividades.','activities',3,100),
(8,'medium','Monitoramento I','Faça mais 2 monitoramentos.','monitoring',2,100),
(9,'medium','Identificação I','Identifique mais 2 animais com NFC/RFID.','identified',2,100),
(10,'medium','Água em dia I','Registre mais 3 dias diferentes de água.','water_days',3,100),
(11,'medium','Rebanho crescendo II','Cadastre mais 3 animais.','animals',3,100),
(12,'medium','Rotina ativa II','Conclua mais 5 atividades.','activities',5,100),
(13,'medium','Monitoramento II','Faça mais 3 monitoramentos.','monitoring',3,100),
(14,'medium','Identificação II','Identifique mais 3 animais com NFC/RFID.','identified',3,100),
(15,'medium','Água em dia II','Registre mais 4 dias diferentes de água.','water_days',4,100),
(16,'medium','NFC em campo I','Faça mais 5 leituras NFC/RFID.','nfc_reads',5,100),
(17,'medium','Rebanho crescendo III','Cadastre mais 5 animais.','animals',5,100),
(18,'medium','Rotina ativa III','Conclua mais 8 atividades.','activities',8,100),
(19,'medium','Monitoramento III','Faça mais 5 monitoramentos.','monitoring',5,100),
(20,'medium','Água em dia III','Registre mais 7 dias diferentes de água.','water_days',7,100),
(21,'hard','Rebanho avançado I','Cadastre mais 6 animais.','animals',6,110),
(22,'hard','Identificação avançada I','Identifique mais 5 animais.','identified',5,110),
(23,'hard','Rotina avançada I','Conclua mais 10 atividades.','activities',10,110),
(24,'hard','Monitoramento avançado I','Faça mais 7 monitoramentos.','monitoring',7,110),
(25,'hard','Água avançada I','Registre mais 10 dias diferentes de água.','water_days',10,110),
(26,'hard','NFC em campo II','Faça mais 10 leituras NFC/RFID.','nfc_reads',10,110),
(27,'hard','Rebanho avançado II','Cadastre mais 8 animais.','animals',8,110),
(28,'hard','Identificação avançada II','Identifique mais 7 animais.','identified',7,110),
(29,'hard','Rotina avançada II','Conclua mais 15 atividades.','activities',15,110),
(30,'hard','Monitoramento avançado II','Faça mais 10 monitoramentos.','monitoring',10,110),
(31,'hard','Água avançada II','Registre mais 14 dias diferentes de água.','water_days',14,110),
(32,'hard','NFC em campo III','Faça mais 20 leituras NFC/RFID.','nfc_reads',20,110),
(33,'hard','Rebanho avançado III','Cadastre mais 10 animais.','animals',10,110),
(34,'hard','Identificação avançada III','Identifique mais 9 animais.','identified',9,110),
(35,'hard','Rotina avançada III','Conclua mais 20 atividades.','activities',20,110),
(36,'hard','Monitoramento avançado III','Faça mais 15 monitoramentos.','monitoring',15,110),
(37,'hard','Água avançada III','Registre mais 20 dias diferentes de água.','water_days',20,110),
(38,'hard','NFC em campo IV','Faça mais 30 leituras NFC/RFID.','nfc_reads',30,110),
(39,'hard','Rebanho mestre I','Cadastre mais 12 animais.','animals',12,110),
(40,'hard','Identificação mestre I','Identifique mais 12 animais.','identified',12,110),
(41,'hard','Rotina mestre I','Conclua mais 25 atividades.','activities',25,110),
(42,'hard','Monitoramento mestre I','Faça mais 20 monitoramentos.','monitoring',20,110),
(43,'hard','Água mestre I','Registre mais 25 dias diferentes de água.','water_days',25,110),
(44,'hard','NFC mestre I','Faça mais 40 leituras NFC/RFID.','nfc_reads',40,110),
(45,'hard','Rebanho mestre II','Cadastre mais 15 animais.','animals',15,110),
(46,'hard','Identificação mestre II','Identifique mais 15 animais.','identified',15,110),
(47,'hard','Rotina mestre II','Conclua mais 30 atividades.','activities',30,110),
(48,'hard','Monitoramento mestre II','Faça mais 25 monitoramentos.','monitoring',25,110),
(49,'hard','Água mestre II','Registre mais 30 dias diferentes de água.','water_days',30,110),
(50,'hard','Missão final NFC','Faça mais 50 leituras NFC/RFID e conclua a trilha.','nfc_reads',50,110);

create or replace function public.farm_mission_metric_value(p_owner uuid, p_metric text)
returns bigint language plpgsql stable security definer set search_path=public as $$
begin
  case p_metric
    when 'property_complete' then return case when exists(select 1 from public.properties p where p.owner_user_id=p_owner and nullif(trim(p.name),'') is not null and nullif(trim(p.municipality),'') is not null and nullif(trim(p.main_activity),'') is not null) then 1 else 0 end;
    when 'animals' then return (select count(*) from public.animals a where a.owner_user_id=p_owner);
    when 'identified' then return (select count(*) from public.animals a where a.owner_user_id=p_owner and nullif(trim(a.electronic_id),'') is not null);
    when 'activities' then return (select count(*) from public.activities a where a.owner_user_id=p_owner and a.done=true);
    when 'monitoring' then return (select count(*) from public.monitoring_records m where m.owner_user_id=p_owner);
    when 'water_days' then return (select count(distinct w.recorded_on) from public.water_records w where w.owner_user_id=p_owner);
    when 'nfc_reads' then return coalesce((select sum(n.read_count) from public.nfc_tags n where n.owner_user_id=p_owner),0);
    else return 0;
  end case;
end; $$;

create or replace function public.farm_xp_legacy_snapshot(p_owner uuid)
returns bigint language sql stable security definer set search_path=public as $$
with stats as (
  select
    exists(select 1 from public.properties p where p.owner_user_id=p_owner and nullif(trim(p.name),'') is not null and nullif(trim(p.municipality),'') is not null and nullif(trim(p.main_activity),'') is not null) property_complete,
    (select count(*) from public.animals a where a.owner_user_id=p_owner) animals,
    (select count(*) from public.animals a where a.owner_user_id=p_owner and nullif(trim(a.electronic_id),'') is not null) identified,
    (select count(distinct w.recorded_on) from public.water_records w where w.owner_user_id=p_owner) water_days,
    (select count(*) from public.activities a where a.owner_user_id=p_owner and a.done=true) completed_activities,
    (select count(*) from public.monitoring_records m where m.owner_user_id=p_owner) monitoring,
    coalesce((select sum(n.read_count) from public.nfc_tags n where n.owner_user_id=p_owner),0) nfc_reads
)
select least(5000,
(case when property_complete then 40 else 0 end)+(case when animals>=1 then 40 else 0 end)+(case when identified>=1 then 40 else 0 end)+(case when completed_activities>=1 then 40 else 0 end)+(case when water_days>=1 then 40 else 0 end)
+100*((animals>=3)::int+(animals>=5)::int+(animals>=10)::int+(identified>=3)::int+(identified>=5)::int+(identified>=8)::int+(completed_activities>=3)::int+(completed_activities>=5)::int+(completed_activities>=10)::int+(monitoring>=1)::int+(monitoring>=3)::int+(monitoring>=5)::int+(water_days>=3)::int+(water_days>=5)::int+(water_days>=7)::int)
+110*((animals>=15)::int+(animals>=20)::int+(animals>=30)::int+(animals>=40)::int+(animals>=50)::int+(identified>=10)::int+(identified>=15)::int+(identified>=20)::int+(identified>=30)::int+(identified>=40)::int+(completed_activities>=15)::int+(completed_activities>=25)::int+(completed_activities>=40)::int+(completed_activities>=60)::int+(completed_activities>=100)::int+(monitoring>=10)::int+(monitoring>=20)::int+(monitoring>=30)::int+(monitoring>=50)::int+(monitoring>=75)::int+(water_days>=10)::int+(water_days>=20)::int+(water_days>=30)::int+(water_days>=60)::int+(water_days>=90)::int+(nfc_reads>=10)::int+(nfc_reads>=25)::int+(nfc_reads>=50)::int+(nfc_reads>=100)::int+(nfc_reads>=200)::int))::bigint from stats;
$$;

create or replace function public.sync_farm_mission_progress()
returns table(mission_ordinal integer,tier text,title text,description text,reward integer,current_value bigint,target_value bigint,xp integer,level integer,level_progress integer,completed_count integer,total_missions integer,complete boolean)
language plpgsql security definer set search_path=public as $$
declare
  v_owner uuid:=auth.uid(); v_state public.farm_mission_progress%rowtype; v_def public.farm_mission_definitions%rowtype; v_next public.farm_mission_definitions%rowtype;
  v_metric bigint; v_seed bigint; v_seed_xp integer; v_seed_count integer; v_level integer; v_progress integer;
begin
  if v_owner is null then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
  select * into v_state from public.farm_mission_progress where owner_user_id=v_owner for update;
  if not found then
    v_seed:=public.farm_xp_legacy_snapshot(v_owner);
    with cumulative as (select ordinal,sum(reward) over(order by ordinal) total from public.farm_mission_definitions)
    select coalesce(max(total) filter(where total<=v_seed),0)::int,coalesce(max(ordinal) filter(where total<=v_seed),0)::int into v_seed_xp,v_seed_count from cumulative;
    select * into v_def from public.farm_mission_definitions where ordinal=v_seed_count+1;
    v_metric:=case when v_def.ordinal is null then 0 else public.farm_mission_metric_value(v_owner,v_def.metric) end;
    insert into public.farm_mission_progress(owner_user_id,mission_ordinal,baseline_value,xp,completed_count) values(v_owner,least(v_seed_count+1,51),v_metric,v_seed_xp,v_seed_count) returning * into v_state;
  end if;
  loop
    exit when v_state.mission_ordinal>50;
    select * into v_def from public.farm_mission_definitions where ordinal=v_state.mission_ordinal;
    exit when v_def.ordinal is null;
    v_metric:=public.farm_mission_metric_value(v_owner,v_def.metric);
    exit when greatest(0,v_metric-v_state.baseline_value)<v_def.target_delta;
    v_state.xp:=least(5000,v_state.xp+v_def.reward); v_state.completed_count:=v_def.ordinal; v_state.mission_ordinal:=v_def.ordinal+1;
    if v_state.mission_ordinal<=50 then select * into v_next from public.farm_mission_definitions where ordinal=v_state.mission_ordinal; v_state.baseline_value:=public.farm_mission_metric_value(v_owner,v_next.metric); else v_state.baseline_value:=0; end if;
    update public.farm_mission_progress set mission_ordinal=v_state.mission_ordinal,baseline_value=v_state.baseline_value,xp=v_state.xp,completed_count=v_state.completed_count,updated_at=now() where owner_user_id=v_owner;
  end loop;
  if v_state.xp>=5000 then v_level:=10; else v_level:=least(9,floor(v_state.xp/500.0)::int+1); end if;
  if v_level=10 then v_progress:=100; elsif v_level=9 then v_progress:=greatest(0,least(99,round(((v_state.xp-4000)/1000.0)*100)::int)); else v_progress:=greatest(0,least(100,round(((v_state.xp-((v_level-1)*500))/500.0)*100)::int)); end if;
  if v_state.mission_ordinal<=50 then
    select * into v_def from public.farm_mission_definitions where ordinal=v_state.mission_ordinal; v_metric:=public.farm_mission_metric_value(v_owner,v_def.metric);
    return query select v_def.ordinal,v_def.tier,v_def.title,v_def.description,v_def.reward,greatest(0,v_metric-v_state.baseline_value),v_def.target_delta,v_state.xp,v_level,v_progress,v_state.completed_count,50,false;
  else return query select 51,'complete'::text,'Trilha concluída'::text,'Todas as missões foram concluídas.'::text,0,0::bigint,0::bigint,v_state.xp,10,100,50,50,true; end if;
end; $$;

grant execute on function public.sync_farm_mission_progress() to authenticated;

create or replace function public.farm_xp_for_owner(p_owner uuid)
returns bigint language sql stable security definer set search_path=public as $$
select coalesce((select p.xp::bigint from public.farm_mission_progress p where p.owner_user_id=p_owner),(with cumulative as (select ordinal,sum(reward) over(order by ordinal) total from public.farm_mission_definitions) select coalesce(max(total) filter(where total<=public.farm_xp_legacy_snapshot(p_owner)),0)::bigint from cumulative));
$$;
