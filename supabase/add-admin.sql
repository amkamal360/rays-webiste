-- Make an existing Supabase user a website editor. Replace the email, then run in the SQL Editor.
-- (Create the user first in Authentication → Users → Add user, with "Auto Confirm User" ticked.)
insert into public.admins (user_id)
select id from auth.users where email = 'you@raysfinance.com'
on conflict do nothing;
