-- Module 4, Phase 1: one positive weekly or monthly budget per user and period.
-- Spending remains in public.expenses; budget calculations belong to a later phase.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12,2) not null
    constraint budgets_amount_positive_check check (amount > 0),
  period_type text not null
    constraint budgets_period_type_check check (period_type in ('weekly', 'monthly')),
  period_start date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ISO day 1 is Monday. A monthly period always starts on day 1.
  constraint budgets_weekly_starts_monday_check
    check (period_type <> 'weekly' or extract(isodow from period_start) = 1),
  constraint budgets_monthly_starts_first_day_check
    check (period_type <> 'monthly' or extract(day from period_start) = 1),
  constraint budgets_user_period_unique unique (user_id, period_type, period_start)
);

-- Grants determine allowed operations; RLS below restricts the owned rows.
-- Remove broad Data API privileges before granting only what students need.
alter table public.budgets enable row level security;
revoke all on table public.budgets from public, anon, authenticated;
grant select on table public.budgets to authenticated;
grant delete on table public.budgets to authenticated;

-- The client supplies ownership and budget fields. The database sets the ID
-- and timestamps. Client UPDATE cannot change ownership or server fields.
grant insert (user_id, amount, period_type, period_start)
  on table public.budgets to authenticated;
grant update (amount, period_type, period_start)
  on table public.budgets to authenticated;

-- A signed-in student can access only budgets owned by their Auth user ID.
create policy "Users can select their own budgets"
  on public.budgets for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own budgets"
  on public.budgets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own budgets"
  on public.budgets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own budgets"
  on public.budgets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Support each student's budget list ordered by the latest period start.
create index budgets_user_period_start_idx
  on public.budgets (user_id, period_start desc);

-- Reuse the private schema created by the profile foundation migration.
-- The trigger runs with the caller's privileges and an empty search path.
create function unifyd_private.set_budget_updated_at()
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

-- Trigger functions are internal and need no direct client EXECUTE rights.
revoke all on function unifyd_private.set_budget_updated_at()
  from public, anon, authenticated;

create trigger set_budget_updated_at
  before update on public.budgets
  for each row execute function unifyd_private.set_budget_updated_at();
