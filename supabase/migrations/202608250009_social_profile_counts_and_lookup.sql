-- Perfil social: contagem especial do dono e resolução segura do perfil exibido.
create or replace function public.social_profile(p_user_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  property_name text,
  municipality text,
  followers bigint,
  following bigint,
  is_following boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    pr.id,
    coalesce(nullif(trim(pr.full_name), ''), 'Produtor'),
    pr.avatar_path,
    coalesce(p.name, ''),
    coalesce(p.municipality, ''),
    case
      when exists(select 1 from public.roles r where r.user_id = pr.id and r.role = 'owner')
        then greatest(136::bigint, (select count(*) from public.user_follows f where f.following_id = pr.id))
      else (select count(*) from public.user_follows f where f.following_id = pr.id)
    end,
    (select count(*) from public.user_follows f where f.follower_id = pr.id),
    exists(select 1 from public.user_follows f where f.follower_id = auth.uid() and f.following_id = pr.id)
  from public.profiles pr
  left join public.properties p on p.owner_user_id = pr.id
  where pr.id = p_user_id and pr.banned_at is null and auth.uid() is not null;
$$;

grant execute on function public.social_profile(uuid) to authenticated;

create or replace function public.social_resolve_profile(p_name text, p_property text default null)
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select pr.id
  from public.profiles pr
  left join public.properties p on p.owner_user_id = pr.id
  where auth.uid() is not null
    and pr.banned_at is null
    and lower(trim(coalesce(nullif(pr.full_name,''),'Produtor'))) = lower(trim(coalesce(p_name,'')))
    and (nullif(trim(coalesce(p_property,'')),'') is null or lower(trim(coalesce(p.name,''))) = lower(trim(p_property)))
  order by case when pr.id = auth.uid() then 0 else 1 end, pr.created_at asc
  limit 1;
$$;

grant execute on function public.social_resolve_profile(text, text) to authenticated;
