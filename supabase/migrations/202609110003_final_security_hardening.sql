-- Hardening final: remove acesso anônimo a funções internas e impedir
-- consulta direta de métricas privadas por usuário/propriedade arbitrária.
-- As RPCs públicas da Hydra Tag continuam públicas por projeto.

revoke execute on function public.admin_delete_user(uuid) from public, anon;
revoke execute on function public.admin_delete_user_account(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_user_account(uuid) to authenticated, service_role;

revoke execute on function public.farm_mission_metric_value(uuid, text) from public, anon, authenticated;
revoke execute on function public.farm_xp_legacy_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.farm_mission_metric_value(uuid, text) to service_role;
grant execute on function public.farm_xp_legacy_snapshot(uuid) to service_role;

revoke execute on function public.sync_farm_mission_progress() from public, anon;
grant execute on function public.sync_farm_mission_progress() to authenticated, service_role;
