create table if not exists public.animal_found_sightings (
  id text primary key,
  finder_user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null,
  municipality text not null,
  state text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.animal_found_sightings enable row level security;

drop policy if exists "finder can read own animal sightings" on public.animal_found_sightings;
create policy "finder can read own animal sightings"
on public.animal_found_sightings for select
to authenticated
using (finder_user_id = auth.uid());

create index if not exists animal_found_sightings_region_idx
  on public.animal_found_sightings(lower(state), lower(municipality), created_at desc);

create or replace function public.safe_animal_lookup(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_animal public.animals%rowtype;
begin
  if p_code is null or length(trim(p_code)) < 3 or length(p_code) > 80 then
    return jsonb_build_object('found', false, 'responsibleLocated', false);
  end if;

  select * into v_animal
  from public.animals
  where lower(trim(id)) = lower(trim(p_code))
     or lower(trim(coalesce(hydra_code, ''))) = lower(trim(p_code))
     or lower(trim(identification)) = lower(trim(p_code))
     or lower(trim(coalesce(electronic_id, ''))) = lower(trim(p_code))
  limit 1;

  if v_animal.id is null then
    return jsonb_build_object('found', false, 'responsibleLocated', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'responsibleLocated', true,
    'lost', lower(coalesce(v_animal.status, '')) = 'perdido'
  );
end;
$$;

revoke execute on function public.safe_animal_lookup(text) from public;
grant execute on function public.safe_animal_lookup(text) to authenticated;

create or replace function public.report_found_animal_safe(
  p_code text,
  p_municipality text default null,
  p_state text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_animal public.animals%rowtype;
  v_finder uuid := auth.uid();
  v_report_id text := 'found-' || replace(gen_random_uuid()::text, '-', '');
  v_notification_id text := 'notification-' || replace(gen_random_uuid()::text, '-', '');
  v_message text;
  v_guard jsonb;
begin
  if v_finder is null then
    raise exception 'Faça login para avisar o responsável.';
  end if;

  v_guard := public.consume_api_rate_limit('found-animal-safe', 8, 600);
  if coalesce((v_guard->>'allowed')::boolean, false) is not true then
    raise exception 'Muitos avisos em pouco tempo. Aguarde antes de tentar novamente.';
  end if;

  if p_code is null or length(trim(p_code)) < 3 or length(p_code) > 80 then
    raise exception 'Código inválido.';
  end if;

  select * into v_animal
  from public.animals
  where lower(trim(id)) = lower(trim(p_code))
     or lower(trim(coalesce(hydra_code, ''))) = lower(trim(p_code))
     or lower(trim(identification)) = lower(trim(p_code))
     or lower(trim(coalesce(electronic_id, ''))) = lower(trim(p_code))
  limit 1;

  if v_animal.id is null then raise exception 'Animal não encontrado.'; end if;
  if v_animal.owner_user_id = v_finder then raise exception 'Este animal pertence ao seu próprio cadastro.'; end if;

  v_message := 'Animal avistado por outro usuário do Hydra Agro.';
  if nullif(trim(coalesce(p_municipality, '')), '') is not null then
    v_message := v_message || ' Região aproximada informada: ' || left(trim(p_municipality), 80);
    if nullif(trim(coalesce(p_state, '')), '') is not null then
      v_message := v_message || '/' || upper(left(trim(p_state), 2));
    end if;
    v_message := v_message || '.';
  end if;

  insert into public.animal_found_reports(id, animal_id, owner_user_id, finder_user_id, message)
  values(v_report_id, v_animal.id, v_animal.owner_user_id, v_finder, v_message);

  insert into public.notifications(id, recipient_user_id, title, body, kind)
  values(
    v_notification_id,
    v_animal.owner_user_id,
    'Animal encontrado',
    'Um usuário identificou um animal vinculado ao seu cadastro. Abra o Hydra Agro para conferir a ocorrência.',
    'hydra_tag_found'
  );

  insert into public.hydra_tag_events(id, owner_user_id, animal_id, event_type, details, metadata)
  values(
    'tag-event-' || replace(gen_random_uuid()::text, '-', ''),
    v_animal.owner_user_id,
    v_animal.id,
    'found_report',
    'Aviso enviado pelo fluxo Animal Encontrado',
    jsonb_build_object('reportId', v_report_id, 'finderUserId', v_finder)
  );

  return jsonb_build_object('ok', true, 'reportId', v_report_id);
end;
$$;

revoke execute on function public.report_found_animal_safe(text, text, text) from public, anon;
grant execute on function public.report_found_animal_safe(text, text, text) to authenticated;

create or replace function public.report_unknown_found_animal(
  p_photo_path text,
  p_municipality text,
  p_state text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_finder uuid := auth.uid();
  v_sighting_id text := 'sighting-' || replace(gen_random_uuid()::text, '-', '');
  v_guard jsonb;
  v_owner uuid;
  v_count integer := 0;
  v_notification_id text;
begin
  if v_finder is null then raise exception 'Faça login para registrar o animal encontrado.'; end if;

  v_guard := public.consume_api_rate_limit('found-animal-unknown', 5, 900);
  if coalesce((v_guard->>'allowed')::boolean, false) is not true then
    raise exception 'Muitas ocorrências em pouco tempo. Aguarde antes de tentar novamente.';
  end if;

  if p_photo_path is null or length(trim(p_photo_path)) < 3 or length(p_photo_path) > 240 then
    raise exception 'Foto inválida.';
  end if;
  if p_municipality is null or length(trim(p_municipality)) < 2 or length(p_municipality) > 100 then
    raise exception 'Município inválido.';
  end if;
  if p_state is null or length(trim(p_state)) <> 2 then
    raise exception 'UF inválida.';
  end if;

  insert into public.animal_found_sightings(id, finder_user_id, photo_path, municipality, state)
  values(v_sighting_id, v_finder, left(trim(p_photo_path),240), left(trim(p_municipality),100), upper(trim(p_state)));

  for v_owner in
    select distinct a.owner_user_id
    from public.animals a
    join public.properties p on p.owner_user_id = a.owner_user_id
    where lower(coalesce(a.status, '')) = 'perdido'
      and lower(trim(coalesce(p.municipality, ''))) = lower(trim(p_municipality))
      and upper(trim(coalesce(p.state, ''))) = upper(trim(p_state))
      and a.owner_user_id <> v_finder
    limit 12
  loop
    v_count := v_count + 1;
    v_notification_id := 'notification-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.notifications(id, recipient_user_id, title, body, kind)
    values(
      v_notification_id,
      v_owner,
      'Possível animal encontrado na sua região',
      'Um usuário registrou a foto de um animal encontrado na mesma região de um animal seu marcado como perdido. Abra o Hydra Agro para conferir.',
      'possible_found_animal'
    );
  end loop;

  return jsonb_build_object('ok', true, 'sightingId', v_sighting_id, 'possibleMatches', v_count);
end;
$$;

revoke execute on function public.report_unknown_found_animal(text, text, text) from public, anon;
grant execute on function public.report_unknown_found_animal(text, text, text) to authenticated;
