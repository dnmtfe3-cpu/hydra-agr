alter table public.animal_found_reports
  add column if not exists finder_user_id uuid references auth.users(id) on delete set null;

create index if not exists animal_found_reports_finder_user_idx
  on public.animal_found_reports(finder_user_id, created_at desc);

create or replace function public.report_found_animal(p_code text, p_message text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_animal public.animals%rowtype;
  v_id text := 'found-' || replace(gen_random_uuid()::text, '-', '');
  v_notification_id text := 'notification-' || replace(gen_random_uuid()::text, '-', '');
  v_finder_user_id uuid := auth.uid();
  v_finder_name text;
begin
  if v_finder_user_id is null then
    raise exception 'Faça login no Hydra Agro para informar que encontrou este animal.';
  end if;

  select * into v_animal from public.animals
  where id = p_code or hydra_code = p_code or identification = p_code
  limit 1;
  if v_animal.id is null then raise exception 'Animal não encontrado'; end if;
  if v_animal.owner_user_id = v_finder_user_id then
    raise exception 'O proprietário não pode registrar o próprio animal como encontrado.';
  end if;

  select nullif(trim(full_name), '') into v_finder_name
  from public.profiles
  where id = v_finder_user_id;

  insert into public.animal_found_reports(id, animal_id, owner_user_id, finder_user_id, message)
  values(v_id, v_animal.id, v_animal.owner_user_id, v_finder_user_id, nullif(left(coalesce(p_message,''),500),''));

  insert into public.notifications(id, recipient_user_id, title, body, kind)
  values(
    v_notification_id,
    v_animal.owner_user_id,
    'Encontraram um animal',
    coalesce(v_finder_name, 'Um usuário do Hydra Agro') || ' informou que encontrou ' || coalesce(v_animal.name, v_animal.identification) || '. Abra o aviso para entrar em contato.',
    'hydra_tag_found'
  );

  insert into public.hydra_tag_events(id, owner_user_id, animal_id, event_type, details, metadata)
  values(
    'tag-event-' || replace(gen_random_uuid()::text, '-', ''),
    v_animal.owner_user_id,
    v_animal.id,
    'found_report',
    'Aviso enviado pela ficha pública da Hydra Tag',
    jsonb_build_object('reportId',v_id,'finderUserId',v_finder_user_id)
  );

  return jsonb_build_object('ok', true, 'reportId', v_id, 'finderUserId', v_finder_user_id);
end;
$function$;

create or replace function public.found_report_contact(p_report_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_report public.animal_found_reports%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;

  select * into v_report
  from public.animal_found_reports
  where id = p_report_id
  limit 1;

  if v_report.id is null or v_report.finder_user_id is null then
    raise exception 'Contato não disponível';
  end if;

  if auth.uid() <> v_report.owner_user_id and auth.uid() <> v_report.finder_user_id then
    raise exception 'Acesso não autorizado';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_report.finder_user_id;

  select email into v_email
  from auth.users
  where id = v_report.finder_user_id;

  return jsonb_build_object(
    'reportId', v_report.id,
    'finderUserId', v_report.finder_user_id,
    'name', coalesce(nullif(trim(v_profile.full_name), ''), 'Usuário Hydra Agro'),
    'phone', coalesce(v_profile.phone, ''),
    'email', coalesce(v_email, ''),
    'avatarPath', v_profile.avatar_path,
    'message', coalesce(v_report.message, ''),
    'createdAt', v_report.created_at
  );
end;
$function$;

revoke all on function public.found_report_contact(text) from public;
revoke all on function public.found_report_contact(text) from anon;
grant execute on function public.found_report_contact(text) to authenticated;
