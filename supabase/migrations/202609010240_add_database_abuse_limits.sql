create or replace function public.enforce_user_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_endpoint text := tg_argv[0];
  v_limit integer := tg_argv[1]::integer;
  v_window integer := tg_argv[2]::integer;
  v_guard jsonb;
begin
  if auth.uid() is null then
    return new;
  end if;

  v_guard := public.consume_api_rate_limit(v_endpoint, v_limit, v_window);
  if coalesce((v_guard->>'allowed')::boolean, false) is not true then
    raise exception 'Muitas solicitações. Aguarde antes de tentar novamente.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_user_insert_rate_limit() from public, anon, authenticated;

drop trigger if exists direct_messages_rate_limit on public.direct_messages;
create trigger direct_messages_rate_limit before insert on public.direct_messages
for each row execute function public.enforce_user_insert_rate_limit('direct-messages', 30, 60);

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
for each row execute function public.enforce_user_insert_rate_limit('community-posts', 10, 300);

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments
for each row execute function public.enforce_user_insert_rate_limit('community-comments', 30, 300);

drop trigger if exists follows_rate_limit on public.user_follows;
create trigger follows_rate_limit before insert on public.user_follows
for each row execute function public.enforce_user_insert_rate_limit('community-follows', 60, 60);

drop trigger if exists community_reports_rate_limit on public.community_reports;
create trigger community_reports_rate_limit before insert on public.community_reports
for each row execute function public.enforce_user_insert_rate_limit('community-reports', 10, 3600);
