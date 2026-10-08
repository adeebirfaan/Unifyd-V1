-- Module 5, Phase 3: optional on-device reminder timing for each academic task.
-- Null means no reminder. Values are minutes before the task deadline.
alter table public.tasks
  add column reminder_offset_minutes integer null
    constraint tasks_reminder_offset_minutes_check
    check (reminder_offset_minutes in (0, 60, 1440));

-- Existing owner-only RLS policies still limit inserts and updates to auth.uid().
-- Grant only the new task-configuration column; ownership and timestamps stay protected.
grant insert (reminder_offset_minutes) on table public.tasks to authenticated;
grant update (reminder_offset_minutes) on table public.tasks to authenticated;
