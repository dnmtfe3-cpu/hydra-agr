create or replace function public.report_found_animal(p_code text, p_message text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_animal public.animals%rowtype;
  v_id text := 'found-' || replace(gen_random_uuid()::text, '-', '');
  v_notification_id text := 'notification-' || replace(gen_random_uuid()::text, '-', '');
  v_finder_user_id uuid := auth.uid();
  v_finder_name text;
  v_guard jsonb;
  v_existing_id text;
begin
  if v_finder_user_id is null then
    raise exception 'Faça login no Hydra Agro para informar que encontrou este animal.';
  end if;

  v_guard := public.consume_api_rate_limit('found-animal-report', 5, 600);
  if coalesce((v_guard->>'allowed')::boolean, false) is not true then
    raise exception 'Muitas ocorrências em pouco tempo. Aguarde antes de tentar novamente.';
  end if;

  if p_code is null or length(trim(p_code)) < 3 or length(p_code) > 80 then
    raise exception 'Hydra ID inválido';
  end if;

  select * into v_animal from public.animals
  where id = p_code or hydra_code = p_code or identification = p_code
  limit 1;

  if v_animal.id is null then raise exception 'Animal não encontrado'; end if;
  if lower(coalesce(v_animal.status,'')) <> 'perdido' then raise exception 'Este animal não está marcado como perdido.'; end if;
  if v_animal.owner_user_id = v_finder_user_id then raise exception 'O proprietário não pode registrar o próprio animal como encontrado.'; end if;

  select id into v_existing_id
  from public.animal_found_reports
  where animal_id = v_animal.id
    and finder_user_id = v_finder_user_id
    and created_at > now() - interval '10 minutes'
    and status = 'open'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', true, 'reportId', v_existing_id, 'finderUserId', v_finder_user_id, 'duplicate', true);
  end if;

  select nullif(trim(full_name), '') into v_finder_name from public.profiles where id = v_finder_user_id;

  insert into public.animal_found_reports(id, animal_id, owner_user_id, finder_user_id, message)
  values(v_id, v_animal.id, v_animal.owner_user_id, v_finder_user_id, nullif(left(coalesce(p_message,''),500),''));

  insert into public.notifications(id, recipient_user_id, title, body, kind)
  values(v_notification_id, v_animal.owner_user_id, 'Encontraram um animal', coalesce(v_finder_name, 'Um usuário do Hydra Agro') || ' informou que encontrou ' || coalesce(v_animal.name, v_animal.identification) || '. Abra o aviso para entrar em contato.', 'hydra_tag_found');

  insert into public.hydra_tag_events(id, owner_user_id, animal_id, event_type, details, metadata)
  values('tag-event-' || replace(gen_random_uuid()::text, '-', ''), v_animal.owner_user_id, v_animal.id, 'found_report', 'Aviso enviado pela ficha pública da Hydra Tag', jsonb_build_object('reportId',v_id,'finderUserId',v_finder_user_id));

  return jsonb_build_object('ok', true, 'reportId', v_id, 'finderUserId', v_finder_user_id);
end;
$$;

revoke execute on function public.report_found_animal(text, text) from public, anon;
grant execute on function public.report_found_animal(text, text) to authenticated;
