create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid null references auth.users(id) on delete set null,
  target_type text not null default 'profile' check (target_type in ('profile','post','message','other')),
  target_id text null,
  reason text not null,
  details text null,
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_reports enable row level security;

drop policy if exists "reports_insert_own" on public.community_reports;
create policy "reports_insert_own" on public.community_reports for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports_select_own" on public.community_reports;
create policy "reports_select_own" on public.community_reports for select to authenticated
using (
  reporter_id = auth.uid()
  or exists(select 1 from public.roles r where r.user_id = auth.uid() and r.role in ('owner','admin','moderator'))
);

drop policy if exists "reports_update_staff" on public.community_reports;
create policy "reports_update_staff" on public.community_reports for update to authenticated
using (exists(select 1 from public.roles r where r.user_id = auth.uid() and r.role in ('owner','admin','moderator')))
with check (exists(select 1 from public.roles r where r.user_id = auth.uid() and r.role in ('owner','admin','moderator')));

create index if not exists community_reports_reporter_idx on public.community_reports(reporter_id, created_at desc);
create index if not exists community_reports_status_idx on public.community_reports(status, created_at desc);
