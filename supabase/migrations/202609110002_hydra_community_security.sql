-- Hydra Comunidade: o trigger de confirmação é interno ao banco.
-- Usuários não devem chamar a função diretamente via RPC.
revoke execute on function public.apply_rural_occurrence_confirmation() from public;
revoke execute on function public.apply_rural_occurrence_confirmation() from anon;
revoke execute on function public.apply_rural_occurrence_confirmation() from authenticated;
