-- Module 7, Phase 3: each student's private recurring weekly class sessions.
-- A personal planning timetable only; not official UMPSA registration.
-- Course code/name are snapshots, so removing a My Semester subject never removes
-- a timetable entry (the optional link is simply cleared).
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  academic_session text not null
    constraint timetable_entries_academic_session_not_blank_check
    check (nullif(pg_catalog.btrim(academic_session), '') is not null),
  semester smallint not null
    constraint timetable_entries_semester_check check (semester in (1, 2)),
  student_semester_course_id uuid null
    references public.student_semester_courses (id) on delete set null,
  course_code text null
    constraint timetable_entries_course_code_not_blank_check
    check (course_code is null or nullif(pg_catalog.btrim(course_code), '') is not null),
  course_name text not null
    constraint timetable_entries_course_name_not_blank_check
    check (nullif(pg_catalog.btrim(course_name), '') is not null),
  -- 1 = Monday ... 7 = Sunday.
  day_of_week smallint not null
    constraint timetable_entries_day_of_week_check check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  location text null
    constraint timetable_entries_location_not_blank_check
    check (location is null or nullif(pg_catalog.btrim(location), '') is not null),
  section_label text null
    constraint timetable_entries_section_label_not_blank_check
    check (section_label is null or nullif(pg_catalog.btrim(section_label), '') is not null),
  entry_source text not null default 'manual'
    constraint timetable_entries_entry_source_check check (entry_source in ('manual', 'timetable_import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint timetable_entries_time_order_check check (end_time > start_time)
  -- Overlapping sessions are deliberately allowed: the app warns and the student decides.
);

-- Grants decide which operations are possible; RLS restricts the owned rows.
alter table public.timetable_entries enable row level security;
revoke all on table public.timetable_entries from public, anon, authenticated;
grant select (id, user_id, academic_session, semester, student_semester_course_id, course_code,
  course_name, day_of_week, start_time, end_time, location, section_label, entry_source, created_at, updated_at)
  on table public.timetable_entries to authenticated;
-- The database creates IDs and timestamps.
grant insert (user_id, academic_session, semester, student_semester_course_id, course_code,
  course_name, day_of_week, start_time, end_time, location, section_label, entry_source)
  on table public.timetable_entries to authenticated;
-- Students can edit class details, but not ownership, source, IDs, or timestamps.
grant update (academic_session, semester, student_semester_course_id, course_code,
  course_name, day_of_week, start_time, end_time, location, section_label)
  on table public.timetable_entries to authenticated;
grant delete on table public.timetable_entries to authenticated;

-- Every operation is limited to the currently authenticated owner.
create policy "Users can select their own timetable entries"
  on public.timetable_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own timetable entries"
  on public.timetable_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own timetable entries"
  on public.timetable_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own timetable entries"
  on public.timetable_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- One student's week for a session and semester, in day and time order.
create index timetable_entries_user_semester_day_time_idx
  on public.timetable_entries (user_id, academic_session, semester, day_of_week, start_time);

-- Keep modification timestamps server-managed in the existing private schema.
create function unifyd_private.set_timetable_entry_updated_at()
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

revoke all on function unifyd_private.set_timetable_entry_updated_at()
  from public, anon, authenticated;

create trigger set_timetable_entry_updated_at
  before update on public.timetable_entries
  for each row execute function unifyd_private.set_timetable_entry_updated_at();
