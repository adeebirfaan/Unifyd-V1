-- Add profile preferences without replacing existing data.
-- Existing profiles receive these defaults when this migration is applied.
alter table public.profiles
  add column default_reminder_timing text not null default '1_day'
    constraint profiles_default_reminder_timing_check
    check (default_reminder_timing in ('1_day', '3_days', '1_week')),
  add column theme_preference text not null default 'dark'
    constraint profiles_theme_preference_check
    check (theme_preference in ('system', 'light', 'dark')),
  add column language_preference text not null default 'en'
    constraint profiles_language_preference_check
    check (language_preference in ('en', 'ms'));

-- The existing owner-only UPDATE policy still controls which row can change.
-- The original migration uses column-level grants, so grant these columns alone.
grant update (default_reminder_timing, theme_preference, language_preference)
  on table public.profiles to authenticated;
