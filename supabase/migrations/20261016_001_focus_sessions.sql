-- Unifyd Focus (owner-approved Planner addition, 2026-10-16), Phase 3.
-- One row per kept focus round (completed, or partial with at least one minute
-- of focus), saved from the student's on-device outbox. Breaks and paused time
-- are never focus time: focus_seconds is real focus only, and it can never be
-- longer than the round's wall-clock span. Discarded rounds are never stored.
-- Rows are written once and never edited; the student can only delete them.
create table public.focus_sessions (
  -- The app's own round ID, so a retried save can never create a second row.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optional links. General study has neither. Removing the subject or task
  -- keeps the round: the link becomes null and the copied label stays.
  semester_course_id uuid null references public.student_semester_courses (id) on delete set null,
  subject_label text null
    constraint focus_sessions_subject_label_check
    check (subject_label is null or (nullif(pg_catalog.btrim(subject_label), '') is not null and pg_catalog.char_length(subject_label) <= 300)),
  task_id uuid null references public.tasks (id) on delete set null,
  task_title text null
    constraint focus_sessions_task_title_check
    check (task_title is null or (nullif(pg_catalog.btrim(task_title), '') is not null and pg_catalog.char_length(task_title) <= 500)),
  preset text not null
    constraint focus_sessions_preset_check check (preset in ('classic', 'deep', 'quick', 'custom')),
  -- The planned focus length: 5 to 120 minutes, as the app allows.
  planned_focus_seconds integer not null
    constraint focus_sessions_planned_focus_seconds_check check (planned_focus_seconds between 300 and 7200),
  focus_seconds integer not null
    constraint focus_sessions_focus_seconds_check check (focus_seconds >= 0 and focus_seconds <= planned_focus_seconds),
  round_number smallint not null
    constraint focus_sessions_round_number_check check (round_number >= 1),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  status text not null
    constraint focus_sessions_status_check check (status in ('completed', 'partial')),
  created_at timestamptz not null default now(),

  constraint focus_sessions_time_order_check check (ended_at >= started_at),
  -- Focus time never exceeds the time between start and end (pauses only add to that span).
  constraint focus_sessions_focus_within_span_check
    check (focus_seconds <= pg_catalog.ceil(extract(epoch from (ended_at - started_at)))),
  -- Completed rounds reached their planned length; partial rounds kept at least one minute.
  constraint focus_sessions_status_seconds_check check (
    (status = 'completed' and focus_seconds = planned_focus_seconds)
    or (status = 'partial' and focus_seconds >= 60 and focus_seconds < planned_focus_seconds)
  ),
  -- A link is always saved with its readable copy.
  constraint focus_sessions_subject_link_check check (semester_course_id is null or subject_label is not null),
  constraint focus_sessions_task_link_check check (task_id is null or task_title is not null)
);

-- Grants decide which operations are possible; RLS below decides which rows.
-- Remove broad Data API access before allowing only signed-in students.
alter table public.focus_sessions enable row level security;
revoke all on table public.focus_sessions from public, anon, authenticated;
grant select on table public.focus_sessions to authenticated;
grant delete on table public.focus_sessions to authenticated;

-- The app supplies the round's own ID. created_at is set by the database.
-- There is no UPDATE grant: a saved round is never edited.
grant insert (id, user_id, semester_course_id, subject_label, task_id, task_title, preset,
  planned_focus_seconds, focus_seconds, round_number, started_at, ended_at, status)
  on table public.focus_sessions to authenticated;

create policy "Users can select their own focus sessions"
  on public.focus_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- A round may link only the student's own task and own semester subject.
-- (Foreign keys alone would accept another student's IDs, because they ignore RLS.)
create policy "Users can insert their own focus sessions"
  on public.focus_sessions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (task_id is null or exists (
      select 1 from public.tasks
      where tasks.id = focus_sessions.task_id
        and tasks.user_id = (select auth.uid())
    ))
    and (semester_course_id is null or exists (
      select 1 from public.student_semester_courses
      where student_semester_courses.id = focus_sessions.semester_course_id
        and student_semester_courses.user_id = (select auth.uid())
    ))
  );

create policy "Users can delete their own focus sessions"
  on public.focus_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- History and totals: one student's rounds, newest first.
create index focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);

-- Keep the "set null" actions fast when a task or semester subject is deleted.
create index focus_sessions_task_idx
  on public.focus_sessions (task_id) where task_id is not null;
create index focus_sessions_semester_course_idx
  on public.focus_sessions (semester_course_id) where semester_course_id is not null;
