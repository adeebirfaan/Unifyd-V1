-- Module 7, Phase 1: curated UMPSA course reference and private semester choices.
-- This migration creates structure only; approved source data is curated later.
create table public.catalog_courses (
  id uuid primary key default gen_random_uuid(),
  academic_session text not null
    constraint catalog_courses_academic_session_not_blank_check
    check (nullif(pg_catalog.btrim(academic_session), '') is not null),
  semester smallint not null
    constraint catalog_courses_semester_check check (semester in (1, 2)),
  faculty_code text not null
    constraint catalog_courses_faculty_code_not_blank_check
    check (nullif(pg_catalog.btrim(faculty_code), '') is not null),
  campus text null,
  course_code text not null
    constraint catalog_courses_course_code_not_blank_check
    check (nullif(pg_catalog.btrim(course_code), '') is not null),
  course_name text not null
    constraint catalog_courses_course_name_not_blank_check
    check (nullif(pg_catalog.btrim(course_name), '') is not null),
  credit_hours smallint null
    constraint catalog_courses_credit_hours_positive_check
    check (credit_hours is null or credit_hours > 0),
  source_label text not null
    constraint catalog_courses_source_label_not_blank_check
    check (nullif(pg_catalog.btrim(source_label), '') is not null),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- NULLS NOT DISTINCT also blocks duplicates when campus is unknown.
  constraint catalog_courses_session_semester_campus_code_key
    unique nulls not distinct (academic_session, semester, campus, course_code)
);

-- Students retain a subject name/code snapshot even if its reference is removed.
-- A custom subject has no catalogue link; credit hours have no artificial cap.
create table public.student_semester_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  academic_session text not null
    constraint student_semester_courses_academic_session_not_blank_check
    check (nullif(pg_catalog.btrim(academic_session), '') is not null),
  semester smallint not null
    constraint student_semester_courses_semester_check check (semester in (1, 2)),
  catalog_course_id uuid null references public.catalog_courses (id) on delete set null,
  course_code text null,
  course_name text not null
    constraint student_semester_courses_course_name_not_blank_check
    check (nullif(pg_catalog.btrim(course_name), '') is not null),
  credit_hours smallint null
    constraint student_semester_courses_credit_hours_positive_check
    check (credit_hours is null or credit_hours > 0),
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint student_semester_courses_source_check check (
    (is_custom and catalog_course_id is null)
    or (not is_custom and catalog_course_id is not null)
  )
);

-- A removed catalogue row turns its selected subjects into custom snapshots.
-- This BEFORE UPDATE trigger lets the foreign key's ON DELETE SET NULL action
-- satisfy the source check without deleting a student's subject selection.
create function unifyd_private.detach_student_semester_course()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.catalog_course_id is not null and new.catalog_course_id is null then
    new.is_custom := true;
  end if;
  return new;
end;
$$;

revoke all on function unifyd_private.detach_student_semester_course()
  from public, anon, authenticated;

create trigger detach_student_semester_course
  before update of catalog_course_id on public.student_semester_courses
  for each row execute function unifyd_private.detach_student_semester_course();

-- The catalogue is active-only reference data for signed-in students.
-- Import and curation are reserved for a later trusted workflow.
alter table public.catalog_courses enable row level security;
revoke all on table public.catalog_courses from public, anon, authenticated;
grant select on table public.catalog_courses to authenticated;

create policy "Authenticated users can select active catalog courses"
  on public.catalog_courses for select
  to authenticated
  using (is_active);

-- Students may write only their own subject choices and editable content.
-- IDs and timestamps are database managed; DELETE is table-level in PostgreSQL.
alter table public.student_semester_courses enable row level security;
revoke all on table public.student_semester_courses from public, anon, authenticated;
grant select (id, user_id, academic_session, semester, catalog_course_id,
  course_code, course_name, credit_hours, is_custom, created_at, updated_at)
  on table public.student_semester_courses to authenticated;
grant insert (user_id, academic_session, semester, catalog_course_id,
  course_code, course_name, credit_hours, is_custom)
  on table public.student_semester_courses to authenticated;
grant update (academic_session, semester, catalog_course_id,
  course_code, course_name, credit_hours, is_custom)
  on table public.student_semester_courses to authenticated;
grant delete on table public.student_semester_courses to authenticated;

create policy "Users can select their own semester courses"
  on public.student_semester_courses for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own semester courses"
  on public.student_semester_courses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own semester courses"
  on public.student_semester_courses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own semester courses"
  on public.student_semester_courses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Support the student's subject list for one academic session and semester.
create index student_semester_courses_user_session_semester_created_idx
  on public.student_semester_courses
  (user_id, academic_session, semester, created_at asc);

-- Keep modification timestamps server-managed in the existing private schema.
create function unifyd_private.set_catalog_course_updated_at()
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

revoke all on function unifyd_private.set_catalog_course_updated_at()
  from public, anon, authenticated;

create trigger set_catalog_course_updated_at
  before update on public.catalog_courses
  for each row execute function unifyd_private.set_catalog_course_updated_at();

create function unifyd_private.set_student_semester_course_updated_at()
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

revoke all on function unifyd_private.set_student_semester_course_updated_at()
  from public, anon, authenticated;

create trigger set_student_semester_course_updated_at
  before update on public.student_semester_courses
  for each row execute function unifyd_private.set_student_semester_course_updated_at();
