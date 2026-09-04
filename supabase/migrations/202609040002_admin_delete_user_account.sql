create or replace function public.admin_delete_user_account(target_user_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare target_role public.app_role;
begin
  if public.current_user_role() not in ('owner'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Somente proprietário ou administrador pode excluir contas' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Você não pode excluir a própria conta pelo painel';
  end if;

  select role into target_role from public.roles where user_id = target_user_id;
  if target_role = 'owner'::public.app_role then
    raise exception 'A conta proprietária não pode ser excluída';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'Usuário não encontrado';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user_account(uuid) from public;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;
