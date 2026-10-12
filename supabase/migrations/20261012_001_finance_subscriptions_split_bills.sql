-- Finance module: private subscription reminders (Part A) and a personal
-- split-bill tracker (Part B), both owned and managed by one Auth user.
-- Planning and tracking only: nothing here charges or transfers money, verifies
-- a subscription, contacts participants, or creates an expense.

-- ---------------------------------------------------------------------------
-- Part A: subscriptions. Renewal is a manual, confirmed student action.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null
    constraint subscriptions_name_not_blank_check check (nullif(pg_catalog.btrim(name), '') is not null),
  amount numeric(12,2) not null
    constraint subscriptions_amount_positive_check check (amount > 0),
  -- Optional, but only the existing Wallet expense categories.
  category text null
    constraint subscriptions_category_check
    check (category is null or category in ('food', 'transport', 'academic_materials', 'personal', 'other')),
  billing_frequency text not null
    constraint subscriptions_billing_frequency_check
    check (billing_frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_billing_date date not null,
  reminder_days_before smallint not null default 3
    constraint subscriptions_reminder_days_before_check check (reminder_days_before between 0 and 30),
  notifications_enabled boolean not null default true,
  is_active boolean not null default true,
  notes text null
    constraint subscriptions_notes_not_blank_check check (notes is null or nullif(pg_catalog.btrim(notes), '') is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Grants decide which operations are possible; RLS below decides which rows.
-- Remove broad Data API access before allowing only signed-in students.
alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from public, anon, authenticated;
grant select on table public.subscriptions to authenticated;
grant delete on table public.subscriptions to authenticated;

-- The database creates IDs and timestamps.
grant insert (user_id, name, amount, category, billing_frequency, next_billing_date,
  reminder_days_before, notifications_enabled, is_active, notes)
  on table public.subscriptions to authenticated;

-- Students can edit, pause/resume, and renew, but not ownership, IDs, or timestamps.
grant update (name, amount, category, billing_frequency, next_billing_date,
  reminder_days_before, notifications_enabled, is_active, notes)
  on table public.subscriptions to authenticated;

-- Every operation is restricted to the current Auth user's own rows.
create policy "Users can select their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own subscriptions"
  on public.subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own subscriptions"
  on public.subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own subscriptions"
  on public.subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Upcoming renewals: one student's active subscriptions by nearest billing date.
create index subscriptions_user_active_next_billing_idx
  on public.subscriptions (user_id, is_active, next_billing_date asc);

-- Reuse the private schema created by the profile foundation migration.
-- SECURITY INVOKER and an empty search_path keep this trigger narrowly scoped.
create function unifyd_private.set_subscription_updated_at()
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
revoke all on function unifyd_private.set_subscription_updated_at()
  from public, anon, authenticated;

create trigger set_subscription_updated_at
  before update on public.subscriptions
  for each row execute function unifyd_private.set_subscription_updated_at();

-- ---------------------------------------------------------------------------
-- Part B: split bills. The student paid the bill and records who owes them.
-- Participants are plain names, never Unifyd accounts, and get no access.
-- ---------------------------------------------------------------------------
create table public.split_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null
    constraint split_bills_title_not_blank_check check (nullif(pg_catalog.btrim(title), '') is not null),
  total_amount numeric(12,2) not null
    constraint split_bills_total_amount_positive_check check (total_amount > 0),
  bill_date date not null default current_date,
  category text null
    constraint split_bills_category_check
    check (category is null or category in ('food', 'transport', 'academic_materials', 'personal', 'other')),
  notes text null
    constraint split_bills_notes_not_blank_check check (notes is null or nullif(pg_catalog.btrim(notes), '') is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.split_bills enable row level security;
revoke all on table public.split_bills from public, anon, authenticated;
grant select on table public.split_bills to authenticated;
grant delete on table public.split_bills to authenticated;

-- The database creates IDs and timestamps.
grant insert (user_id, title, total_amount, bill_date, category, notes)
  on table public.split_bills to authenticated;

-- Ownership, IDs, and timestamps cannot be changed by app users.
grant update (title, total_amount, bill_date, category, notes)
  on table public.split_bills to authenticated;

create policy "Users can select their own split bills"
  on public.split_bills for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own split bills"
  on public.split_bills for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own split bills"
  on public.split_bills for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own split bills"
  on public.split_bills for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- One student's bills, newest bill date first.
create index split_bills_user_date_idx
  on public.split_bills (user_id, bill_date desc);

create table public.split_bill_participants (
  id uuid primary key default gen_random_uuid(),
  split_bill_id uuid not null references public.split_bills (id) on delete cascade,
  participant_name text not null
    constraint split_bill_participants_name_not_blank_check check (nullif(pg_catalog.btrim(participant_name), '') is not null),
  share_amount numeric(12,2) not null
    constraint split_bill_participants_share_positive_check check (share_amount > 0),
  is_self boolean not null default false,
  is_settled boolean not null default false,
  settled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The student paid the bill, so their own share is always settled.
  constraint split_bill_participants_self_settled_check check (not is_self or is_settled),
  -- A settlement timestamp exists exactly when the share is settled (no partial payments).
  constraint split_bill_participants_settlement_state_check check (
    (is_settled and settled_at is not null) or (not is_settled and settled_at is null)
  )
);

-- At most one "You" participant per bill.
create unique index split_bill_participants_one_self_idx
  on public.split_bill_participants (split_bill_id) where is_self;

-- Participants of one bill; also serves the parent-bill policy lookups and cascades.
create index split_bill_participants_bill_idx
  on public.split_bill_participants (split_bill_id);

alter table public.split_bill_participants enable row level security;
revoke all on table public.split_bill_participants from public, anon, authenticated;
grant select on table public.split_bill_participants to authenticated;
grant delete on table public.split_bill_participants to authenticated;

-- The database creates IDs and timestamps.
grant insert (split_bill_id, participant_name, share_amount, is_self, is_settled, settled_at)
  on table public.split_bill_participants to authenticated;

-- A participant cannot be moved to another bill or turned into, or out of, "You".
grant update (participant_name, share_amount, is_settled, settled_at)
  on table public.split_bill_participants to authenticated;

-- Access is only through a parent bill the signed-in student owns.
-- No policy is based on participant names; participants have no account access.
create policy "Users can select participants of their own split bills"
  on public.split_bill_participants for select
  to authenticated
  using (exists (
    select 1 from public.split_bills
    where split_bills.id = split_bill_participants.split_bill_id
      and split_bills.user_id = (select auth.uid())
  ));

create policy "Users can insert participants into their own split bills"
  on public.split_bill_participants for insert
  to authenticated
  with check (exists (
    select 1 from public.split_bills
    where split_bills.id = split_bill_participants.split_bill_id
      and split_bills.user_id = (select auth.uid())
  ));

create policy "Users can update participants of their own split bills"
  on public.split_bill_participants for update
  to authenticated
  using (exists (
    select 1 from public.split_bills
    where split_bills.id = split_bill_participants.split_bill_id
      and split_bills.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.split_bills
    where split_bills.id = split_bill_participants.split_bill_id
      and split_bills.user_id = (select auth.uid())
  ));

-- The "You" row is removed only with its bill (the FK cascade is not subject to RLS).
create policy "Users can delete other participants of their own split bills"
  on public.split_bill_participants for delete
  to authenticated
  using (not is_self and exists (
    select 1 from public.split_bills
    where split_bills.id = split_bill_participants.split_bill_id
      and split_bills.user_id = (select auth.uid())
  ));

-- Each new table gets its own private trigger function, as above.
create function unifyd_private.set_split_bill_updated_at()
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

revoke all on function unifyd_private.set_split_bill_updated_at()
  from public, anon, authenticated;

create trigger set_split_bill_updated_at
  before update on public.split_bills
  for each row execute function unifyd_private.set_split_bill_updated_at();

create function unifyd_private.set_split_bill_participant_updated_at()
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

revoke all on function unifyd_private.set_split_bill_participant_updated_at()
  from public, anon, authenticated;

create trigger set_split_bill_participant_updated_at
  before update on public.split_bill_participants
  for each row execute function unifyd_private.set_split_bill_participant_updated_at();
