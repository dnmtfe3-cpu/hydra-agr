create table if not exists public.auth_email_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup','password_reset','password_change')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  verification_token_hash text,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_email_challenges_lookup_idx
  on public.auth_email_challenges (email, purpose, created_at desc);
create index if not exists auth_email_challenges_token_idx
  on public.auth_email_challenges (verification_token_hash)
  where verification_token_hash is not null;

alter table public.auth_email_challenges enable row level security;
revoke all on table public.auth_email_challenges from public, anon, authenticated;
grant all on table public.auth_email_challenges to service_role;
