revoke all on function public.report_found_animal(text, text) from public;
revoke all on function public.report_found_animal(text, text) from anon;
grant execute on function public.report_found_animal(text, text) to authenticated;
grant execute on function public.report_found_animal(text, text) to service_role;
