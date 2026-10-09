-- Curated avatar library: new profiles start with a curated avatar ID instead of
-- the legacy generated-avatar value 'avatar-01'. Only the column default changes;
-- existing rows, constraints, grants, and RLS policies are untouched. The app
-- already shows the default avatar for any legacy or unknown stored value.
alter table public.profiles
  alter column avatar_id set default 'women_turban';
