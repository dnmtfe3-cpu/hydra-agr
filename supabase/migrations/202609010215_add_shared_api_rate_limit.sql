create table if not exists public.security_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.security_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_endpoint text,
  p_limit integer default 30,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_endpoint text := left(regexp_replace(coalesce(p_endpoint, ''), '[^a-zA-Z0-9_./:-]', '', 'g'), 100);
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 300));
  v_window integer := greatest(10, least(coalesce(p_window_seconds, 60), 86400));
  v_bucket text;
  v_row public.security_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_retry integer;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;
  if v_endpoint = '' then
    raise exception 'Endpoint inválido' using errcode = '22023';
  end if;

  v_bucket := encode(extensions.digest(v_uid::text || ':' || v_endpoint, 'sha256'), 'hex');

  insert into public.security_rate_limits(bucket, window_started_at, request_count, updated_at)
  values (v_bucket, v_now, 1, v_now)
  on conflict (bucket) do nothing;

  select * into v_row from public.security_rate_limits where bucket = v_bucket for update;

  if v_now - v_row.window_started_at >= make_interval(secs => v_window) then
    update public.security_rate_limits set window_started_at = v_now, request_count = 1, updated_at = v_now where bucket = v_bucket;
    return jsonb_build_object('allowed', true, 'remaining', v_limit - 1, 'retryAfter', 0);
  end if;

  if v_row.request_count >= v_limit then
    v_retry := greatest(1, ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => v_window) - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retryAfter', v_retry);
  end if;

  update public.security_rate_limits set request_count = request_count + 1, updated_at = v_now where bucket = v_bucket;
  return jsonb_build_object('allowed', true, 'remaining', greatest(0, v_limit - v_row.request_count - 1), 'retryAfter', 0);
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;
