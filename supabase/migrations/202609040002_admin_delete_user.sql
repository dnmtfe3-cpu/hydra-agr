create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_email text;
begin
  if public.current_user_role() <> 'owner'::public.app_role then
    raise exception 'Somente o proprietário do aplicativo pode excluir contas' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta administrativa';
  end if;

  if exists (
    select 1 from public.roles
    where user_id = target_user_id and role = 'owner'::public.app_role
  ) then
    raise exception 'A conta proprietária não pode ser excluída por este painel';
  end if;

  select email into target_email from auth.users where id = target_user_id;
  if target_email is null then
    raise exception 'Usuário não encontrado';
  end if;

  update public.admin_announcements set created_by = auth.uid() where created_by = target_user_id;
  update public.admin_links set created_by = auth.uid() where created_by = target_user_id;

  insert into public.audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'user.delete',
    'user',
    target_user_id::text,
    jsonb_build_object('email', target_email)
  );

  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
