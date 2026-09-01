-- Trigger functions are internal only and must never be callable over PostgREST.
revoke execute on function public.dispatch_notification_web_push() from public, anon, authenticated;
revoke execute on function public.enforce_staff_activity_done_only() from public, anon, authenticated;
revoke execute on function public.log_hydra_activity() from public, anon, authenticated;

-- RLS/auth helpers are needed by signed-in requests, never anonymous callers.
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_property_manager(uuid) from public, anon;
revoke execute on function public.is_property_member(uuid) from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_property_manager(uuid) to authenticated;
grant execute on function public.is_property_member(uuid) to authenticated;

-- Push subscription is tied to an authenticated Hydra Agro account.
revoke execute on function public.web_push_public_key() from public, anon;
grant execute on function public.web_push_public_key() to authenticated;

-- Preserve only the public Hydra Tag lookup needed by NFC/QR.
revoke execute on function public.public_animal_by_hydra_code(text) from public;
grant execute on function public.public_animal_by_hydra_code(text) to anon, authenticated;

-- Found-animal reports require a signed-in reporter.
revoke execute on function public.report_found_animal(text, text) from public, anon;
grant execute on function public.report_found_animal(text, text) to authenticated;
revoke execute on function public.found_report_contact(text) from public, anon;
grant execute on function public.found_report_contact(text) to authenticated;
