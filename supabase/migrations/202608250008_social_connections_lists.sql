-- Lista de seguidores e seguindo para os perfis sociais.
create or replace function public.social_connections(p_user_id uuid, p_kind text default 'followers')
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  property_name text,
  municipality text,
  is_following boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with ids as (
    select case
      when lower(coalesce(p_kind, 'followers')) = 'following' then f.following_id
      else f.follower_id
    end as id,
    f.created_at
    from public.user_follows f
    where (
      lower(coalesce(p_kind, 'followers')) = 'following'
      and f.follower_id = p_user_id
    ) or (
      lower(coalesce(p_kind, 'followers')) <> 'following'
      and f.following_id = p_user_id
    )
  )
  select
    pr.id,
    coalesce(nullif(trim(pr.full_name), ''), 'Produtor'),
    pr.avatar_path,
    coalesce(p.name, ''),
    coalesce(p.municipality, ''),
    exists(
      select 1 from public.user_follows mine
      where mine.follower_id = auth.uid() and mine.following_id = pr.id
    )
  from ids i
  join public.profiles pr on pr.id = i.id
  left join public.properties p on p.owner_user_id = pr.id
  where auth.uid() is not null and pr.banned_at is null
  order by i.created_at desc, pr.full_name asc;
$$;

grant execute on function public.social_connections(uuid, text) to authenticated;
