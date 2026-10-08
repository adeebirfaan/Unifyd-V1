-- Module 2, Phase 1: store manually recorded expenses for one Auth user.
-- OCR, receipt images, merchants, budgets, and AI data belong to later phases.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null
    constraint expenses_amount_positive_check check (amount > 0),
  category text not null
    constraint expenses_category_check
    check (category in ('food', 'transport', 'academic_materials', 'personal', 'other')),
  expense_date date not null default current_date,
  notes text null,
  entry_source text not null default 'manual'
    constraint expenses_entry_source_check check (entry_source in ('manual', 'ocr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Grants decide which operations are possible; RLS below decides which rows.
-- Remove any broad Data API grants before allowing only signed-in students.
alter table public.expenses enable row level security;
revoke all on table public.expenses from public, anon, authenticated;
grant select on table public.expenses to authenticated;
grant delete on table public.expenses to authenticated;

-- A student supplies ownership and manual expense fields. The database sets
-- id, timestamps, and entry_source = 'manual'. OCR writes need a later review.
grant insert (user_id, title, amount, category, expense_date, notes)
  on table public.expenses to authenticated;

-- Ownership, source, IDs, and timestamps cannot be changed by app users.
grant update (title, amount, category, expense_date, notes)
  on table public.expenses to authenticated;

-- Every operation is restricted to the current Auth user's own rows.
create policy "Users can select their own expenses"
  on public.expenses for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own expenses"
  on public.expenses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own expenses"
  on public.expenses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own expenses"
  on public.expenses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Filter by owner, then read newest expense dates first. The leading user_id
-- also helps when an Auth user is deleted and their expenses cascade away.
create index expenses_user_date_idx
  on public.expenses (user_id, expense_date desc);

-- Reuse the private schema created by the profile foundation migration.
-- SECURITY INVOKER and an empty search_path keep this trigger narrowly scoped.
create function unifyd_private.set_expense_updated_at()
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

-- Trigger functions are internal; client roles do not need EXECUTE rights.
revoke all on function unifyd_private.set_expense_updated_at()
  from public, anon, authenticated;

create trigger set_expense_updated_at
  before update on public.expenses
  for each row execute function unifyd_private.set_expense_updated_at();
