-- Unifyd profile foundation. Each profile belongs to exactly one Auth user.
-- The profile starts incomplete so onboarding can collect the required fields.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  university text not null default 'Universiti Malaysia Pahang Al-Sultan Abdullah',
  faculty text,
  programme text,
  study_year smallint check (study_year is null or study_year > 0),
  avatar_id text not null default 'avatar-01',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A completed profile must contain the details required by SRS-FR-005.
  constraint profiles_onboarding_fields_check check (
    not onboarding_completed or (
      nullif(btrim(full_name), '') is not null
      and nullif(btrim(university), '') is not null
      and (
        nullif(btrim(faculty), '') is not null
        or nullif(btrim(programme), '') is not null
      )
      and study_year is not null
    )
  )
);

-- Grants and row policies are both required for Data API access.
alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, email, full_name, university, faculty, programme, study_year, avatar_id, onboarding_completed)
  on table public.profiles to authenticated;
grant update (full_name, university, faculty, programme, study_year, avatar_id, onboarding_completed)
  on table public.profiles to authenticated;

create policy "Users can select their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Keep trigger functions outside the exposed public schema.
create schema if not exists unifyd_private;
revoke all on schema unifyd_private from public;

-- Set the modification time server-side on every profile update.
create function unifyd_private.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function unifyd_private.set_profile_updated_at() from public;

create trigger set_profile_updated_at
  before update on public.profiles
  for each row execute function unifyd_private.set_profile_updated_at();

-- Auth runs this trigger with limited privileges. SECURITY DEFINER lets the
-- migration owner insert the new user's row through the table's RLS boundary.
-- It reads only the Auth user's ID and email; no user metadata is trusted.
create function unifyd_private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  return new;
end;
$$;

-- Trigger functions do not need to be callable by API roles.
revoke all on function unifyd_private.create_profile_for_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function unifyd_private.create_profile_for_new_user();
