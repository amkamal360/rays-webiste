-- Public forms go only through the "submit" Edge Function (bot check + rate limits).
-- Direct public writes to the database and CV storage are removed.
drop policy if exists "inquiries public insert" on public.inquiries;
drop policy if exists "applications public insert" on public.applications;
drop policy if exists "cvs public upload" on storage.objects;
