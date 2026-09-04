create or replace function public.admin_dashboard()
returns jsonb
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare result jsonb;
begin
  if not public.has_admin_role() then
    raise exception 'Acesso administrativo negado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'properties', (select count(*) from public.properties where name <> ''),
      'animals', (select count(*) from public.animals),
      'waterRecords', (select count(*) from public.water_records),
      'posts', (select count(*) from public.posts where moderation_status = 'published'),
      'activeSubscriptions', (
        select count(*) from public.subscriptions
        where plan = 'plus' and status = 'active'
          and (premium_expires_at is null or premium_expires_at > now())
      )
    ),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'name', coalesce(p.full_name, ''),
        'phone', coalesce(p.phone, ''),
        'propertyName', pr.name,
        'municipality', pr.municipality,
        'state', pr.state,
        'propertyType', pr.property_type,
        'mainActivity', pr.main_activity,
        'area', pr.area,
        'areaUnit', pr.area_unit,
        'role', coalesce(r.role, 'user'::public.app_role),
        'accountType', coalesce(u.raw_user_meta_data ->> 'account_type', 'owner'),
        'plan', case
          when s.plan = 'plus' and s.status = 'active'
            and (s.premium_expires_at is null or s.premium_expires_at > now())
          then 'Hydra Agro+' else 'Gratuito' end,
        'subscriptionStatus', coalesce(s.status, 'active'),
        'subscriptionCreatedAt', coalesce(s.created_at, u.created_at),
        'premiumStartedAt', s.premium_started_at,
        'premiumExpiresAt', s.premium_expires_at,
        'premiumDeactivatedAt', s.premium_deactivated_at,
        'createdAt', u.created_at,
        'lastSignInAt', u.last_sign_in_at,
        'emailConfirmedAt', u.email_confirmed_at,
        'profileUpdatedAt', p.updated_at,
        'bannedAt', p.banned_at,
        'banReason', p.ban_reason,
        'animalsCount', (select count(*) from public.animals a where a.owner_user_id = u.id),
        'waterRecordsCount', (select count(*) from public.water_records w where w.owner_user_id = u.id),
        'activitiesCount', (select count(*) from public.activities ac where ac.owner_user_id = u.id),
        'postsCount', (select count(*) from public.posts po where po.author_id = u.id and po.moderation_status <> 'removed')
      ) order by u.created_at desc)
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.properties pr on pr.owner_user_id = u.id
      left join public.roles r on r.user_id = u.id
      left join public.subscriptions s on s.user_id = u.id
    ), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'body', body, 'level', level,
        'active', active, 'startsAt', starts_at, 'endsAt', ends_at,
        'createdAt', created_at
      ) order by created_at desc)
      from public.admin_announcements
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'label', label, 'url', url, 'description', description,
        'active', active, 'position', position
      ) order by position, created_at)
      from public.admin_links
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard() from public;
grant execute on function public.admin_dashboard() to authenticated;
