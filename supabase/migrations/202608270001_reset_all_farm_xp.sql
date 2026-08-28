-- Reset global de XP solicitado para todas as propriedades.
-- Mantém frontend, ranking regional e RPC alinhados em 0 XP.

create or replace function public.farm_xp_for_owner(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select 0::bigint;
$$;

grant execute on function public.farm_xp_for_owner(uuid) to authenticated;
