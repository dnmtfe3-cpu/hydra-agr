-- Hydra Comunidade: ocorrências rurais e confirmações comunitárias.
-- Não representa integração com Prefeitura, companhia de água ou qualquer órgão público.

create table if not exists public.rural_occurrences (
  id uuid primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  protocol text not null unique check (protocol ~ '^HYDRA-(OC|AGUA|ANIMAL)-[0-9]{6}$'),
  category text not null check (category in (
    'water','animal_found','animal_missing','road','bridge','culvert','access','animal_road','fence','structure','road_risk','other'
  )),
  subtype text not null check (char_length(subtype) between 1 and 80),
  community text null check (char_length(community) <= 80),
  region text null check (char_length(region) <= 80),
  municipality text null check (char_length(municipality) <= 80),
  state text null check (state is null or char_length(state) <= 2),
  description text null check (char_length(description) <= 600),
  latitude_approx numeric(5,2) null check (latitude_approx between -90 and 90),
  longitude_approx numeric(6,2) null check (longitude_approx between -180 and 180),
  photo_path text null check (char_length(photo_path) <= 240),
  status text not null default 'Aberto' check (status in (
    'Aberto','Em andamento','Sem confirmação recente','Resolvido','Procurando','Possível localização','Encontrado','Recuperado'
  )),
  priority text not null default 'Normal' check (priority in ('Normal','Atenção','Alta atenção')),
  report_count integer not null default 1 check (report_count >= 1),
  affected_count integer not null default 1 check (affected_count >= 1),
  ongoing boolean not null default false,
  started_at timestamptz null,
  public_visible boolean not null default true,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rural_occurrence_confirmations (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.rural_occurrences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  confirmation_type text not null check (confirmation_type in ('affected','still_active')),
  created_at timestamptz not null default now(),
  unique (occurrence_id, user_id, confirmation_type)
);

alter table public.rural_occurrences enable row level security;
alter table public.rural_occurrence_confirmations enable row level security;

drop policy if exists "rural_occurrences_read_authorized" on public.rural_occurrences;
create policy "rural_occurrences_read_authorized"
on public.rural_occurrences for select to authenticated
using (public_visible = true or reporter_id = auth.uid());

drop policy if exists "rural_occurrences_insert_own" on public.rural_occurrences;
create policy "rural_occurrences_insert_own"
on public.rural_occurrences for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "rural_occurrences_update_own" on public.rural_occurrences;
create policy "rural_occurrences_update_own"
on public.rural_occurrences for update to authenticated
using (reporter_id = auth.uid())
with check (reporter_id = auth.uid());

drop policy if exists "rural_confirmations_insert_own" on public.rural_occurrence_confirmations;
create policy "rural_confirmations_insert_own"
on public.rural_occurrence_confirmations for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "rural_confirmations_read_own" on public.rural_occurrence_confirmations;
create policy "rural_confirmations_read_own"
on public.rural_occurrence_confirmations for select to authenticated
using (user_id = auth.uid());

create or replace function public.apply_rural_occurrence_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.rural_occurrences
  set
    report_count = report_count + 1,
    affected_count = affected_count + case when new.confirmation_type = 'affected' then 1 else 0 end,
    status = case when status = 'Sem confirmação recente' then 'Em andamento' else status end,
    updated_at = now()
  where id = new.occurrence_id
    and public_visible = true;
  return new;
end;
$$;

revoke all on function public.apply_rural_occurrence_confirmation() from public;

DROP TRIGGER IF EXISTS rural_occurrence_confirmation_after_insert ON public.rural_occurrence_confirmations;
create trigger rural_occurrence_confirmation_after_insert
after insert on public.rural_occurrence_confirmations
for each row execute function public.apply_rural_occurrence_confirmation();

create index if not exists rural_occurrences_region_idx
  on public.rural_occurrences(state, municipality, community, category, subtype, updated_at desc)
  where public_visible = true;
create index if not exists rural_occurrences_reporter_idx
  on public.rural_occurrences(reporter_id, updated_at desc);
create index if not exists rural_occurrences_status_idx
  on public.rural_occurrences(status, updated_at desc)
  where public_visible = true;
create index if not exists rural_occurrence_confirmations_occurrence_idx
  on public.rural_occurrence_confirmations(occurrence_id, created_at desc);
