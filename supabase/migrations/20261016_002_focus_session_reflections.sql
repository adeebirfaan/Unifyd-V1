-- Unifyd Focus, Phase 5: an optional, private post-round reflection.
-- After a completed round the student may answer "How was your study session?"
-- with one of four words, or skip. It is a personal note only: it is never
-- interpreted, scored, or shared, and it never affects focus time.
-- The smallest change: one nullable column, an update grant on that column only,
-- and an update policy that allows setting it once on the student's own
-- completed round. Existing select, insert, and delete rules are unchanged.
alter table public.focus_sessions
  add column reflection text null
    constraint focus_sessions_reflection_check
    check (reflection is null or reflection in ('great', 'okay', 'struggled', 'tired'));

-- Only completed rounds carry a reflection (the app asks only after one).
alter table public.focus_sessions
  add constraint focus_sessions_reflection_completed_check
  check (reflection is null or status = 'completed');

-- The reflection is the only column a student can ever change, and only once:
-- the row must be theirs and still have no reflection (USING sees the old row),
-- and the new value must be a reflection (WITH CHECK sees the new row).
grant update (reflection) on table public.focus_sessions to authenticated;

create policy "Users can add one reflection to their own completed focus sessions"
  on public.focus_sessions for update
  to authenticated
  using ((select auth.uid()) = user_id and reflection is null and status = 'completed')
  with check ((select auth.uid()) = user_id and reflection is not null);
