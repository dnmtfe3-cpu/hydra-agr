create or replace function public.public_animal_by_hydra_code(p_code text)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', a.id,
    'identification', coalesce(nullif(trim(a.hydra_code), ''), a.identification),
    'name', a.name,
    'species', a.species,
    'breed', a.breed,
    'sex', a.sex,
    'birthDate', case when a.birth_date is not null then to_char(a.birth_date, 'YYYY-MM-DD') else null end,
    'weight', a.weight,
    'status', a.status,
    'propertyName', p.name,
    'municipality', p.municipality,
    'state', p.state,
    'lost', lower(coalesce(a.status, '')) = 'perdido'
  )
  from public.animals a
  join public.properties p on p.id = a.property_id
  where
    a.id = trim(p_code)
    or lower(coalesce(a.hydra_code, '')) = lower(trim(p_code))
    or lower(coalesce(a.identification, '')) = lower(trim(p_code))
  limit 1;
$function$;
