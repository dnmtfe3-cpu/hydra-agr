revoke execute on function public.farm_xp_for_owner(uuid) from anon;
revoke execute on function public.hydra_impact_metrics() from anon;
revoke execute on function public.property_ranking() from anon;
revoke execute on function public.seed_demo_animal_inspection() from anon;
revoke execute on function public.social_connections(uuid,text) from anon;
revoke execute on function public.social_conversations() from anon;
revoke execute on function public.social_profile(uuid) from anon;
revoke execute on function public.social_resolve_profile(text,text) from anon;
revoke execute on function public.social_suggestions(integer) from anon;
revoke execute on function public.sync_level10_vip() from anon;
revoke execute on function public.toggle_follow(uuid) from anon;

grant execute on function public.public_animal_by_hydra_code(text) to anon, authenticated;

revoke execute on function public.dispatch_notification_web_push() from anon, authenticated;
revoke execute on function public.enforce_staff_activity_done_only() from anon, authenticated;
revoke execute on function public.log_hydra_activity() from anon, authenticated;
revoke execute on function public.seed_demo_animal_inspection() from authenticated;

revoke execute on function public.web_push_public_key() from anon;
grant execute on function public.web_push_public_key() to authenticated;
