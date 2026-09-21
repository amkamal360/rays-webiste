-- 20260921000100_core.sql
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


-- 20260921000200_security.sql
-- Security hardening (idempotent).
-- 1. Editing requires two-factor authentication (aal2), enforced by the database itself.
-- 2. Rate-limit counter used by the "submit" Edge Function.
-- 3. Tamper-evident activity log of every portal change.

-- 1 ── Admin rights require a listed admin who has completed two-factor sign-in ────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- 2 ── Rate limiting (called only by the Edge Function with the service role) ──────────────
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security;   -- no policies: invisible to the public API
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public.rate_limits as t (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning hits into v_hits;
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '2 days'; end if;
  return v_hits <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- 3 ── Activity log ──────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  table_name text not null,
  record_id text,
  action text not null
);
alter table public.audit_log enable row level security;
revoke insert, update, delete on public.audit_log from anon, authenticated;
drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log for select using (public.is_admin());

create or replace function public.audit_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, actor_email, table_name, record_id, action)
  values (auth.uid(), auth.jwt() ->> 'email', tg_table_name,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> coalesce(tg_argv[0], 'id'), tg_op);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_site on public.site;
create trigger audit_site after insert or update or delete on public.site for each row execute function public.audit_change();
drop trigger if exists audit_posts on public.posts;
create trigger audit_posts after insert or update or delete on public.posts for each row execute function public.audit_change();
drop trigger if exists audit_media on public.media;
create trigger audit_media after insert or update or delete on public.media for each row execute function public.audit_change();
drop trigger if exists audit_applications on public.applications;
create trigger audit_applications after update or delete on public.applications for each row execute function public.audit_change();
drop trigger if exists audit_inquiries on public.inquiries;
create trigger audit_inquiries after update or delete on public.inquiries for each row execute function public.audit_change();
drop trigger if exists audit_admins on public.admins;
create trigger audit_admins after insert or update or delete on public.admins for each row execute function public.audit_change('user_id');


-- 20260921000300_analytics.sql
-- Cookieless analytics and Ask Rays question log, plus the Insights report for the portal.

create table if not exists public.events (
  id bigserial primary key,
  at timestamptz not null default now(),
  type text not null check (char_length(type) <= 20),
  path text check (char_length(path) <= 200),
  label text check (char_length(label) <= 200),
  ref text check (char_length(ref) <= 200),
  device text check (char_length(device) <= 20),
  visitor text check (char_length(visitor) <= 32)          -- one-way code that changes daily; not an IP
);
create index if not exists events_at_idx on public.events (at);
create index if not exists events_type_at_idx on public.events (type, at);
alter table public.events enable row level security;          -- no policies: written by the track function only
revoke all on public.events from anon, authenticated;

create table if not exists public.ask_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  question text not null check (char_length(question) <= 300),  -- long numbers and emails removed before storing
  answered boolean not null,
  sources text[] not null default '{}',
  ms int,
  visitor text
);
create index if not exists ask_log_at_idx on public.ask_log (at);
alter table public.ask_log enable row level security;
revoke all on public.ask_log from anon, authenticated;

-- Retention: events 13 months, questions 90 days
create or replace function public.prune_analytics() returns void
language sql security definer set search_path = public as $$
  delete from public.events where at < now() - interval '400 days';
  delete from public.ask_log where at < now() - interval '90 days';
$$;
revoke all on function public.prune_analytics() from public, anon, authenticated;
grant execute on function public.prune_analytics() to service_role;

-- Report for Portal → Insights (admins with two-factor only)
create or replace function public.insights(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(coalesce(p_days,30), 400)) - 1);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'visitors',  (select count(distinct visitor) from events where at >= since and type = 'pv'),
    'pageviews', (select count(*) from events where at >= since and type = 'pv'),
    'questions', (select count(*) from events where at >= since and type = 'ask'),
    'forms',     (select count(*) from events where at >= since and type = 'form'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'pv', coalesce(c.n,0)) order by d), '[]')
               from generate_series(since, date_trunc('day', now()), interval '1 day') d
               left join (select date_trunc('day', at) as dday, count(*) as n from events where at >= since and type = 'pv' group by 1) c on c.dday = d),
    'top_pages', (select coalesce(jsonb_agg(x), '[]') from (select path as label, count(*) as n from events where at >= since and type = 'pv' group by 1 order by 2 desc limit 12) x),
    'top_clicks', (select coalesce(jsonb_agg(x), '[]') from (select label, count(*) n from events where at >= since and type in ('click','outbound') group by 1 order by 2 desc limit 12) x),
    'top_questions', (select coalesce(jsonb_agg(x), '[]') from (select lower(label) as label, count(*) as n from events where at >= since and type in ('ask','search') and label <> '' group by 1 order by 2 desc limit 15) x),
    'unanswered', (select coalesce(jsonb_agg(x), '[]') from (
        select lower(label) as label, count(*) as n from (
          select question label from ask_log where at >= since and not answered
          union all select label from events where at >= since and type = 'ask_unanswered') u
        group by 1 order by 2 desc limit 15) x),
    'feedback', (select coalesce(jsonb_agg(x), '[]') from (select label, count(*) n from events where at >= since and type = 'ask_feedback' group by 1 order by 2 desc limit 10) x),
    'referrers', (select coalesce(jsonb_agg(x), '[]') from (select coalesce(nullif(ref,''),'Direct or unknown') as label, count(*) as n from events where at >= since and type = 'pv' group by 1 order by 2 desc limit 10) x),
    'devices', (select coalesce(jsonb_agg(x), '[]') from (select device as label, count(distinct visitor) as n from events where at >= since and type = 'pv' group by 1 order by 2 desc) x),
    'not_found', (select coalesce(jsonb_agg(x), '[]') from (select label, count(*) n from events where at >= since and type = '404' group by 1 order by 2 desc limit 10) x)
  );
end $$;
revoke all on function public.insights(int) from public, anon;
grant execute on function public.insights(int) to authenticated;


-- 20260921000400_forms_via_function.sql
-- Public forms go only through the "submit" Edge Function (bot check + rate limits).
-- Direct public writes to the database and CV storage are removed.
drop policy if exists "inquiries public insert" on public.inquiries;
drop policy if exists "applications public insert" on public.applications;
drop policy if exists "cvs public upload" on storage.objects;
