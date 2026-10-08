-- Module 5, Phase 1: academic tasks owned by individual Auth users.
-- Planner screens, reminders, and notifications belong to later phases.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null
    constraint tasks_title_not_blank_check check (nullif(pg_catalog.btrim(title), '') is not null),
  subject text not null
    constraint tasks_subject_not_blank_check check (nullif(pg_catalog.btrim(subject), '') is not null),
  description text null,
  deadline timestamptz not null,
  priority text not null default 'medium'
    constraint tasks_priority_check check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending'
    constraint tasks_status_check check (status in ('pending', 'ongoing', 'completed')),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A completion timestamp exists exactly when the task is completed.
  constraint tasks_completion_state_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

-- Grants decide which operations are possible; RLS restricts the owned rows.
-- Remove broad Data API access before allowing only signed-in students.
alter table public.tasks enable row level security;
revoke all on table public.tasks from public, anon, authenticated;
grant select on table public.tasks to authenticated;
grant delete on table public.tasks to authenticated;

-- New tasks start as pending. The database creates IDs and timestamps.
grant insert (user_id, title, subject, description, deadline, priority)
  on table public.tasks to authenticated;

-- Students can edit task content and progress, but not ownership or IDs.
-- Status and completed_at must be changed together when completing a task.
grant update (title, subject, description, deadline, priority, status, completed_at)
  on table public.tasks to authenticated;

-- Every operation is limited to the currently authenticated task owner.
create policy "Users can select their own tasks"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own tasks"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Status sections can retrieve one student's tasks in deadline order.
create index tasks_user_status_deadline_idx
  on public.tasks (user_id, status, deadline asc);

-- Reuse the private schema created by the profile foundation migration.
-- The trigger runs with caller privileges and an empty search path.
create function unifyd_private.set_task_updated_at()
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

-- API roles do not need direct access to the trigger function.
revoke all on function unifyd_private.set_task_updated_at()
  from public, anon, authenticated;

create trigger set_task_updated_at
  before update on public.tasks
  for each row execute function unifyd_private.set_task_updated_at();
