-- Rays website: core tables, access rules and storage buckets.
-- Public visitors: read site content + published posts + media files, and send contact messages.
-- Admins (listed in public.admins): full read/write through the portal.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  -- editors must be listed AND signed in with two-factor authentication (aal2)
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create table if not exists public.site (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  date text,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id text primary key,               -- object path in the "media" storage bucket
  name text not null,
  content_type text,
  size bigint,
  alt text default '',
  thumb text default '',             -- 640px thumbnail path (generated in the browser on upload)
  width int,
  height int,
  uploaded_at timestamptz not null default now()
);
-- if you ran an earlier version of this file:
alter table public.media add column if not exists thumb text default '';
alter table public.media add column if not exists width int;
alter table public.media add column if not exists height int;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  reach text not null check (char_length(reach) between 1 and 160),
  audience text check (char_length(audience) <= 60),
  message text not null check (char_length(message) between 1 and 4000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.admins    enable row level security;
alter table public.site      enable row level security;
alter table public.posts     enable row level security;
alter table public.media     enable row level security;
alter table public.inquiries enable row level security;

-- admins: each signed-in user may check only their own row
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select using (user_id = auth.uid());

-- site content
drop policy if exists "site public read" on public.site;
create policy "site public read" on public.site for select using (true);
drop policy if exists "site admin write" on public.site;
create policy "site admin write" on public.site for all using (public.is_admin()) with check (public.is_admin());

-- posts: everyone sees published, admins see all
drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts for select using (published or public.is_admin());
drop policy if exists "posts admin write" on public.posts;
create policy "posts admin write" on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- media metadata
drop policy if exists "media public read" on public.media;
create policy "media public read" on public.media for select using (true);
drop policy if exists "media admin write" on public.media;
create policy "media admin write" on public.media for all using (public.is_admin()) with check (public.is_admin());

-- inquiries: anyone can send (insert only); admins read/update/delete
drop policy if exists "inquiries public insert" on public.inquiries;
create policy "inquiries public insert" on public.inquiries for insert with check (handled = false);
drop policy if exists "inquiries admin read" on public.inquiries;
create policy "inquiries admin read" on public.inquiries for select using (public.is_admin());
drop policy if exists "inquiries admin update" on public.inquiries;
create policy "inquiries admin update" on public.inquiries for update using (public.is_admin());
drop policy if exists "inquiries admin delete" on public.inquiries;
create policy "inquiries admin delete" on public.inquiries for delete using (public.is_admin());

-- storage bucket for uploads (public read, 50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media bucket public read" on storage.objects;
create policy "media bucket public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media bucket admin insert" on storage.objects;
create policy "media bucket admin insert" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media bucket admin update" on storage.objects;
create policy "media bucket admin update" on storage.objects for update using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media bucket admin delete" on storage.objects;
create policy "media bucket admin delete" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- ============ careers: job applications and private CV storage ============
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id text not null check (char_length(job_id) <= 120),
  job_title text check (char_length(job_title) <= 200),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 160),
  phone text not null check (char_length(phone) between 3 and 40),
  message text check (char_length(message) <= 3000),
  cv_path text check (cv_path is null or cv_path = '' or cv_path like 'applications/%'),
  cv_name text check (char_length(cv_name) <= 200),
  cv_link text check (char_length(cv_link) <= 500),
  status text not null default 'new' check (status in ('new','review','shortlisted','interview','offer','hired','rejected')),
  created_at timestamptz not null default now()
);
alter table public.applications enable row level security;
drop policy if exists "applications public insert" on public.applications;
create policy "applications public insert" on public.applications for insert with check (status = 'new');
drop policy if exists "applications admin read" on public.applications;
create policy "applications admin read" on public.applications for select using (public.is_admin());
drop policy if exists "applications admin update" on public.applications;
create policy "applications admin update" on public.applications for update using (public.is_admin());
drop policy if exists "applications admin delete" on public.applications;
create policy "applications admin delete" on public.applications for delete using (public.is_admin());

-- CVs: PRIVATE bucket. Applicants can upload (not read, list or overwrite); only admins can read, via short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cvs public upload" on storage.objects;
create policy "cvs public upload" on storage.objects for insert with check (bucket_id = 'cvs' and name like 'applications/%');
drop policy if exists "cvs admin read" on storage.objects;
create policy "cvs admin read" on storage.objects for select using (bucket_id = 'cvs' and public.is_admin());
drop policy if exists "cvs admin delete" on storage.objects;
create policy "cvs admin delete" on storage.objects for delete using (bucket_id = 'cvs' and public.is_admin());
