-- Module 6, Phase 1: private, self-reported student wellbeing check-ins.
-- These values are not clinical measurements or diagnoses. Multiple entries
-- on the same day are allowed; charts, insights, and suggestions come later.
create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mood_level smallint not null
    constraint mood_entries_mood_level_range_check check (mood_level between 1 and 5),
  stress_level smallint not null
    constraint mood_entries_stress_level_range_check check (stress_level between 1 and 5),
  note text null
    constraint mood_entries_note_not_blank_check
    check (note is null or nullif(pg_catalog.btrim(note), '') is not null),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mood: 1 very low, 2 low, 3 neutral, 4 good, 5 very good.
-- Stress: 1 very low, 2 low, 3 moderate, 4 high, 5 very high.
-- No per-day unique constraint: a student may check in more than once.

-- Revoke broad Data API access, then grant only the required operations.
-- DELETE is a table-level privilege in PostgreSQL; RLS limits its rows.
alter table public.mood_entries enable row level security;
revoke all on table public.mood_entries from public, anon, authenticated;
grant select (id, user_id, mood_level, stress_level, note, recorded_at, created_at, updated_at)
  on table public.mood_entries to authenticated;
grant insert (user_id, mood_level, stress_level, note)
  on table public.mood_entries to authenticated;
grant update (mood_level, stress_level, note)
  on table public.mood_entries to authenticated;
grant delete on table public.mood_entries to authenticated;

-- Every operation is limited to the signed-in student's own rows.
create policy "Users can select their own mood entries"
  on public.mood_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own mood entries"
  on public.mood_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own mood entries"
  on public.mood_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own mood entries"
  on public.mood_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Support newest-first history for the current student and cascade deletion.
create index mood_entries_user_recorded_at_idx
  on public.mood_entries (user_id, recorded_at desc);

-- Keep modification timestamps server-managed in the existing private schema.
-- SECURITY INVOKER and an empty search path avoid elevated privileges.
create function unifyd_private.set_mood_entry_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- API roles do not need direct EXECUTE permission on this trigger function.
revoke all on function unifyd_private.set_mood_entry_updated_at()
  from public, anon, authenticated;

create trigger set_mood_entry_updated_at
  before update on public.mood_entries
  for each row execute function unifyd_private.set_mood_entry_updated_at();
