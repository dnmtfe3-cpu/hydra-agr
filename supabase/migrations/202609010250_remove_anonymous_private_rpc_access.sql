-- App features that require a signed-in user must not be exposed to anon via PostgREST.
revoke execute on function public.farm_xp_for_owner(uuid) from public, anon;
revoke execute on function public.property_ranking() from public, anon;
revoke execute on function public.seed_demo_animal_inspection() from public, anon;
revoke execute on function public.social_connections(uuid, text) from public, anon;
revoke execute on function public.social_conversations() from public, anon;
revoke execute on function public.social_profile(uuid) from public, anon;
revoke execute on function public.social_resolve_profile(text, text) from public, anon;
revoke execute on function public.social_suggestions(integer) from public, anon;
revoke execute on function public.toggle_follow(uuid) from public, anon;

grant execute on function public.farm_xp_for_owner(uuid) to authenticated;
grant execute on function public.property_ranking() to authenticated;
grant execute on function public.seed_demo_animal_inspection() to authenticated;
grant execute on function public.social_connections(uuid, text) to authenticated;
grant execute on function public.social_conversations() to authenticated;
grant execute on function public.social_profile(uuid) to authenticated;
grant execute on function public.social_resolve_profile(text, text) to authenticated;
grant execute on function public.social_suggestions(integer) to authenticated;
grant execute on function public.toggle_follow(uuid) to authenticated;

-- Hydra Tag lookup is intentionally public for NFC/QR scans.
revoke execute on function public.public_animal_by_hydra_code(text) from public;
grant execute on function public.public_animal_by_hydra_code(text) to anon, authenticated;
