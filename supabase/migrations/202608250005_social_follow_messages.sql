-- Social layer: follows + direct messages between authenticated Hydra Agro users.

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_pair_idx on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient_id, read_at, created_at desc);
create index if not exists user_follows_following_idx on public.user_follows (following_id, created_at desc);

alter table public.user_follows enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists follows_read_authenticated on public.user_follows;
create policy follows_read_authenticated on public.user_follows
for select to authenticated using (true);

drop policy if exists follows_insert_self on public.user_follows;
create policy follows_insert_self on public.user_follows
for insert to authenticated with check (follower_id = auth.uid() and following_id <> auth.uid());

drop policy if exists follows_delete_self on public.user_follows;
create policy follows_delete_self on public.user_follows
for delete to authenticated using (follower_id = auth.uid());

drop policy if exists direct_messages_read_participants on public.direct_messages;
create policy direct_messages_read_participants on public.direct_messages
for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists direct_messages_send_self on public.direct_messages;
create policy direct_messages_send_self on public.direct_messages
for insert to authenticated with check (sender_id = auth.uid() and recipient_id <> auth.uid());

drop policy if exists direct_messages_mark_read on public.direct_messages;
create policy direct_messages_mark_read on public.direct_messages
for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

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
    (select count(*) from public.user_follows f where f.following_id = pr.id),
    (select count(*) from public.user_follows f where f.follower_id = pr.id),
    exists(select 1 from public.user_follows f where f.follower_id = auth.uid() and f.following_id = pr.id)
  from public.profiles pr
  left join public.properties p on p.owner_user_id = pr.id
  where pr.id = p_user_id and pr.banned_at is null and auth.uid() is not null;
$$;

grant execute on function public.social_profile(uuid) to authenticated;

create or replace function public.toggle_follow(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_target is null or uid = p_target then return false; end if;
  if exists(select 1 from public.user_follows where follower_id = uid and following_id = p_target) then
    delete from public.user_follows where follower_id = uid and following_id = p_target;
    return false;
  end if;
  insert into public.user_follows(follower_id, following_id) values(uid, p_target)
  on conflict do nothing;
  return true;
end;
$$;

grant execute on function public.toggle_follow(uuid) to authenticated;

create or replace function public.social_conversations()
returns table (
  peer_id uuid,
  peer_name text,
  peer_avatar_path text,
  property_name text,
  municipality text,
  last_message text,
  last_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with mine as (
    select *, case when sender_id = auth.uid() then recipient_id else sender_id end as peer
    from public.direct_messages
    where sender_id = auth.uid() or recipient_id = auth.uid()
  ), latest as (
    select distinct on (peer) peer, body, created_at
    from mine
    order by peer, created_at desc
  )
  select
    l.peer,
    coalesce(nullif(trim(pr.full_name), ''), 'Produtor'),
    pr.avatar_path,
    coalesce(p.name, ''),
    coalesce(p.municipality, ''),
    l.body,
    l.created_at,
    (select count(*) from mine m where m.peer = l.peer and m.recipient_id = auth.uid() and m.read_at is null)
  from latest l
  join public.profiles pr on pr.id = l.peer
  left join public.properties p on p.owner_user_id = l.peer
  order by l.created_at desc;
$$;

grant execute on function public.social_conversations() to authenticated;

create or replace function public.social_suggestions(p_limit integer default 20)
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  property_name text,
  municipality text,
  followers bigint,
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
    (select count(*) from public.user_follows f where f.following_id = pr.id),
    exists(select 1 from public.user_follows f where f.follower_id = auth.uid() and f.following_id = pr.id)
  from public.profiles pr
  left join public.properties p on p.owner_user_id = pr.id
  where pr.id <> auth.uid() and pr.banned_at is null
  order by (p.municipality = (select municipality from public.properties where owner_user_id = auth.uid() limit 1)) desc,
           followers desc,
           pr.full_name asc
  limit greatest(1, least(coalesce(p_limit,20), 50));
$$;

grant execute on function public.social_suggestions(integer) to authenticated;
