-- Allow authenticated students to label an expense created from OCR.
-- Existing RLS policies still restrict every inserted row to auth.uid().
grant insert (entry_source) on table public.expenses to authenticated;
