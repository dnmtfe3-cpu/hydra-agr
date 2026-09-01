create or replace function public.consume_service_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 1000));
  v_window integer := greatest(10, least(coalesce(p_window_seconds, 60), 86400));
  v_row public.security_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_retry integer;
begin
  if p_bucket is null or length(p_bucket) < 8 or length(p_bucket) > 256 then
    raise exception 'Bucket inválido' using errcode = '22023';
  end if;
  v_bucket := encode(extensions.digest('service:' || p_bucket, 'sha256'), 'hex');
  insert into public.security_rate_limits(bucket, window_started_at, request_count, updated_at)
  values (v_bucket, v_now, 1, v_now)
  on conflict (bucket) do nothing;
  select * into v_row from public.security_rate_limits where bucket = v_bucket for update;
  if v_now - v_row.window_started_at >= make_interval(secs => v_window) then
    update public.security_rate_limits set window_started_at=v_now, request_count=1, updated_at=v_now where bucket=v_bucket;
    return jsonb_build_object('allowed', true, 'remaining', v_limit - 1, 'retryAfter', 0);
  end if;
  if v_row.request_count >= v_limit then
    v_retry := greatest(1, ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => v_window) - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retryAfter', v_retry);
  end if;
  update public.security_rate_limits set request_count=request_count+1, updated_at=v_now where bucket=v_bucket;
  return jsonb_build_object('allowed', true, 'remaining', greatest(0, v_limit - v_row.request_count - 1), 'retryAfter', 0);
end;
$$;

revoke execute on function public.consume_service_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_service_rate_limit(text, integer, integer) to service_role;
