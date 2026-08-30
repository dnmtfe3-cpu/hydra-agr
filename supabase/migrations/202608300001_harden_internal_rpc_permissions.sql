-- Keep intentionally public Hydra Tag RPCs unchanged.
-- Internal helpers must not inherit PostgreSQL's default EXECUTE privilege from PUBLIC.

revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;

revoke execute on function public.has_admin_role() from public, anon;
grant execute on function public.has_admin_role() to authenticated, service_role;

revoke execute on function public.record_nfc_read(text) from public, anon;
grant execute on function public.record_nfc_read(text) to authenticated, service_role;
